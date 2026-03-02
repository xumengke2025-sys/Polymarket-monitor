const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');
require('dotenv').config();

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;

async function checkIranEvents() {
    try {
        console.log("--- Testing Different Endpoints/Params ---");
        
        // 1. Try 'markets' endpoint with q
        console.log("\n1. GET /markets?q=Iran");
        const resMarkets = await fetch("https://gamma-api.polymarket.com/markets?q=Iran&limit=10&closed=false", { agent });
        if (resMarkets.ok) {
            const data = await resMarkets.json();
            // Gamma 'markets' endpoint usually returns { data: [...] } or array
            const markets = Array.isArray(data) ? data : (data.data || []);
            console.log(`Found ${markets.length} markets.`);
            markets.slice(0, 3).forEach(m => console.log(`- ${m.question}`));
        } else {
            console.log("Failed:", resMarkets.status);
        }

        // 2. Try 'events' with 'slug' filter (sometimes search works by slug)
        // Or fetching a large list and filtering locally again with broader keywords
        console.log("\n2. Fetching Top 500 Events (Volume) & Filtering Locally");
        const resBulk = await fetch("https://gamma-api.polymarket.com/events?limit=500&sort=volume&closed=false", { agent });
        const eventsBulk = await resBulk.json();
        
        const keywords = ['iran', 'israel', 'tehran', 'khamenei', 'middle east', 'war'];
        const matches = eventsBulk.filter(e => {
            const text = (e.title + " " + e.description).toLowerCase();
            return keywords.some(k => text.includes(k));
        });

        console.log(`Found ${matches.length} matches in Top 500.`);
        matches.forEach(e => console.log(`[MATCH] ${e.title} (Vol: $${e.volume})`));

    } catch (error) {
        console.error("Error:", error);
    }
}

checkIranEvents();
