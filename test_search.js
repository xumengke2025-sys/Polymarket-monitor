
const fetch = require('node-fetch');

async function testSearch(endpoint, paramName, paramValue) {
    try {
        const query = new URLSearchParams({
            closed: 'false',
            limit: 5,
            [paramName]: paramValue
        });
        
        const url = `https://gamma-api.polymarket.com/${endpoint}?${query.toString()}`;
        console.log(`Testing URL: ${url}`);
        
        const options = {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        };
        
        const response = await fetch(url, options);
        if (!response.ok) {
            console.log(`Failed: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        console.log(`Results for /${endpoint}?${paramName}=${paramValue}: ${data.length} items`);
        if (data.length > 0) {
            // events 有 title, markets 有 question
            const title = data[0].title || data[0].question;
            console.log(`Top item: ${title}`);
             if (title && title.toLowerCase().includes('iran')) {
                 console.log('✅ Match found!');
             } else {
                 console.log('❌ No match');
             }
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

async function run() {
    // 试试 /markets 端点
    await testSearch('markets', 'q', 'Iran');
    await testSearch('markets', 'query', 'Iran');
    
    // 试试 /events 端点但用 slug (作为模糊匹配尝试？)
    // await testSearch('events', 'slug', 'iran'); 
}

run();
