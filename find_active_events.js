const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');
require('dotenv').config();

const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;

async function fetchTopEvents() {
    try {
        console.log("Fetching events from Polymarket Gamma API...");
        const response = await fetch("https://gamma-api.polymarket.com/events?limit=50&sort=volume&closed=false", {
            agent: agent
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const events = await response.json();
        console.log(`Fetched ${events.length} events.`);

        // Filter for the specific event user mentioned: "Republican Presidential Nominee 2028"
        // Searching by title keywords
        const targetEvent = events.find(e => e.title.includes("Republican Presidential Nominee 2028"));

        if (targetEvent) {
            console.log(`\nFound Target Event: ${targetEvent.title} (Slug: ${targetEvent.slug})`);
            console.log(`Markets Count: ${targetEvent.markets.length}`);
            
            // Log the first 10 markets to analyze structure
            const marketsSample = targetEvent.markets.slice(0, 10).map(m => {
                let outcomes, prices;
                try {
                    outcomes = JSON.parse(m.outcomes);
                } catch (e) { outcomes = m.outcomes; }
                
                try {
                    prices = JSON.parse(m.outcomePrices);
                } catch (e) { prices = m.outcomePrices; }

                return {
                    id: m.id,
                    groupItemTitle: m.groupItemTitle,
                    question: m.question,
                    outcomes: outcomes,
                    outcomePrices: prices
                };
            });

            console.log(JSON.stringify(marketsSample, null, 2));
            console.log("Event Description:", targetEvent.description || "No description found");
        } else {
            console.log("\nTarget event 'Republican Presidential Nominee 2028' not found in top 50. Searching all...");
             // Fallback: list titles to see if we missed it
             events.forEach(e => console.log(`- ${e.title}`));
        }
        
    } catch (error) {
        console.error("Error fetching events:", error);
    }
}

fetchTopEvents();
