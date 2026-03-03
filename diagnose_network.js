const http = require('http');
const https = require('https');
const net = require('net');
const dns = require('dns');
const { exec } = require('child_process');

console.log("==========================================");
console.log("      Polymarket Monitor Network Diagnostic");
console.log("==========================================");

const targetHost = 'gamma-api.polymarket.com';
const commonPorts = [
    7890, 7897, // Clash
    1080, 10808, 10809, // v2rayN / Shadowsocks
    8080, 8888 // Other
];

async function checkDNS() {
    console.log(`\n[1/4] Checking DNS resolution for ${targetHost}...`);
    return new Promise(resolve => {
        dns.lookup(targetHost, (err, address) => {
            if (err) {
                console.log(`❌ DNS Resolution Failed: ${err.message}`);
                resolve(false);
            } else {
                console.log(`✅ Resolved to: ${address}`);
                resolve(true);
            }
        });
    });
}

async function checkDirectConnection() {
    console.log(`\n[2/4] Checking Direct Connection to ${targetHost}:443...`);
    return new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        socket.on('connect', () => {
            console.log(`✅ Direct TCP Connection Successful!`);
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            console.log(`❌ Direct Connection Timed Out (Likely blocked)`);
            socket.destroy();
            resolve(false);
        });
        socket.on('error', (err) => {
            console.log(`❌ Direct Connection Error: ${err.message}`);
            socket.destroy();
            resolve(false);
        });
        socket.connect(443, targetHost);
    });
}

async function checkProxyPorts() {
    console.log(`\n[3/4] Scanning Local Proxy Ports...`);
    let found = [];
    for (const port of commonPorts) {
        const isOpen = await new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(500);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, '127.0.0.1');
        });
        
        if (isOpen) {
            console.log(`✅ Found open port: ${port}`);
            found.push(port);
        }
    }
    
    if (found.length === 0) {
        console.log(`❌ No common proxy ports found open.`);
    }
    return found;
}

async function checkRegistry() {
    console.log(`\n[4/4] Checking Windows Registry Proxy Settings...`);
    return new Promise(resolve => {
        exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable', (err, stdout) => {
            if (err) {
                console.log(`❓ Could not read registry.`);
                resolve(null);
                return;
            }
            const enabled = stdout.includes('0x1');
            console.log(`System Proxy Enabled: ${enabled ? 'YES ✅' : 'NO ❌'}`);
            
            if (enabled) {
                exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', (err, stdout) => {
                    if (!err) {
                        const match = stdout.match(/ProxyServer\s+REG_SZ\s+(.*)/);
                        if (match) console.log(`System Proxy Server: ${match[1]}`);
                    }
                    resolve(enabled);
                });
            } else {
                resolve(enabled);
            }
        });
    });
}

async function main() {
    await checkDNS();
    const direct = await checkDirectConnection();
    const proxies = await checkProxyPorts();
    const sysProxy = await checkRegistry();
    
    console.log(`\n==========================================`);
    console.log(`Diagnostic Result:`);
    
    if (direct) {
        console.log(`✅ Direct connection works! You shouldn't need a proxy.`);
        console.log(`If server.js is failing, check if .env has a bad HTTP_PROXY set.`);
    } else {
        console.log(`❌ Direct connection failed. You MUST use a proxy.`);
        
        if (proxies.length > 0) {
            console.log(`✅ Found potential proxies at: ${proxies.join(', ')}`);
            console.log(`Please update .env with: HTTP_PROXY=http://127.0.0.1:${proxies[0]}`);
        } else {
            console.log(`❌ No proxy ports found and System Proxy is ${sysProxy ? 'ON' : 'OFF'}.`);
            console.log(`SUGGESTION:`);
            console.log(`1. Open your proxy software (Clash/v2rayN).`);
            console.log(`2. Enable "Allow LAN" or "System Proxy".`);
            console.log(`3. Check exactly which port it uses (Settings -> Port).`);
        }
    }
    console.log(`==========================================\n`);
    
    // Keep window open
    console.log("Press any key to exit...");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', process.exit.bind(process, 0));
}

main();