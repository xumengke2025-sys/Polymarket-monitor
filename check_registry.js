const { exec } = require('child_process');

exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', (error, stdout, stderr) => {
    if (error) {
        console.log("No proxy found in registry or error:", error.message);
        return;
    }
    console.log("System Proxy:", stdout);
});

exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable', (error, stdout, stderr) => {
    if (!error) console.log("Proxy Enable Status:", stdout);
});