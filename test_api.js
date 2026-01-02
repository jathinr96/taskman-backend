const http = require('http');

// Helper to make a request
function makeRequest(path, method, data) {
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log(`[${method} ${path}] Status: ${res.statusCode}`);
            console.log('Body:', body);
        });
    });

    req.on('error', (e) => {
        console.error(`[${method} ${path}] Error: ${e.message}`);
    });

    if (data) {
        req.write(JSON.stringify(data));
    }
    req.end();
}

// 1. Check Root
makeRequest('/', 'GET');

// 2. Register User (Random email to avoid duplicates in testing)
const randomEmail = `testuser${Math.floor(Math.random() * 1000)}@example.com`;
makeRequest('/api/auth/register', 'POST', {
    name: 'Test User',
    email: randomEmail,
    password: 'password123'
});
