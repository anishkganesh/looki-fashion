// Quick test script to verify the scraper is working
const FashionTrendsScraper = require('./index');

async function quickTest() {
    const scraper = new FashionTrendsScraper();
    
    console.log('Running quick test with limited searches...');
    
    // Override getSearchQueries to return just a few queries
    scraper.getSearchQueries = () => [
        '"upcoming fashion trends" January 2025',
        '"TikTok fashion trends" viral 2025'
    ];
    
    try {
        const result = await scraper.run();
        console.log('\nTest Results:', JSON.stringify(result, null, 2));
        
        if (result.trends && result.trends.length > 0) {
            console.log('\nSample trend details:');
            console.log(JSON.stringify(result.trends[0], null, 2));
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

quickTest(); 