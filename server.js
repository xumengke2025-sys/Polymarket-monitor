
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { translateText, categorizeEvent } = require('./utils/translator');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// 全局配置
let config = {
    monitorLimit: 50,       // 监控前50个热门事件
    pollInterval: 5000,     // 轮询间隔 (ms)
    changeThreshold: 0.05   // 变动阈值 (5%)
};

let lastPrices = {}; // 全局价格缓存 { marketId: { outcomeIndex: price } }
let monitoringInterval = null;
let watchlist = new Set(); // 存储自选事件 ID

// API: 获取当前配置
app.get('/api/config', (req, res) => {
    res.json(config);
});

// API: 更新配置
app.post('/api/config', (req, res) => {
    const { limit, interval, threshold } = req.body;
    if (limit) config.monitorLimit = parseInt(limit);
    if (interval) config.pollInterval = parseInt(interval);
    if (threshold) config.changeThreshold = parseFloat(threshold);
    
    // 重启监控
    stopMonitoring();
    startMonitoring();
    
    res.json({ success: true, message: "配置已更新" });
});

// 获取 Gamma API 数据 (支持按不同维度排序或标签过滤)
async function fetchGammaEvents(params = {}) {
    try {
        const query = new URLSearchParams({
            closed: 'false',
            limit: params.limit || 20,
            ...params
        });
        
        const url = `https://gamma-api.polymarket.com/events?${query.toString()}`;
        console.log(`[Gamma API] Requesting: ${url}`); // DEBUG LOG

        const options = {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        };
        if (agent) options.agent = agent;
        
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Fetch error (params: ${JSON.stringify(params)}):`, error.message);
        return [];
    }
}

// 获取单个事件详情 (用于 Watchlist)
async function fetchEventById(id) {
    try {
        const url = `https://gamma-api.polymarket.com/events/${id}`;
        const options = {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        };
        if (agent) options.agent = agent;
        
        const response = await fetch(url, options);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error(`Fetch error (ID: ${id}):`, error.message);
        return null;
    }
}

// 辅助函数：获取热门事件列表
async function fetchTopEvents() {
    try {
        console.log(`Fetching events (Hybrid Strategy: Vol + Liq + Middle East + Watchlist)...`);
        
        // 混合策略：
        // 1. Top 50 Volume (总热度)
        // 2. Top 50 Liquidity (当前活跃度)
        // 3. Specific "Middle East" tag (地缘政治热点)
        // 4. Specific "Politics" tag (政治热点)
        // 5. Specific "Iran" search (用户特别关注)
        // 6. Watchlist items (自选池)
        
        const promises = [
            fetchGammaEvents({ sort: 'volume', limit: 50 }),
            fetchGammaEvents({ sort: 'volume_24hr', limit: 50 }), // Add 24h volume
            fetchGammaEvents({ sort: 'liquidity', limit: 50 }),
            fetchGammaEvents({ tag_slug: 'middle-east', limit: 20 }), 
            fetchGammaEvents({ tag_slug: 'politics', limit: 20 }),
            fetchGammaEvents({ q: 'Iran', limit: 20 })
        ];

        // 如果有自选，单独拉取
        if (watchlist.size > 0) {
            const watchlistIds = Array.from(watchlist);
            // Gamma API 不支持批量 ID，只能并发请求
            // 限制并发数量，避免触发限流
            const watchlistPromises = watchlistIds.map(id => fetchEventById(id));
            promises.push(Promise.all(watchlistPromises));
        } else {
            promises.push(Promise.resolve([]));
        }
        
        const results = await Promise.all(promises);
        const [volEvents, vol24hEvents, liqEvents, meEvents, polEvents, iranEventsRaw, watchlistEventsRaw] = results;
        
        // 过滤掉 watchlist 中 fetch 失败的 null
        const watchlistEvents = (Array.isArray(watchlistEventsRaw) ? watchlistEventsRaw : []).filter(e => e);

        // 过滤伊朗相关事件 (因为 API 可能忽略了 q 参数)
        // 确保 iranEvents 是数组
        const safeIranEvents = Array.isArray(iranEventsRaw) ? iranEventsRaw : [];
        const iranEvents = safeIranEvents.filter(e => {
            const text = ((e.title || "") + " " + (e.description || "")).toLowerCase();
            return text.includes('iran');
        });

        // 合并并去重 (按 id)
        const eventMap = new Map();
        
        // 确保所有数组都是安全的
        const safeVolEvents = Array.isArray(volEvents) ? volEvents : [];
        const safeVol24hEvents = Array.isArray(vol24hEvents) ? vol24hEvents : [];
        const safeLiqEvents = Array.isArray(liqEvents) ? liqEvents : [];
        const safeMeEvents = Array.isArray(meEvents) ? meEvents : [];
        const safePolEvents = Array.isArray(polEvents) ? polEvents : [];
        
        [...safeVolEvents, ...safeVol24hEvents, ...safeLiqEvents, ...safeMeEvents, ...safePolEvents, ...iranEvents, ...watchlistEvents].forEach(e => eventMap.set(e.id, e));
        
        // 转回数组
        let events = Array.from(eventMap.values());
        
        // 标记 watchlist 事件，方便前端展示
        events.forEach(e => {
            if (watchlist.has(e.id)) {
                e.isWatchlist = true;
            }
        });
        
        // 按 Volume 降序排列 (watchlist 的也会参与排序，或者我们可以把它们置顶？暂时保持统一排序)
        events.sort((a, b) => (b.volume || 0) - (a.volume || 0));

        console.log(`Fetched ${events.length} unique events (Watchlist: ${watchlistEvents.length}).`);
        return events;
    } catch (error) {
        console.error(`Error fetching top events: ${error.message}`);
        io.emit('error', `获取热门事件失败: ${error.message}`);
        return [];
    }
}

// 核心监控逻辑
function startMonitoring() {
    if (monitoringInterval) clearInterval(monitoringInterval);
    
    console.log(`Starting monitoring for top ${config.monitorLimit} events...`);
    
    // 立即执行一次
    monitorTask();
    
    monitoringInterval = setInterval(monitorTask, config.pollInterval);
}

function stopMonitoring() {
    if (monitoringInterval) clearInterval(monitoringInterval);
}

async function monitorTask() {
    const events = await fetchTopEvents();
    if (!events || events.length === 0) return;

    const allEventsData = [];

    for (const event of events) {
        const markets = event.markets || [];
        if (markets.length === 0) continue;

        // 仅取第一个主要市场作为代表展示 (简化数据传输)
        // 实际监控会检查所有 markets
        const displayMarkets = [];
        
        // 增加翻译和分类
        event.title_cn = translateText(event.title);
        
        // 智能分类 (覆盖默认分类)
        const text = (event.title + " " + (event.description || "")).toLowerCase();
        
        // 1. 地缘政治 (Geopolitics) - 优先级最高
        if (text.includes('iran') || text.includes('israel') || text.includes('gaza') || text.includes('war') || text.includes('middle east') || text.includes('ukraine') || text.includes('russia') || text.includes('china') || text.includes('taiwan')) {
            event.category_cn = "地缘政治"; 
        } 
        // 2. 加密货币细分
        else if (text.includes('bitcoin') || text.includes('btc')) {
            event.category_cn = "比特币"; // Bitcoin
        } else if (text.includes('ethereum') || text.includes('eth')) {
            event.category_cn = "以太坊"; // Ethereum
        } else if (text.includes('crypto') || text.includes('solana') || text.includes('doge') || text.includes('token') || text.includes('nft')) {
            event.category_cn = "加密货币"; // Other Crypto
        } 
        // 3. 政治细分
        else if (text.includes('trump') || text.includes('biden') || text.includes('harris') || text.includes('republican') || text.includes('democrat') || text.includes('us election') || text.includes('senate') || text.includes('house')) {
            event.category_cn = "美国政治"; // US Politics
        } else if (text.includes('election') || text.includes('president') || text.includes('minister') || text.includes('uk ') || text.includes('france') || text.includes('germany')) {
            event.category_cn = "国际政治"; // Global Politics
        } 
        // 4. 体育细分
        else if (text.includes('nfl') || text.includes('super bowl') || text.includes('football')) {
            event.category_cn = "橄榄球"; // American Football
        } else if (text.includes('nba') || text.includes('basketball')) {
            event.category_cn = "篮球"; // Basketball
        } else if (text.includes('soccer') || text.includes('premier league') || text.includes('champions league') || text.includes('fifa')) {
            event.category_cn = "足球"; // Soccer
        } else if (text.includes('sport') || text.includes('tennis') || text.includes('f1') || text.includes('ufc')) {
            event.category_cn = "体育"; // Other Sports
        }
        // 5. 经济/科技/娱乐
        else if (text.includes('fed') || text.includes('rate') || text.includes('inflation') || text.includes('recession') || text.includes('stock') || text.includes('s&p') || text.includes('nasdaq')) {
            event.category_cn = "金融经济"; // Economics
        } else if (text.includes('spacex') || text.includes('musk') || text.includes('ai ') || text.includes('artificial intelligence') || text.includes('apple') || text.includes('nvidia') || text.includes('tech')) {
            event.category_cn = "科技"; // Tech
        } else if (text.includes('taylor swift') || text.includes('oscar') || text.includes('grammy') || text.includes('movie') || text.includes('music') || text.includes('entertainment')) {
            event.category_cn = "娱乐"; // Entertainment
        } 
        else {
            event.category_cn = categorizeEvent(event);
        }
        
        // 传递结束时间
        event.endDate = event.endDate || markets[0].endDate;
        
        // 确保 volume 和 liquidity 存在
        event.liquidity = event.liquidity || 0; 

        // --- 智能构建展示选项 (核心逻辑修改) ---
        let displayCandidates = [];
        const firstMarketOutcomes = JSON.parse(markets[0].outcomes || "[]");
        
        // 判断是否为 Group Market (多个 Binary Markets)
        // 特征：markets 数量 > 1 且 outcomes 包含 Yes/No
        const isBinaryGroup = markets.length > 1 && firstMarketOutcomes.includes("Yes") && firstMarketOutcomes.includes("No");

        if (isBinaryGroup) {
            // 处理 Group Market：每个 Market 作为一个选项
            displayCandidates = markets.map(m => {
                const mOutcomes = JSON.parse(m.outcomes || "[]");
                // outcomePrices 可能不存在，需要处理
                let mPrices = [];
                try {
                    mPrices = JSON.parse(m.outcomePrices || "[]");
                } catch (e) {
                    mPrices = [];
                }
                
                // 找到 "Yes" 的索引
                const yesIndex = mOutcomes.findIndex(o => o === "Yes");
                const rawPrice = yesIndex !== -1 ? mPrices[yesIndex] : 0;
                const price = (rawPrice !== undefined && rawPrice !== null) ? parseFloat(rawPrice) : 0;
                
                // 提取选项名：优先用 groupItemTitle，没有则用 question
                let name = m.groupItemTitle;
                
                // 如果 groupItemTitle 为空，尝试从 question 提取
                if (!name || name.trim() === "") {
                    // 如果 question 包含 title，尝试去除 title 部分以获得更短的选项名
                    if (m.question && event.title && m.question.includes(event.title)) {
                        // 简单的去除尝试，比如 "Event Title: Option Name" -> "Option Name"
                        // 或者 "Event Title - Option Name"
                        // 这里先简单用完整 question，因为格式不统一
                        name = m.question;
                    } else {
                        name = m.question;
                    }
                }
                
                // 如果还是空的，给个默认值
                if (!name || name.trim() === "") {
                    name = `Option ${m.id}`; // 最后的兜底
                }

                return {
                    name: name,
                    price: price,
                    percent: (price * 100).toFixed(1),
                    isBinary: true // 标记源头是 Binary
                };
            });
            
            // 按价格降序排序，让概率高的排前面
            displayCandidates.sort((a, b) => b.price - a.price);
            
        } else {
            // 处理 Single Market (可能是 Binary 也可能是多选项)
            const market = markets[0];
            const mPrices = JSON.parse(market.outcomePrices || "[]");
            
            displayCandidates = firstMarketOutcomes.map((name, index) => ({
                name: name,
                price: parseFloat(mPrices[index] || 0),
                percent: (parseFloat(mPrices[index] || 0) * 100).toFixed(1),
                isBinary: firstMarketOutcomes.includes("Yes")
            }));
            
            // 如果是多选项（非 Yes/No），也按价格排序
            if (!firstMarketOutcomes.includes("Yes")) {
                displayCandidates.sort((a, b) => b.price - a.price);
            }
        }
        
        // 仅保留前 4 个选项用于展示
        event.displayCandidates = displayCandidates.slice(0, 4);

        for (const market of markets) {
            const marketId = market.id;
            try {
                const outcomes = JSON.parse(market.outcomes || "[]");
                const outcomePrices = JSON.parse(market.outcomePrices || "[]");
                
                // 构建前端展示数据 (仅发送主市场或所有市场，视数据量而定，这里发送所有)
                const marketInfo = {
                    id: marketId,
                    question: market.question,
                    outcomes: outcomes.map((outcome, index) => ({
                        name: outcome,
                        price: parseFloat(outcomePrices[index]),
                        percent: (parseFloat(outcomePrices[index]) * 100).toFixed(1)
                    }))
                };
                displayMarkets.push(marketInfo);

                // --- 价格变动检测逻辑 ---
                if (!lastPrices[marketId]) {
                    // 初始化缓存
                    lastPrices[marketId] = {};
                    outcomes.forEach((_, index) => {
                        lastPrices[marketId][index] = parseFloat(outcomePrices[index]);
                    });
                } else {
                    outcomes.forEach((outcome, index) => {
                        const currentPrice = parseFloat(outcomePrices[index]);
                        const oldPrice = lastPrices[marketId][index];
                        
                        if (!isNaN(currentPrice) && !isNaN(oldPrice)) {
                            const change = Math.abs(currentPrice - oldPrice);
                            
                            // 检查是否超过阈值
                            if (change >= config.changeThreshold) {
                                const direction = currentPrice > oldPrice ? "上涨" : "下跌";
                                const percentChange = (change * 100).toFixed(1);
                                
                                const alertMsg = {
                                    id: `${marketId}-${index}-${Date.now()}`, // 唯一ID
                                    time: new Date().toLocaleTimeString(),
                                    eventTitle: event.title,
                                    marketQuestion: market.question,
                                    outcome: outcome,
                                    direction: direction,
                                    oldPrice: oldPrice,
                                    newPrice: currentPrice,
                                    percentChange: percentChange,
                                    volume: event.volume
                                };
                                
                                console.log(`[ALERT] ${alertMsg.eventTitle} - ${alertMsg.outcome}: ${direction} ${percentChange}%`);
                                io.emit('alert', alertMsg);
                                
                                // 更新缓存
                                lastPrices[marketId][index] = currentPrice;
                            } else {
                                // 即使变动不大也更新基准，保持实时性
                                lastPrices[marketId][index] = currentPrice;
                            }
                        }
                    });
                }
            } catch (e) {
                console.error(`Error processing market ${marketId}: ${e.message}`);
            }
        }
        
        allEventsData.push({
            id: event.id,
            title: event.title,
            title_cn: event.title_cn,
            category_cn: event.category_cn,
            slug: event.slug,
            description: event.description || "暂无详细描述", // 添加描述字段
            volume: parseFloat(event.volume || 0),
            liquidity: parseFloat(event.liquidity || 0),
            createdAt: event.createdAt,
            displayCandidates: event.displayCandidates, // 使用新的展示字段
            markets: displayMarkets
        });
    }
    
    // 推送全量数据到前端 (优化：可以只推送变化的数据，但简单起见先全推)
    io.emit('update', {
        events: allEventsData,
        lastUpdated: new Date().toLocaleTimeString(),
        monitoredCount: events.length
    });
}

// Socket 连接处理
io.on('connection', (socket) => {
    console.log('New client connected');
    monitorTask(); // 发送当前状态
    socket.on('disconnect', () => console.log('Client disconnected'));
});

// API: 搜索事件 (Proxy)
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);
        
        // 尝试拉取更多数据以便在内存中搜索
        // Gamma API 似乎忽略了 q 参数，返回默认列表
        // 用户要求：不要限制 Top 逻辑，尽可能多拉取数据进行匹配
        
        // 并发拉取 Top Volume, Top Liquidity 和 Newest
        // 增加 limit 到 500 以覆盖更多长尾事件
        const [volEvents, liqEvents, newEvents] = await Promise.all([
            fetchGammaEvents({ limit: 500, sort: 'volume' }),
            fetchGammaEvents({ limit: 500, sort: 'liquidity' }),
            fetchGammaEvents({ limit: 500, sort: 'startDate', order: 'desc' })
        ]);
        
        // 合并并去重
        const allFetchedEvents = new Map();
        
        const safeVolEvents = Array.isArray(volEvents) ? volEvents : [];
        const safeLiqEvents = Array.isArray(liqEvents) ? liqEvents : [];
        const safeNewEvents = Array.isArray(newEvents) ? newEvents : [];
        
        [...safeVolEvents, ...safeLiqEvents, ...safeNewEvents].forEach(e => allFetchedEvents.set(e.id, e));
        
        const events = Array.from(allFetchedEvents.values());
        
        // 内存过滤：确保返回的结果确实包含查询词 (忽略大小写)
        const lowerQuery = query.toLowerCase();
        let filteredEvents = events.filter(e => {
            const title = (e.title || "").toLowerCase();
            const desc = (e.description || "").toLowerCase();
            const category = (e.category || "").toLowerCase();
            return title.includes(lowerQuery) || desc.includes(lowerQuery) || category.includes(lowerQuery);
        });

        res.json(filteredEvents.slice(0, 50)); // 返回前 50 条匹配结果
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: 获取自选列表
app.get('/api/watchlist', (req, res) => {
    res.json(Array.from(watchlist));
});

// API: 添加到自选
app.post('/api/watchlist', express.json(), (req, res) => {
    const { id } = req.body;
    if (id) {
        watchlist.add(id);
        console.log(`Added to watchlist: ${id}`);
        // 立即触发一次更新任务，以便尽快拉取新添加的事件数据
        // 但不要打断现有的 interval，只是额外跑一次
        fetchTopEvents().then(events => {
             // 广播更新
             // 注意：这里可能会和定时任务重叠，但去重逻辑能处理
             // 为了简单，我们只添加ID，等待下一次轮询即可，或者这里不广播只返回成功
        });
    }
    res.json({ success: true, watchlist: Array.from(watchlist) });
});

// API: 从自选移除
app.delete('/api/watchlist/:id', (req, res) => {
    const { id } = req.params;
    if (id) {
        watchlist.delete(id);
        console.log(`Removed from watchlist: ${id}`);
    }
    res.json({ success: true, watchlist: Array.from(watchlist) });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startMonitoring();
});
