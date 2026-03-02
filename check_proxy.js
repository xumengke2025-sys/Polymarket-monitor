const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');

// 常见的代理端口
const commonPorts = [
    7890, 7891, // Clash
    10809, 10808, // v2rayN
    1080, 1081, // Shadowsocks
    8080, 8888, // Generic
    3128, // Squid
    4780, 4781 // Other
];

async function checkProxy(port) {
    const proxyUrl = `http://127.0.0.1:${port}`;
    const agent = new HttpsProxyAgent(proxyUrl);
    
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2秒超时
        
        // 尝试连接 google (最常用的被墙测试地址) 或者 polymarket api
        const response = await fetch('https://gamma-api.polymarket.com/events?limit=1', {
            agent: agent,
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (response.ok) {
            console.log(`✅ 发现可用代理: ${proxyUrl}`);
            return proxyUrl;
        }
    } catch (error) {
        // console.log(`❌ 端口 ${port} 不可用: ${error.message}`);
    }
    return null;
}

async function findProxy() {
    console.log("🔍 正在扫描常用代理端口...");
    
    // 并行检查所有端口
    const promises = commonPorts.map(port => checkProxy(port));
    const results = await Promise.all(promises);
    
    const workingProxy = results.find(proxy => proxy !== null);
    
    if (workingProxy) {
        console.log("\n🎉 成功找到代理!");
        console.log(`请将 .env 文件中的 HTTP_PROXY 设置为: ${workingProxy}`);
    } else {
        console.log("\n⚠️ 未能自动检测到常用代理端口。");
        console.log("请手动检查你的代理软件设置，查找 'HTTP 代理端口' 或 'HTTP Proxy Port'。");
    }
}

findProxy();
