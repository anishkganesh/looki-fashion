const FirecrawlApp = require('@mendable/firecrawl-js').default;

const firecrawl = new FirecrawlApp({ 
  apiKey: process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY' 
});

async function testFirecrawl() {
  console.log('Testing Firecrawl API...\n');
  
  const query = '"fashion trends 2025" trending now';
  console.log(`Searching for: ${query}`);
  
  try {
    const searchResult = await firecrawl.search(query, {
      limit: 3,
      scrapeOptions: {
        formats: ["markdown"],
        timeout: 15000,
        waitFor: 1000
      }
    });
    
    console.log('\nSearch Result:', JSON.stringify(searchResult, null, 2));
    
    if (searchResult.data && searchResult.data.length > 0) {
      console.log(`\nFound ${searchResult.data.length} results\n`);
      
      searchResult.data.forEach((result, index) => {
        console.log(`\n--- Result ${index + 1} ---`);
        console.log('URL:', result.url);
        console.log('Title:', result.title);
        console.log('Content length:', result.markdown?.length || 0);
        
        if (result.markdown) {
          console.log('Content preview:', result.markdown.substring(0, 500) + '...');
          
          // Test trend extraction patterns
          const patterns = [
            /(?:trending|popular|viral):\s*([^.!?,\n]{5,80})/gi,
            /([^.!?,\n]{5,80})\s+(?:is|are)\s+(?:trending|going viral|everywhere)/gi,
            /\b([^.!?,\n]{5,80})\s+(?:trend|style|look|fashion)/gi,
          ];
          
          console.log('\nTesting trend extraction:');
          patterns.forEach((pattern, i) => {
            const matches = [...result.markdown.matchAll(pattern)];
            if (matches.length > 0) {
              console.log(`Pattern ${i + 1} found ${matches.length} matches:`);
              matches.slice(0, 3).forEach(match => {
                console.log(`  - "${match[1] || match[0]}"`);
              });
            }
          });
        }
      });
    } else {
      console.log('No search results found');
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testFirecrawl(); 