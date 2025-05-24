import openaiClient from '@/lib/openai';

export async function POST(req: Request) {
  console.log("Chat API called");

  try {
    const body = await req.json();
    console.log("Request type:", body.tool ? body.tool : "chat", "Request body:", JSON.stringify(body).substring(0, 200) + "...");
    
    const { messages, tool, webSearch, fileContents, fileType, fileName } = body;
    
    // Handle image generation request
    if (tool === 'image') {
      try {
        console.log("Processing image generation request");
        const lastMessage = messages[messages.length - 1].content;
        
        const response = await openaiClient.images.generate({
          model: "dall-e-3",
          prompt: lastMessage,
          n: 1,
          size: "1024x1024",
        });
        
        // Get the image URL from the response
        const imageUrl = response.data?.[0]?.url;
        
        if (!imageUrl) {
          throw new Error("Failed to generate image: No URL returned");
        }
        
        // Create the response object
        const responseBody = {
          id: Date.now().toString(),
          role: "assistant",
          content: `![Generated image](${imageUrl})`,
          createdAt: new Date()
        };
        
        console.log("Image response:", JSON.stringify(responseBody));
        
        // Return the response in the format expected by the useChat hook
        return new Response(
          JSON.stringify(responseBody),
          { 
            headers: { 
              'Content-Type': 'application/json'
            } 
          }
        );
      } catch (error) {
        console.error("Image generation error:", error);
        return new Response(
          JSON.stringify({
            id: Date.now().toString(),
            role: "assistant",
            content: "I'm sorry, I couldn't generate that image. Please try a different prompt.",
            createdAt: new Date()
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Add system message if it doesn't exist
    const systemMessageExists = messages.some((m: { role: string }) => m.role === 'system');
    const finalMessages = [...messages];
    
    if (!systemMessageExists) {
      finalMessages.unshift({
        role: 'system',
        content: 'You are a helpful assistant that can provide information, analyze files, generate images, and search the web to answer questions.'
      });
    }
    
    // Add file content to the messages if provided
    if (fileContents && fileContents.length > 0) {
      console.log(`Processing ${fileContents.length} files`);
      
      let fileAnalysisPrompt = 'The user has uploaded the following files:\n\n';
      
      for (const file of fileContents) {
        if (!file) continue;
        
        console.log("Processing file:", file.fileName, "type:", file.fileType);
        
        if (file.fileType && file.fileType.startsWith('image/')) {
          // For image files, add to messages with vision
          finalMessages.push({
            role: 'system',
            content: `Image file: ${file.fileName}`
          });
          
          finalMessages.push({
            role: 'user',
            content: [
              { type: 'text', text: `Analyze this image (${file.fileName}):` },
              { type: 'image_url', image_url: { url: file.fileContent } }
            ]
          });
        } else if (file.fileType === 'application/pdf') {
          // For PDF files - extract text from base64
          const base64Data = file.fileContent.split(',')[1];
          
          // Add PDF content notice
          finalMessages.push({
            role: 'system',
            content: `PDF Document: ${file.fileName}. Note: PDF text extraction may not preserve exact formatting. The content below is the extracted text from the PDF.`
          });
          
          // For now, inform that we need PDF parsing capability
          fileAnalysisPrompt += `PDF File "${file.fileName}": [PDF parsing will be implemented - for now, please copy the text content]\n\n`;
        } else if (file.fileType === 'application/json' || file.fileName.endsWith('.json')) {
          // Parse JSON files
          try {
            let jsonContent = file.fileContent;
            // If it's base64 encoded, decode it
            if (file.fileContent.includes('base64,')) {
              const base64Data = file.fileContent.split(',')[1];
              jsonContent = Buffer.from(base64Data, 'base64').toString('utf-8');
            }
            
            const jsonData = JSON.parse(jsonContent);
            fileAnalysisPrompt += `JSON File "${file.fileName}":\n\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\`\n\n`;
          } catch (e) {
            fileAnalysisPrompt += `JSON File "${file.fileName}": [Error parsing JSON: ${e}]\n\n`;
          }
        } else if (file.fileType === 'text/csv' || file.fileName.endsWith('.csv')) {
          // Handle CSV files
          let csvContent = file.fileContent;
          // If it's base64 encoded, decode it
          if (file.fileContent.includes('base64,')) {
            const base64Data = file.fileContent.split(',')[1];
            csvContent = Buffer.from(base64Data, 'base64').toString('utf-8');
          }
          
          // Parse CSV
          const lines = csvContent.split('\n').filter((line: string) => line.trim());
          const headers = lines[0]?.split(',').map((h: string) => h.trim());
          
          fileAnalysisPrompt += `CSV File "${file.fileName}":\n`;
          fileAnalysisPrompt += `Headers: ${headers?.join(', ') || 'No headers found'}\n`;
          fileAnalysisPrompt += `Total rows: ${lines.length - 1}\n`;
          fileAnalysisPrompt += `Sample data (first 5 rows):\n\`\`\`\n${lines.slice(0, 6).join('\n')}\n\`\`\`\n\n`;
        } else {
          // For other text files
          let textContent = file.fileContent;
          // If it's base64 encoded, decode it
          if (file.fileContent.includes('base64,')) {
            const base64Data = file.fileContent.split(',')[1];
            textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
          }
          
          fileAnalysisPrompt += `Text File "${file.fileName}":\n\`\`\`\n${textContent.substring(0, 2000)}${textContent.length > 2000 ? '\n... (truncated)' : ''}\n\`\`\`\n\n`;
        }
      }
      
      // Add the file analysis prompt if we have non-image files
      if (fileAnalysisPrompt !== 'The user has uploaded the following files:\n\n') {
        finalMessages.push({
          role: 'system',
          content: fileAnalysisPrompt
        });
      }
    }
    
    // Add web search results to the messages if requested
    if (webSearch && webSearch.results) {
      console.log("Processing web search results");
      finalMessages.push({
        role: 'system',
        content: `Here are some web search results that might help answer the query: ${JSON.stringify(webSearch.results).substring(0, 200)}...`
      });
    }
    
    console.log("Sending OpenAI request with message count:", finalMessages.length);
    
    // Use GPT-4o for all requests (it has vision capabilities)
    const model = 'gpt-4o';
    
    // Use OpenAI's API to get a response with appropriate configuration
    const response = await openaiClient.chat.completions.create({
      model: model,
      messages: finalMessages.map(m => {
        // Handle special case for images
        if (m.content && typeof m.content !== 'string') {
          return { role: m.role, content: m.content };
        }
        return { role: m.role, content: m.content };
      }),
      stream: false, // Use non-streaming
      max_tokens: 1024, // Increase token limit for complex responses
    });
    
    const content = response.choices[0]?.message?.content || "No response generated";
    console.log("OpenAI response received, content length:", content.length);
    
    // Create the response object
    const responseBody = {
      id: Date.now().toString(),
    role: "assistant",
      content: content,
      createdAt: new Date()
    };
    
    console.log("Sending response:", JSON.stringify(responseBody).substring(0, 200) + "...");
    
    // Return the response in the format expected by the useChat hook
    return new Response(
      JSON.stringify(responseBody),
      { 
    headers: {
      'Content-Type': 'application/json'
    }
      }
    );
  } catch (error) {
    console.error("Chat error:", error);
    
    // Return an error response in the format expected by the useChat hook
    return new Response(
      JSON.stringify({
        id: Date.now().toString(),
        role: "assistant", 
        content: "I'm sorry, there was an error processing your request. Please try again later.",
        createdAt: new Date()
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 