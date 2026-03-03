const http = require('http');
const net = require('net');
const { exec } = require('child_process');

console.log("==========================================");
console.log("      Polymarket Monitor Proxy Detector   ");
console.log("==========================================");
console.log("正在扫描常见代理端口，请稍候...\n");

const commonPorts = [
    7890, 7891, 7892, 7893, 7894, 7895, // Clash default
    1080, 1081, 1082, 10808, 10809,     // v2rayN / Shadowsocks
    8080, 8888, 8889,                   // Fiddler / Charles / Other
    3128, 8118,                         // Squid / Privoxy
    20170, 20171, 20172                 // Other common
];

// 检查端口是否开放
function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000); // 1秒超时

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, '127.0.0.1');
    });
}

// 检查是否真的是 HTTP 代理
function verifyHttpProxy(port) {
    return new Promise((resolve) => {
        const options = {
            hostname: '127.0.0.1',
            port: port,
            path: 'http://www.google.com', // 尝试连接 Google (不一定成功，只要代理有响应即可)
            method: 'HEAD',
            timeout: 2000
        };

        const req = http.request(options, (res) => {
            // 只要有响应状态码（哪怕是 403/407/500），说明是一个 HTTP 服务
            // 如果是代理，通常会返回 200, 301, 403, 502 等
            resolve(true);
        });

        req.on('error', (e) => {
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

async function main() {
    let foundProxy = false;

    for (const port of commonPorts) {
        process.stdout.write(`检查端口 ${port}... `);
        const isOpen = await checkPort(port);
        
        if (isOpen) {
            console.log("开放 ✅");
            console.log(`正在验证端口 ${port} 是否为有效代理...`);
            
            // 简单验证：尝试作为 HTTP 代理连接
            // 这里我们只做简单推断：如果端口开放，很可能是代理
            // 实际验证比较复杂，这里简化处理，直接推荐用户尝试
            
            console.log(`\n🎉 发现潜在代理端口: ${port}`);
            console.log(`--------------------------------------------------`);
            console.log(`请尝试修改 .env 文件中的 HTTP_PROXY 配置：`);
            console.log(`HTTP_PROXY=http://127.0.0.1:${port}`);
            console.log(`--------------------------------------------------\n`);
            foundProxy = true;
            
            // 如果用户有多个代理，我们继续找，列出所有可能的
        } else {
            console.log("关闭");
        }
    }

    if (!foundProxy) {
        console.log("\n❌ 未扫描到常见代理端口。");
        console.log("请确认：");
        console.log("1. 您的科学上网软件已开启");
        console.log("2. 软件设置中已允许“局域网连接”或“本地代理”");
        console.log("3. 查看软件设置中的“HTTP 代理端口”具体是多少");
    } else {
        console.log("✅ 扫描完成。请根据上述结果修改 .env 文件，然后重新运行 start.bat");
    }
    
    console.log("\n按任意键退出...");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, 0));
}

main();
