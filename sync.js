// =============================================
// SYNC CONFIGURATION
// Change SYNC_URL to your JSONBin or API URL
// =============================================

const SYNC_BIN_ID = 'YOUR_BIN_ID'; // Get from jsonbin.io
const SYNC_API_KEY = 'YOUR_API_KEY'; // Get from jsonbin.io
const SYNC_URL = `https://api.jsonbin.io/v3/b/${SYNC_BIN_ID}`;

// Save payment data to cloud
async function syncPaymentToCloud(orderData) {
    try {
        await fetch(SYNC_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': SYNC_API_KEY
            },
            body: JSON.stringify({ currentPayment: orderData, timestamp: Date.now() })
        });
    } catch(e) {
        console.log('Sync failed, using localStorage only');
    }
}

// Get payment data from cloud
async function getPaymentFromCloud() {
    try {
        const response = await fetch(`${SYNC_URL}/latest`, {
            headers: { 'X-Master-Key': SYNC_API_KEY }
        });
        const data = await response.json();
        return data.record?.currentPayment || null;
    } catch(e) {
        return null;
    }
}
