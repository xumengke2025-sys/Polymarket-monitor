const net = require('net');
const ports = [7890, 7891, 7892, 7893, 7894, 7895, 7896, 7897, 1080, 1081, 1082, 10808, 10809, 20170, 20171, 20172, 4780, 5000, 8888, 8080];

async function check(port) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        socket.setTimeout(500);
        socket.on('connect', () => {
            console.log(`FOUND_PROXY_PORT:${port}`);
            socket.destroy();
            resolve(port);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(null);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(null);
        });
        socket.connect(port, '127.0.0.1');
    });
}

async function run() {
    console.log("Checking ports...");
    for (const p of ports) {
        await check(p);
    }
    console.log("Done.");
}

run();