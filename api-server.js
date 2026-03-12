const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

// In-memory storage (replace with database in production)
let orders = [];
let tokenCounter = 0;
let currentPayment = null;
let upiID = 'merchant@upi';

// Get all orders
app.get('/api/orders', (req, res) => {
    res.json({ success: true, orders: orders });
});

// Get token counter
app.get('/api/token', (req, res) => {
    res.json({ success: true, tokenCounter: tokenCounter });
});

// Create new order
app.post('/api/orders', (req, res) => {
    const order = req.body;
    tokenCounter++;
    order.token = tokenCounter;
    orders.unshift(order);
    
    if (order.payment === 'online') {
        currentPayment = order;
    }
    
    res.json({ success: true, order: order, tokenCounter: tokenCounter });
});

// Update order status
app.put('/api/orders/:token', (req, res) => {
    const token = parseInt(req.params.token);
    const { status } = req.body;
    
    const orderIndex = orders.findIndex(o => o.token === token);
    if (orderIndex !== -1) {
        orders[orderIndex].status = status;
        res.json({ success: true, order: orders[orderIndex] });
    } else {
        res.status(404).json({ success: false, message: 'Order not found' });
    }
});

// Get online orders (pending)
app.get('/api/orders/online/pending', (req, res) => {
    const onlineOrders = orders.filter(o => o.payment === 'online' && o.status !== 'paid');
    res.json({ success: true, orders: onlineOrders });
});

// Get current payment
app.get('/api/payment/current', (req, res) => {
    res.json({ success: true, payment: currentPayment });
});

// Set current payment
app.post('/api/payment/current', (req, res) => {
    currentPayment = req.body;
    res.json({ success: true, payment: currentPayment });
});

// UPI ID
app.get('/api/upi', (req, res) => {
    res.json({ success: true, upiID: upiID });
});

app.post('/api/upi', (req, res) => {
    upiID = req.body.upiID;
    res.json({ success: true, upiID: upiID });
});

// Paytm payment status
app.post('/paytm/status', (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n✅ API Server running on http://localhost:${PORT}`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`   GET    /api/orders`);
    console.log(`   POST   /api/orders`);
    console.log(`   PUT    /api/orders/:token`);
    console.log(`   GET    /api/payment/current`);
    console.log(`   GET    /api/orders/online/pending`);
    console.log(`\n🌐 CORS enabled - Works on any domain`);
});
