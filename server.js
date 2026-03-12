const express = require('express');
const https = require('https');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static('.'));

// Paytm Configuration - REPLACE WITH YOUR CREDENTIALS
const PaytmConfig = {
    mid: "YOUR_MERCHANT_ID",
    key: "YOUR_MERCHANT_KEY",
    website: "WEBSTAGING",
    callbackUrl: "http://localhost:3000/paytm/callback"
};

// Initiate Payment
app.post('/paytm/initiate', async (req, res) => {
    const { orderId, amount, mobile } = req.body;

    res.json({
        success: true,
        orderId: orderId,
        amount: amount,
        mid: PaytmConfig.mid,
        txnToken: "DEMO_TOKEN_" + Date.now()
    });
});

// Payment Callback
app.post('/paytm/callback', async (req, res) => {
    const orderId = req.body.ORDERID;
    const status = req.body.STATUS || 'TXN_SUCCESS';

    res.send(`
        <html>
            <body>
                <script>
                    window.opener.postMessage({
                        orderId: '${orderId}',
                        status: '${status}'
                    }, '*');
                    window.close();
                </script>
            </body>
        </html>
    `);
});

// Check Payment Status
app.post('/paytm/status', async (req, res) => {
    const { orderId } = req.body;
    
    res.json({
        body: {
            resultInfo: {
                resultStatus: 'TXN_SUCCESS',
                resultCode: '01',
                resultMsg: 'Payment Successful'
            }
        }
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/cafe.html`);
});
