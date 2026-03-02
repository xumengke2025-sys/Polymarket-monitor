require('dotenv').config();
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

// 1. 配置加载
const EVENT_SLUG = process.env.EVENT_SLUG || "will-bitcoin-reach-100k-in-2024";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "5000"); // 5秒
const CHANGE_THRESHOLD = parseFloat(process.env.CHANGE_THRESHOLD || "0.05"); // 5% 变动
const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

// Telegram 配置
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 代理配置
let agent = null;
if (PROXY_URL) {
    console.log(`Using proxy: ${PROXY_URL}`);
    agent = new HttpsProxyAgent(PROXY_URL);
}

// 内存中保存上一次的价格
// 结构: { marketId: { outcomeIndex: price } }
let lastPrices = {};

// 2. 数据获取函数
async function fetchEventData(slug) {
    const url = `https://gamma-api.polymarket.com/events?slug=${slug}`;
    try {
        const options = {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        
        if (agent) {
            options.agent = agent;
        }

        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const events = await response.json();
        return events;
    } catch (error) {
        console.error(`Error fetching data: ${error.message}`);
        return null;
    }
}

// 3. 通知发送函数
async function sendNotification(message) {
    console.log(`[ALERT] ${message}`);
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const body = {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        };
        
        try {
            const options = {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            };
            
            if (agent) {
                options.agent = agent;
            }

            const response = await fetch(url, options);
            if (!response.ok) {
                console.error(`Failed to send Telegram message: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`Error sending Telegram message: ${error.message}`);
        }
    }
}

// 4. 核心监控循环
async function startMonitoring() {
    console.log(`Starting monitor for event: ${EVENT_SLUG}`);
    console.log(`Poll interval: ${POLL_INTERVAL}ms`);
    console.log(`Change threshold: ${CHANGE_THRESHOLD * 100}%`);
    console.log("---------------------------------------------------");

    setInterval(async () => {
        const events = await fetchEventData(EVENT_SLUG);
        
        if (!events || events.length === 0) {
            // console.log("No event found or error occurred.");
            return;
        }

        // 通常按 slug 查询只会返回一个 event，但也可能有多个相关 event
        const event = events[0];
        const markets = event.markets || [];

        if (markets.length === 0) {
            console.log("Event found but no markets available.");
            return;
        }

        // 遍历该事件下的所有市场
        for (const market of markets) {
            const marketId = market.id;
            const question = market.question;
            
            try {
                const outcomes = JSON.parse(market.outcomes || "[]");
                const outcomePrices = JSON.parse(market.outcomePrices || "[]");

                if (!lastPrices[marketId]) {
                    // 初始化价格记录
                    lastPrices[marketId] = {};
                    outcomes.forEach((outcome, index) => {
                        lastPrices[marketId][index] = parseFloat(outcomePrices[index]);
                    });
                    console.log(`[INIT] Market: ${question}`);
                    outcomes.forEach((outcome, index) => {
                        console.log(`  - ${outcome}: ${outcomePrices[index]}`);
                    });
                    continue;
                }

                // 比较价格
                outcomes.forEach((outcome, index) => {
                    const currentPrice = parseFloat(outcomePrices[index]);
                    const oldPrice = lastPrices[marketId][index];

                    if (isNaN(currentPrice) || isNaN(oldPrice)) return;

                    const change = Math.abs(currentPrice - oldPrice);

                    if (change >= CHANGE_THRESHOLD) {
                        const direction = currentPrice > oldPrice ? "UP" : "DOWN";
                        const percentChange = (change * 100).toFixed(1);
                        
                        const alertMsg = `⚠️ Price Alert!\n` +
                                       `Event: ${event.title}\n` +
                                       `Market: ${question}\n` +
                                       `Outcome: ${outcome}\n` +
                                       `Change: ${direction} ${percentChange}% (${oldPrice} -> ${currentPrice})`;
                        
                        sendNotification(alertMsg);
                        
                        // 更新旧价格，避免重复报警
                        // 你也可以选择不立即更新，而是等待价格稳定，取决于策略
                        lastPrices[marketId][index] = currentPrice;
                    } else {
                        // 如果变动很小，我们也更新价格，以保持基准是最新的
                        // 或者：你可以选择只在变动超过一定幅度时才更新基准，这样可以捕捉累积变动
                        // 这里我们选择每次都更新，捕捉的是“瞬时剧烈波动”
                        lastPrices[marketId][index] = currentPrice;
                    }
                });

            } catch (e) {
                console.error(`Error parsing market data for ${marketId}: ${e.message}`);
            }
        }
        
        process.stdout.write("."); // 心跳显示

    }, POLL_INTERVAL);
}

// 启动
startMonitoring();
