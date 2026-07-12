const http = require('http');
const data = JSON.stringify({
    email: 'sreeganeshyerraballi@gmail.com',
    name: 'Test',
    password: 'Test123!',
    role: 'candidate',
    gender: 'other',
});

function post(path, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: 4000,
                path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let bodyData = '';
                res.on('data', (chunk) => (bodyData += chunk));
                res.on('end', () => {
                    resolve({ status: res.statusCode, body: bodyData });
                });
            }
        );

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

(async () => {
    try {
        const sendRes = await post('/api/auth/send-otp', data);
        // debug: SEND response removed for production
        // console.log('SEND', sendRes.status, sendRes.body);
        const sendJson = JSON.parse(sendRes.body);
        const otp = sendJson.devOtp;
        if (!otp) {
            console.error('No devOtp returned');
            process.exit(1);
        }
        const verifyPayload = JSON.stringify({ email: 'sreeganeshyerraballi@gmail.com', otp });
        const verifyRes = await post('/api/auth/verify-otp', verifyPayload);
        // debug: VERIFY response removed for production
        // console.log('VERIFY', verifyRes.status, verifyRes.body);
    } catch (error) {
        // log minimal error for CI/debugging; in production use a proper logger
        console.error('ERROR', error?.message || error);
        process.exit(1);
    }
})();