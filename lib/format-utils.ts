// Utility functions for formatting trend data

export function formatTrendName(identifier: string, description?: string): string {
  // If description starts with a hashtag or contains the original name format, extract it
  if (description) {
    // Check if description starts with original trend name (e.g., "#TrendName: description" or "TrendName: description")
    const nameMatch = description.match(/^(#?[^:]+):\s*/);
    if (nameMatch) {
      // Remove hashtag and format with proper spacing
      return formatHashtagToReadable(nameMatch[1]);
    }
    
    // Check if description contains hashtags at the beginning
    const hashtagMatch = description.match(/^(#\w+(?:\s+\w+)*)/);
    if (hashtagMatch) {
      // Remove hashtag and format with proper spacing
      return formatHashtagToReadable(hashtagMatch[1]);
    }
  }
  
  // Fallback: format the identifier nicely
  return identifier
    .split('-')
    .map(word => {
      // Don't capitalize certain words unless they're at the beginning
      const lowercaseWords = ['and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
      if (lowercaseWords.includes(word) && identifier.indexOf(word) > 0) {
        return word;
      }
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Helper function to convert hashtag format to readable format
function formatHashtagToReadable(hashtagText: string): string {
  // Remove leading hashtag
  let text = hashtagText.replace(/^#/, '');
  
  // Handle numbers attached to words (e.g., "Trends2024" -> "Trends 2024")
  text = text.replace(/([a-zA-Z])(\d+)/g, '$1 $2');
  
  // Handle camelCase and PascalCase by inserting spaces before capitals
  text = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  text = text.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  
  // Handle consecutive capitals (e.g., "Y2K" should stay together, "OOTD" should stay together)
  text = text.replace(/([A-Z]{2,})/g, (match) => {
    // Keep common acronyms together
    const commonAcronyms = ['OOTD', 'DIY', 'Y2K', 'OTK', 'LBD', 'GRWM', 'WIWT', 'FOTD', 'NBD'];
    if (commonAcronyms.includes(match)) {
      return match;
    }
    // Keep acronyms with numbers (like Y2K) together
    if (match.length <= 3 || match.match(/\d/)) {
      return match;
    }
    // For other long sequences of capitals, keep them together if 4 or fewer chars
    if (match.length <= 4) {
      return match;
    }
    // Otherwise split them
    return match.split('').join(' ');
  });
  
  // Clean up any multiple spaces
  text = text.replace(/\s+/g, ' ').trim();
  
  // Capitalize appropriately
  return text.split(' ').map((word, index) => {
    // Keep acronyms and all-caps words in uppercase
    if ((word.length <= 4 && word === word.toUpperCase()) || word.match(/\d/)) {
      return word;
    }
    // Don't capitalize certain words unless they're at the beginning
    const lowercaseWords = ['and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
    if (lowercaseWords.includes(word.toLowerCase()) && index > 0) {
      return word.toLowerCase();
    }
    // Capitalize first letter of each word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export function extractHashtagsFromDescription(description: string): string[] {
  const hashtags = description.match(/#\w+/g) || [];
  return [...new Set(hashtags)]; // Remove duplicates
}

export function getTrendDisplayName(trend: { trend_identifier: string; trend_description?: string }): string {
  return formatTrendName(trend.trend_identifier, trend.trend_description);
} 