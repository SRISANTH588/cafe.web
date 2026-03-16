// Firebase Configuration
// =============================================
// GOOGLE APPS SCRIPT SYNC
// =============================================
const SYNC_URL = 'https://script.google.com/macros/s/AKfycbz564SK2y9vkJF2ajmAydPCq2yprI_F2Jl4lsvW2-7_7PoM6O_3r4aYkTudZMmVocka/exec';

// Save current payment to Google Sheet
async function saveCurrentPayment(orderData) {
    localStorage.setItem('currentPayment', JSON.stringify(orderData));
    try {
        const payload = encodeURIComponent(JSON.stringify(orderData));
        new Image().src = SYNC_URL + '?data=' + payload;
    } catch(e) {
        console.log('Sync failed');
    }
}

// Poll for paid notifications from payment.html
function startPaidNotificationPolling() {
    setInterval(async () => {
        try {
            const res = await fetch(SYNC_URL + '?getpaid=1&t=' + Date.now());
            const data = await res.json();
            if (data.paidToken) {
                // Mark order as paid
                const order = orders.find(o => o.token === data.paidToken);
                if (order && order.status !== 'paid') {
                    order.status = 'paid';
                    localStorage.setItem('ayyanOrders', JSON.stringify(orders));
                    displayOrders();
                    showNotification(`💰 Token #${data.paidToken} - ₹${data.total} Payment Received!`, 'success');
                    // Clear the paid notification from sheet
                    new Image().src = SYNC_URL + '?clearpaid=1';
                }
            }
        } catch(e) {}
    }, 3000);
}

// Save order to Google Sheet
async function saveOrder(order) {
    try {
        await fetch(SYNC_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: order, timestamp: Date.now() })
        });
    } catch(e) {
        console.log('Order sync failed');
    }
}

const menu = {
    coffee: { name: 'Coffee', price: 30 },
    tea: { name: 'Tea', price: 30 },
    horlicks: { name: 'Horlicks/Boost', price: 25 },
    maska: { name: 'Maska Bun', price: 45 }
};

// Custom items and stock status
let customItems = JSON.parse(localStorage.getItem('customItems') || '[]');
let stockStatus = JSON.parse(localStorage.getItem('stockStatus') || '{}');
let currentCategory = '';

// Orders storage
let orders = JSON.parse(localStorage.getItem('ayyanOrders') || '[]');
let tokenCounter = parseInt(localStorage.getItem('tokenCounter') || '0');
let currentOrder = {};
let pendingOrderAmount = 0;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadCustomItems();
    loadStockStatus();
    displayOrders();
    updateOrderSummary();
    updateStatistics();
    showPendingFloat();
    startPaidNotificationPolling();
    
    // Hide loading screen after 2 seconds
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 600);
    }, 2000);
});

// Show pending orders float
function showPendingFloat() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    
    let existingFloat = document.getElementById('pendingFloat');
    if (existingFloat) existingFloat.remove();
    
    if (pendingOrders.length === 0) return;
    
    const floatDiv = document.createElement('div');
    floatDiv.id = 'pendingFloat';
    floatDiv.style.cssText = 'position: fixed; right: 20px; top: 120px; width: 280px; background: linear-gradient(135deg, #6B4423, #8B5A3C); border: 3px solid #FFD700; border-radius: 15px; padding: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 999; animation: slideIn 0.5s ease;';
    
    floatDiv.innerHTML = `
        <style>
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .pending-item {
                background: rgba(255,215,0,0.2);
                border: 2px solid #FFD700;
                border-radius: 10px;
                padding: 0.8rem;
                margin-bottom: 0.8rem;
                transition: all 0.3s ease;
            }
            .pending-item:hover {
                transform: translateX(-5px);
                box-shadow: 0 5px 15px rgba(255,215,0,0.3);
            }
        </style>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 2px solid #FFD700; padding-bottom: 0.5rem;">
            <h3 style="margin: 0; color: #FFD700; font-size: 1.1rem;">🔔 Pending Payments</h3>
            <button onclick="document.getElementById('pendingFloat').remove()" style="background: none; border: none; color: #FFD700; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${pendingOrders.map(order => `
                <div class="pending-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 1.3rem; font-weight: bold; color: #FFD700;">🎫 #${order.token}</span>
                        <span style="font-size: 1.2rem; font-weight: bold; color: #fff;">₹${order.total}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: rgba(255,255,255,0.8); margin-bottom: 0.3rem;">⏰ ${order.time}</div>
                    <button onclick="markPendingPaid(${order.token})" style="width: 100%; padding: 0.5rem; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 0.5rem;">✅ Mark Paid</button>
                </div>
            `).join('')}
        </div>
    `;
    
    document.body.appendChild(floatDiv);
}

// Online Payment View
let currentOnlinePaymentIndex = 0;

function showOnlinePaymentView() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    if (pendingOrders.length === 0) {
        hideOnlinePaymentView();
        return;
    }
    
    currentOnlinePaymentIndex = 0;
    displayOnlinePayment();
}

function displayOnlinePayment() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    if (pendingOrders.length === 0) {
        hideOnlinePaymentView();
        return;
    }
    
    const order = pendingOrders[currentOnlinePaymentIndex];
    const allItems = getAllItems();
    const upiID = localStorage.getItem('upiID') || 'merchant@upi';
    const merchantName = 'Ayyan Cafe';
    const upiString = `upi://pay?pa=${upiID}&pn=${encodeURIComponent(merchantName)}&am=${order.total}&cu=INR&mode=02`;
    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}`;
    
    let itemsHtml = '';
    for (let item in order.items) {
        itemsHtml += `<div style="display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid #eee;"><span>${allItems[item]?.name || item} x ${order.items[item]}</span><span>₹${order.items[item] * (allItems[item]?.price || 0)}</span></div>`;
    }
    
    const orderTypeLabel = order.orderType === 'parcel' ? '📦 PARCEL' : '🍽️ DINE IN';
    const noteHtml = order.note ? `<div style="margin-top: 0.5rem; padding: 0.5rem; background: #fff3cd; border-radius: 5px; font-size: 0.9rem;"><strong>Note:</strong> ${order.note}</div>` : '';
    
    const rightSection = document.querySelector('.right-section');
    rightSection.innerHTML = `
        <div style="padding: 2rem; height: 100%; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h2 style="color: #6B4423; margin: 0;">📱 Online Payment</h2>
                <button onclick="window.hideOnlinePaymentView()" style="padding: 0.5rem 1rem; background: #dc3545; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">✕ Close</button>
            </div>
            
            <div style="background: white; border: 2px solid #6B4423; border-radius: 15px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <div style="display: flex; gap: 2rem; align-items: center;">
                    <div style="flex-shrink: 0;">
                        <img src="${qrImgSrc}" alt="Payment QR" style="width: 250px; height: 250px; border: 3px solid #6B4423; border-radius: 10px;">
                    </div>
                    <div style="flex: 1;">
                        <h3 style="color: #6B4423; margin-bottom: 1rem;">Order Details</h3>
                        <div style="margin-bottom: 0.5rem;"><strong>Token:</strong> #${order.token}</div>
                        <div style="margin-bottom: 0.5rem;"><strong>Date:</strong> ${order.date}</div>
                        <div style="margin-bottom: 0.5rem;"><strong>Time:</strong> ${order.time}</div>
                        <div style="margin-bottom: 0.5rem;"><strong>Type:</strong> ${orderTypeLabel}</div>
                        <div style="margin-bottom: 1rem;"><strong>Payment:</strong> ONLINE</div>
                        <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f8f9fa; border-radius: 5px; max-height: 150px; overflow-y: auto;">${itemsHtml}</div>
                        ${noteHtml}
                        <div style="font-weight: bold; font-size: 1.5rem; padding-top: 0.5rem; border-top: 2px solid #6B4423; color: #28a745; margin-bottom: 1rem;">Total: ₹${order.total}</div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="generateCurrentBill()" style="flex: 1; padding: 0.8rem; background: #6B4423; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">🖨️ Generate Bill</button>
                            <button onclick="markCurrentPaid()" style="flex: 1; padding: 0.8rem; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">✅ Mark Paid</button>
                            <button onclick="markCurrentOffline()" style="flex: 1; padding: 0.8rem; background: #ff9800; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">💵 Offline Payment</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function toggleOrderDetails() {
    const panel = document.getElementById('orderDetailsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function generateCurrentBill() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    const order = pendingOrders[currentOnlinePaymentIndex];
    if (order) {
        showBill(order);
        hideOnlinePaymentView();
    }
}

function nextOnlinePayment() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    if (currentOnlinePaymentIndex < pendingOrders.length - 1) {
        currentOnlinePaymentIndex++;
        displayOnlinePayment();
    }
}

function previousOnlinePayment() {
    if (currentOnlinePaymentIndex > 0) {
        currentOnlinePaymentIndex--;
        displayOnlinePayment();
    }
}

function markCurrentOffline() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    const order = pendingOrders[currentOnlinePaymentIndex];
    if (order) {
        order.payment = 'cash';
        order.status = 'paid';
        localStorage.setItem('ayyanOrders', JSON.stringify(orders));
        showNotification(`Payment changed to offline for Token #${order.token}`, 'success');
        showBill(order);
        
        const existingFloat = document.getElementById('pendingFloat');
        if (existingFloat) existingFloat.remove();
        
        hideOnlinePaymentView();
    }
}

function markCurrentPaid() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    const order = pendingOrders[currentOnlinePaymentIndex];
    if (order) {
        order.status = 'paid';
        localStorage.setItem('ayyanOrders', JSON.stringify(orders));
        showNotification(`Payment confirmed for Token #${order.token}`, 'success');
        showBill(order);
        
        const existingFloat = document.getElementById('pendingFloat');
        if (existingFloat) existingFloat.remove();
        
        hideOnlinePaymentView();
    }
}

function shareCurrentQR() {
    const pendingOrders = orders.filter(o => o.payment === 'online' && o.status === 'pending');
    const order = pendingOrders[currentOnlinePaymentIndex];
    if (order) {
        const upiID = localStorage.getItem('upiID') || 'merchant@upi';
        const upiString = `upi://pay?pa=${upiID}&pn=Ayyan%20Cafe&am=${order.total}&cu=INR&mode=02`;
        const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiString)}`;
        
        const a = document.createElement('a');
        a.href = qrImgSrc;
        a.download = `payment-qr-token${order.token}.png`;
        a.click();
        
        showNotification('QR Code downloaded!', 'success');
    }
}

window.hideOnlinePaymentView = function() {
    const existingFloat = document.getElementById('pendingFloat');
    if (existingFloat) existingFloat.remove();
    displayOrders();
}

// Mark pending order as paid
function markPendingPaid(tokenNum) {
    const order = orders.find(o => o.token === tokenNum);
    if (order) {
        order.status = 'paid';
        localStorage.setItem('ayyanOrders', JSON.stringify(orders));
        displayOrders();
        showPendingFloat();
        showBill(order);
        showNotification(`Payment confirmed for Token #${tokenNum}`, 'success');
    }
}


// Update quantity
function updateQuantity(item, change) {
    if (stockStatus[item] === false) return;
    
    const input = document.getElementById(`${item}-qty`);
    let value = parseInt(input.value) || 0;
    value = Math.max(0, value + change);
    input.value = value;
    
    if (value > 0) {
        currentOrder[item] = value;
        if (['coffee', 'tea', 'horlicks'].includes(item)) {
            document.getElementById(`${item}-sugar`).style.display = 'block';
        }
    } else {
        delete currentOrder[item];
        if (['coffee', 'tea', 'horlicks'].includes(item)) {
            document.getElementById(`${item}-sugar`).style.display = 'none';
            document.getElementById(`${item}-sugarfree-qty`).value = 0;
            document.getElementById(`${item}-sugarfree-control`).style.display = 'none';
            const radios = document.getElementsByName(`${item}-sugar-option`);
            radios.forEach(r => r.checked = false);
        }
    }
    
    updateOrderSummary();
}

function handleSugarOption(item, option) {
    const control = document.getElementById(`${item}-sugarfree-control`);
    const qtyInput = document.getElementById(`${item}-sugarfree-qty`);
    const itemQty = parseInt(document.getElementById(`${item}-qty`).value) || 0;
    
    if (option === 'free') {
        control.style.display = 'block';
        qtyInput.value = itemQty;
    } else {
        control.style.display = 'none';
        qtyInput.value = 0;
    }
    updateOrderSummary();
}

function updateSugarFree(item, change) {
    const input = document.getElementById(`${item}-sugarfree-qty`);
    const maxQty = parseInt(document.getElementById(`${item}-qty`).value) || 0;
    let value = parseInt(input.value) || 0;
    value = Math.max(0, Math.min(maxQty, value + change));
    input.value = value;
    updateOrderSummary();
}

// Update order summary
function updateOrderSummary() {
    const orderItems = document.getElementById('orderItems');
    const currentOrderTotal = document.getElementById('currentOrderTotal');
    const allItems = getAllItems();
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value;
    const isParcel = orderType === 'parcel';
    
    let html = '';
    let total = 0;
    
    for (let item in currentOrder) {
        const qty = currentOrder[item];
        const basePrice = allItems[item].price;
        const itemPrice = isParcel ? basePrice + 5 : basePrice;
        const itemTotal = qty * itemPrice;
        total += itemTotal;
        
        html += `
            <div class="order-item">
                <span>${allItems[item].name} x ${qty}</span>
                <span>₹${itemTotal}</span>
            </div>
        `;
    }
    
    // Add item-specific sugar-free
    ['coffee', 'tea', 'horlicks'].forEach(item => {
        const qtyInput = document.getElementById(`${item}-sugarfree-qty`);
        const sugarFreeQty = qtyInput ? parseInt(qtyInput.value) || 0 : 0;
        if (sugarFreeQty > 0 && currentOrder[item]) {
            const sugarFreeTotal = sugarFreeQty * 10;
            html += `
                <div class="order-item">
                    <span>${allItems[item].name} - Sugar Free x ${sugarFreeQty}</span>
                    <span>₹${sugarFreeTotal}</span>
                </div>
            `;
            total += sugarFreeTotal;
        }
    });
    
    orderItems.innerHTML = html || '<p style="color: rgba(255,255,255,0.5);">No items added</p>';
    currentOrderTotal.textContent = total;
}

// Add quick note
function addQuickNote(note) {
    const noteTextarea = document.getElementById('orderNote');
    const currentNote = noteTextarea.value.trim();
    
    if (currentNote) {
        noteTextarea.value = currentNote + ', ' + note;
    } else {
        noteTextarea.value = note;
    }
}

function confirmOrder(paymentMethod) {
    if (Object.keys(currentOrder).length === 0) {
        alert('Please add items to your order');
        return;
    }
    
    const total = parseInt(document.getElementById('currentOrderTotal').textContent);
    
    if (paymentMethod === 'cafecard') {
        document.getElementById('cafeCardBillAmount').textContent = total;
        document.getElementById('cafeCardNumber').value = '';
        document.getElementById('cafeCardModal').style.display = 'flex';
    } else if (paymentMethod === 'online') {
        const order = createOrderAndReturn('online', total);
        if (order) {
            const allItems = getAllItems();
            const billItems = [];
            for (let item in order.items) {
                billItems.push({
                    name: allItems[item]?.name || item,
                    qty: order.items[item],
                    price: allItems[item]?.price || 0
                });
            }
            const upiId = localStorage.getItem('upiID') || 'merchant@upi';
            const orderData = {
                token: order.token,
                total: total,
                items: billItems,
                upiId: upiId,
                cafeName: localStorage.getItem('cafeName') || 'Ayyan Cafe'
            };
            
            // Save to localStorage for the payment page
            localStorage.setItem('currentPayment', JSON.stringify(orderData));
            saveCurrentPayment(orderData);
            saveOrder(order);
            
            showNotification('Payment data updated! Check payment window.', 'success');
        }
    } else {
        createOrder(paymentMethod, total);
    }
}



// Create order and return it
function createOrderAndReturn(paymentMethod, total) {
    if (tokenCounter >= 300) {
        alert('Token limit reached (300). Please reset the token counter.');
        return null;
    }
    
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const note = document.getElementById('orderNote').value.trim();
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value || 'dine-in';
    
    // Collect item-specific sugar-free data
    const itemSugarFree = {};
    ['coffee', 'tea', 'horlicks'].forEach(item => {
        const qty = parseInt(document.getElementById(`${item}-sugarfree-qty`)?.value) || 0;
        if (qty > 0) itemSugarFree[item] = qty;
    });
    
    const order = {
        token: ++tokenCounter,
        date: istTime.toLocaleDateString('en-IN'),
        time: istTime.toLocaleTimeString('en-IN'),
        items: {...currentOrder},
        total: total,
        payment: paymentMethod,
        status: 'pending',
        note: note,
        itemSugarFree: itemSugarFree,
        orderType: orderType
    };
    
    orders.unshift(order);
    localStorage.setItem('ayyanOrders', JSON.stringify(orders));
    localStorage.setItem('tokenCounter', tokenCounter.toString());
    
    updateStatistics();
    
    // Reset current order
    currentOrder = {};
    document.querySelectorAll('[id$="-qty"]').forEach(input => input.value = 0);
    document.getElementById('orderNote').value = '';
    document.querySelector('input[name="orderType"][value="dine-in"]').checked = true;
    
    // Reset item-specific sugar-free
    ['coffee', 'tea', 'horlicks'].forEach(item => {
        const sugarInput = document.getElementById(`${item}-sugarfree-qty`);
        if (sugarInput) sugarInput.value = 0;
        const sugarDiv = document.getElementById(`${item}-sugar`);
        if (sugarDiv) sugarDiv.style.display = 'none';
    });
    
    updateOrderSummary();
    
    displayOrders();
    
    return order;
}

// Call token number using speech synthesis
function callToken(tokenNumber) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(`Token number ${tokenNumber}. Token number ${tokenNumber}`);
        utterance.lang = 'en-US';
        utterance.rate = 0.7;
        utterance.pitch = 0.8;
        utterance.volume = 1;
        
        // Wait for voices to load and select male voice
        const setVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            const maleVoice = voices.find(voice => 
                (voice.name.includes('Male') || 
                 voice.name.includes('Daniel') || 
                 voice.name.includes('Alex') ||
                 voice.name.includes('Fred') ||
                 voice.name.includes('Tom')) && 
                voice.lang.includes('en')
            ) || voices.find(voice => voice.lang.includes('en-US'));
            
            if (maleVoice) {
                utterance.voice = maleVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        };
        
        if (window.speechSynthesis.getVoices().length > 0) {
            setVoice();
        } else {
            window.speechSynthesis.onvoiceschanged = setVoice;
        }
        
        showNotification(`Calling Token #${tokenNumber}`, 'info');
    } else {
        alert(`Token Number: ${tokenNumber}`);
    }
}

// Create order
function createOrder(paymentMethod, total) {
    // Check if token limit reached
    if (tokenCounter >= 300) {
        alert('Token limit reached (300). Please reset the token counter.');
        return;
    }
    
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const note = document.getElementById('orderNote').value.trim();
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value || 'dine-in';
    
    // Collect item-specific sugar-free data
    const itemSugarFree = {};
    ['coffee', 'tea', 'horlicks'].forEach(item => {
        const qty = parseInt(document.getElementById(`${item}-sugarfree-qty`)?.value) || 0;
        if (qty > 0) itemSugarFree[item] = qty;
    });
    
    // Check if premium customer with free biscuits
    let isPremiumCustomer = false;
    let hasFreeBiscuits = false;
    if (paymentMethod === 'cafecard' || paymentMethod === 'cafecard+cash') {
        const cardNumber = document.getElementById('cafeCardNumber')?.value.trim();
        const card = cafeCards.find(c => c.cardNumber === cardNumber);
        if (card && card.isPremium) {
            isPremiumCustomer = true;
            hasFreeBiscuits = document.getElementById('addFreeBiscuits')?.checked || false;
        }
    }
    
    const order = {
        token: ++tokenCounter,
        date: istTime.toLocaleDateString('en-IN'),
        time: istTime.toLocaleTimeString('en-IN'),
        items: {...currentOrder},
        total: total,
        payment: paymentMethod,
        status: 'pending',
        note: note,
        itemSugarFree: itemSugarFree,
        orderType: orderType,
        isPremiumCustomer: isPremiumCustomer,
        hasFreeBiscuits: hasFreeBiscuits
    };
    
    orders.unshift(order);
    localStorage.setItem('ayyanOrders', JSON.stringify(orders));
    localStorage.setItem('tokenCounter', tokenCounter.toString());
    
    // Update statistics
    updateStatistics();
    
    // Show bill
    showBill(order);
    
    // Reset current order
    currentOrder = {};
    document.querySelectorAll('[id$="-qty"]').forEach(input => input.value = 0);
    document.getElementById('orderNote').value = '';
    document.querySelector('input[name="orderType"][value="dine-in"]').checked = true;
    
    // Reset item-specific sugar-free
    ['coffee', 'tea', 'horlicks'].forEach(item => {
        const sugarInput = document.getElementById(`${item}-sugarfree-qty`);
        if (sugarInput) sugarInput.value = 0;
        const sugarDiv = document.getElementById(`${item}-sugar`);
        if (sugarDiv) sugarDiv.style.display = 'none';
    });
    
    updateOrderSummary();
    
    // Update orders display
    displayOrders();
}

// Show bill with QR code for online payment
function showBillWithQR(order) {
    const billContent = document.getElementById("billContent");
    const allItems = getAllItems();
    const isParcel = order.orderType === "parcel";
    let itemsHtml = "";
    for (let item in order.items) {
        const qty = order.items[item];
        const basePrice = allItems[item]?.price || 0;
        const itemPrice = isParcel ? basePrice + 5 : basePrice;
        const itemTotal = qty * itemPrice;
        itemsHtml += `<div class="bill-item"><span>${allItems[item]?.name || item} x ${qty}</span><span>₹${itemTotal}</span></div>`;
    }
    const upiID = localStorage.getItem("upiID") || "merchant@upi";
    const upiString = `upi://pay?pa=${upiID}&pn=Ayyan%20Cafe&am=${order.total}&cu=INR&mode=02`;
    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
    billContent.innerHTML = `<div class="bill-header"><h2>☕ Ayyan Cafe</h2><p>Scan QR to Pay</p></div><div style="text-align: center; margin: 1rem 0;"><img src="${qrImgSrc}" alt="Payment QR" style="width: 200px; height: 200px; border: 2px solid #6B4423; border-radius: 8px;"></div><div class="bill-info"><p><strong>Token:</strong> #${order.token}</p><p><strong>Total:</strong> ₹${order.total}</p></div><div class="bill-items">${itemsHtml}</div><div style="text-align: center; margin-top: 1rem;"><button onclick="confirmOnlinePayment()" style="width: 100%; padding: 1rem; background: #28a745; color: white; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: bold; cursor: pointer; margin-bottom: 0.5rem;">✅ Payment Done - Send to Kitchen</button></div>`;
    document.getElementById("billModal").style.display = "flex";
}
function confirmOnlinePayment() {
    createOrder("online", pendingOrderAmount);
    closeBill();
}

// Show bill
function showBill(order) {
    const billContent = document.getElementById('billContent');
    const allItems = getAllItems();
    const isParcel = order.orderType === 'parcel';
    
    // Get branding from localStorage
    const cafeName = localStorage.getItem('cafeName') || 'Ayyan Cafe';
    const cafeTagline = localStorage.getItem('cafeTagline') || 'Where Every Sip Tells a Story';
    
    let itemsHtml = '';
    for (let item in order.items) {
        const qty = order.items[item];
        const basePrice = allItems[item]?.price || 0;
        const itemPrice = isParcel ? basePrice + 5 : basePrice;
        const itemTotal = qty * itemPrice;
        
        itemsHtml += `
            <div class="bill-item">
                <span>${allItems[item]?.name || item} x ${qty}</span>
                <span>₹${itemTotal}</span>
            </div>
        `;
    }
    
    if (order.sugarFree) {
        itemsHtml += `
            <div class="bill-item">
                <span>Sugar Free</span>
                <span>₹10</span>
            </div>
        `;
    }
    
    const noteHtml = order.note ? `<p style="margin-top: 1rem; padding: 0.5rem; background: #fff3cd; border-radius: 5px;"><strong>Note:</strong> ${order.note}</p>` : '';
    const orderTypeLabel = order.orderType === 'parcel' ? 'PARCEL' : 'DINE IN';
    const premiumLabel = order.isPremiumCustomer ? '<p style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 0.5rem; border-radius: 5px; text-align: center; font-weight: bold; margin-top: 0.5rem;">⭐ PREMIUM CUSTOMER</p>' : '';
    const freeBiscuitsLabel = order.hasFreeBiscuits ? '<p style="background: #28a745; color: white; padding: 0.5rem; border-radius: 5px; text-align: center; font-weight: bold; margin-top: 0.5rem;">🍪 FREE BISCUITS INCLUDED</p>' : '';
    
    billContent.innerHTML = `
        <div class="bill-header">
            <h2>☕ ${cafeName}</h2>
            <p>${cafeTagline}</p>
        </div>
        <div class="bill-info">
            <p><strong>Token Number:</strong> #${order.token}</p>
            <p><strong>Date:</strong> ${order.date}</p>
            <p><strong>Time:</strong> ${order.time}</p>
            <p><strong>Type:</strong> ${orderTypeLabel}</p>
            <p><strong>Payment:</strong> ${order.payment.toUpperCase()}</p>
        </div>
        <div class="bill-items">
            ${itemsHtml}
        </div>
        ${noteHtml}
        ${premiumLabel}
        ${freeBiscuitsLabel}
        <div class="bill-total">
            Total: ₹${order.total}
        </div>
        <div class="bill-footer">
            <p style="text-align: center; margin: 1rem 0; font-size: 0.9rem;">Please collect your order at Token #${order.token}</p>
            <div class="terms-conditions">
                <h4>Terms & Conditions:</h4>
                <ul>
                    <li><strong>Token is needed for order delivery</strong></li>
                    <li>Order preparation time: Minimum 5 minutes</li>
                    <li>All items are non-refundable</li>
                    <li>No exchange after billing</li>
                    <li>Valid for single use only</li>
                </ul>
            </div>
            <p style="text-align: center; margin-top: 1rem; font-size: 0.9rem; font-style: italic;">Visit Again! 😊</p>
        </div>
    `;
    
    // Show cash calculator if payment is cash
    const cashCalculator = document.getElementById('cashCalculator');
    if (order.payment === 'cash') {
        cashCalculator.style.display = 'block';
        document.getElementById('cashTotal').value = order.total;
        document.getElementById('cashGiven').value = '';
        document.getElementById('changeAmount').value = 0;
    } else {
        cashCalculator.style.display = 'none';
    }
    
    document.getElementById('billModal').style.display = 'flex';
}

// Calculate change
function calculateChange() {
    const total = parseInt(document.getElementById('cashTotal').value) || 0;
    const cashGiven = parseInt(document.getElementById('cashGiven').value) || 0;
    const change = cashGiven - total;
    document.getElementById('changeAmount').value = change >= 0 ? change : 0;
}

// Display orders
function displayOrders(filteredOrders = null) {
    const ordersList = document.getElementById('ordersList');
    const allItems = getAllItems();
    const ordersToDisplay = filteredOrders || orders;
    
    if (ordersToDisplay.length === 0) {
        ordersList.innerHTML = '<p class="no-orders">No orders yet</p>';
        return;
    }
    
    let html = '';
    ordersToDisplay.forEach((order, index) => {
        const actualIndex = orders.indexOf(order);
        let itemsHtml = '';
        for (let item in order.items) {
            itemsHtml += `<div>${allItems[item]?.name || item} x ${order.items[item]}</div>`;
        }
        
        if (order.sugarFree) {
            itemsHtml += `<div style="color: #28a745; font-weight: bold;">✓ Sugar Free (+₹10)</div>`;
        }
        
        const orderTypeLabel = order.orderType === 'parcel' ? '📦 PARCEL' : '🍽️ DINE IN';
        
        const noteHtml = order.note ? `<div style="margin-top: 0.5rem; padding: 0.5rem; background: #fff3cd; border-radius: 5px; font-size: 0.9rem;"><strong>Note:</strong> ${order.note}</div>` : '';
        
        html += `
            <div class="order-card">
                <div class="order-header">
                    <div class="token-number">Token #${order.token}</div>
                    <div class="order-status ${order.status === 'served' ? 'status-served' : 'status-pending'}">
                        ${order.status === 'served' ? 'Served' : 'Pending'}
                    </div>
                </div>
                <div class="order-details">
                    <div class="order-meta">
                        📅 ${order.date} | ⏰ ${order.time} | ${orderTypeLabel} | 💳 ${order.payment.toUpperCase()}
                    </div>
                    <div class="order-items-list">
                        ${itemsHtml}
                    </div>
                    ${noteHtml}
                    <div class="order-total">Total: ₹${order.total}</div>
                </div>
                <div class="order-actions">
                    <button class="action-btn edit-btn" onclick="editOrder(${actualIndex})" title="Edit this order">
                        <span class="btn-icon">✏️</span>
                        <span class="btn-text">Edit</span>
                    </button>
                    <button class="action-btn print-btn" onclick="printOrderBill(${actualIndex})" title="Print bill">
                        <span class="btn-icon">🖨️</span>
                        <span class="btn-text">Print</span>
                    </button>
                    <button class="action-btn" onclick="callToken(${order.token})" title="Call token number" style="background: #ff9800; color: white;">
                        <span class="btn-icon">🔊</span>
                        <span class="btn-text">Call</span>
                    </button>
                    <button class="action-btn serve-btn" onclick="toggleServed(${actualIndex})" title="${order.status === 'served' ? 'Mark as pending' : 'Mark as served'}">
                        <span class="btn-icon">${order.status === 'served' ? '❌' : '✅'}</span>
                        <span class="btn-text">${order.status === 'served' ? 'Unserve' : 'Served'}</span>
                    </button>
                    <button class="action-btn delete-btn" onclick="confirmDelete(${actualIndex})" title="Delete this order">
                        <span class="btn-icon">🗑️</span>
                        <span class="btn-text">Delete</span>
                    </button>
                </div>
            </div>
        `;
    });
    
    ordersList.innerHTML = html;
    updateStatistics();
}

// Filter orders by date
function filterOrdersByDate() {
    const dateInput = document.getElementById('dateFilter').value;
    if (!dateInput) {
        displayOrders();
        return;
    }
    
    const selectedDate = new Date(dateInput).toLocaleDateString('en-IN');
    const filteredOrders = orders.filter(order => order.date === selectedDate);
    displayOrders(filteredOrders);
    
    if (filteredOrders.length === 0) {
        showNotification(`No orders found for ${selectedDate}`, 'info');
    } else {
        showNotification(`Showing ${filteredOrders.length} orders for ${selectedDate}`, 'success');
    }
}

// Edit order
function editOrder(index) {
    const order = orders[index];
    const allItems = getAllItems();
    
    // Load order items to left side
    currentOrder = {...order.items};
    
    for (let item in allItems) {
        const input = document.getElementById(`${item}-qty`);
        if (input) input.value = currentOrder[item] || 0;
    }
    
    // Load note and sugar-free addon
    document.getElementById('orderNote').value = order.note || '';
    
    // Load order type
    const orderType = order.orderType || 'dine-in';
    document.querySelector(`input[name="orderType"][value="${orderType}"]`).checked = true;
    
    updateOrderSummary();
    
    // Delete the old order
    orders.splice(index, 1);
    localStorage.setItem('ayyanOrders', JSON.stringify(orders));
    displayOrders();
    
    // Scroll to top with notification
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification(`Editing Order #${order.token} - Make changes and confirm`, 'info');
}

// Toggle served status
function toggleServed(index) {
    const oldStatus = orders[index].status;
    orders[index].status = oldStatus === 'served' ? 'pending' : 'served';
    localStorage.setItem('ayyanOrders', JSON.stringify(orders));
    displayOrders();
    
    const newStatus = orders[index].status;
    const message = newStatus === 'served' ? 'Order marked as served ✅' : 'Order marked as pending ⏳';
    showNotification(message, 'success');
}

// Delete order
function deleteOrder(index) {
    orders.splice(index, 1);
    localStorage.setItem('ayyanOrders', JSON.stringify(orders));
    displayOrders();
}

// Confirm delete with advanced dialog
function confirmDelete(index) {
    const order = orders[index];
    if (confirm(`Delete Order #${order.token}?\n\nTotal: ₹${order.total}\nStatus: ${order.status}\n\nThis action cannot be undone!`)) {
        deleteOrder(index);
        showNotification('Order deleted successfully', 'error');
    }
}

// Print bill
function printBill() {
    const billContent = document.getElementById('billContent').innerHTML;
    const cashGiven = parseInt(document.getElementById('cashGiven').value) || 0;
    const total = parseInt(document.getElementById('cashTotal').textContent) || 0;
    
    let changeSection = '';
    if (cashGiven > 0 && cashGiven >= total) {
        const change = cashGiven - total;
        changeSection = `
            <div style="margin-top: 8px; padding: 5px; border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
                <div style="text-align: right; font-size: 8px; padding: 2px 0;">
                    <div>Cash Received: ₹${cashGiven}</div>
                </div>
                <div style="text-align: right; font-size: 9px; font-weight: bold; padding: 2px 0;">
                    <div>Change to Return: ₹${change}</div>
                </div>
            </div>
        `;
    }
    
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Bill - Ayyan Cafe</title>
            <style>
                @page { size: 2in auto; margin: 0; }
                body { width: 2in; margin: 0; padding: 0.1in; font-family: monospace; font-size: 9px; }
                .bill-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
                .bill-header h2 { font-size: 12px; margin: 2px 0; }
                .bill-header p { font-size: 8px; margin: 2px 0; }
                .bill-info p { font-size: 8px; margin: 2px 0; }
                .bill-items { margin: 5px 0; }
                .bill-item { display: flex; justify-content: space-between; font-size: 8px; padding: 2px 0; border-bottom: 1px dotted #ccc; }
                .bill-total { border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; font-size: 10px; font-weight: bold; text-align: right; }
                .bill-footer { margin-top: 5px; border-top: 1px dashed #000; padding-top: 5px; }
                .bill-footer p { font-size: 7px; text-align: center; margin: 3px 0; }
                .terms-conditions { margin: 5px 0; }
                .terms-conditions h4 { font-size: 8px; margin: 3px 0; }
                .terms-conditions ul { list-style: none; padding: 0; margin: 0; }
                .terms-conditions li { font-size: 7px; padding: 1px 0; }
                img { max-width: 100%; height: auto; }
            </style>
        </head>
        <body>
            ${billContent}${changeSection}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
}

// Toggle stock status
function toggleStock(item) {
    stockStatus[item] = !stockStatus[item];
    localStorage.setItem('stockStatus', JSON.stringify(stockStatus));
    loadStockStatus();
    showNotification(`${getAllItems()[item].name} ${stockStatus[item] === false ? 'Paused' : 'Available'}`, 'info');
}

// Load stock status
function loadStockStatus() {
    const allItems = getAllItems();
    for (let item in allItems) {
        const btn = document.getElementById(`${item}-stock`);
        const menuItem = btn?.closest('.menu-item');
        if (btn) {
            if (stockStatus[item] === false) {
                btn.classList.add('paused');
                btn.textContent = '||';
                menuItem?.classList.add('paused');
            } else {
                btn.classList.remove('paused');
                btn.textContent = '✓';
                menuItem?.classList.remove('paused');
            }
        }
    }
}

// Show add item modal
function showAddItemModal(category) {
    currentCategory = category;
    const titles = {
        coffee: 'Add Coffee Item',
        tea: 'Add Tea Item',
        horlicks: 'Add Horlicks/Boost Item',
        maska: 'Add Snack Item'
    };
    document.getElementById('modalTitle').textContent = titles[category] || 'Add Custom Item';
    document.getElementById('addItemModal').style.display = 'flex';
}

// Close add item modal
function closeAddItem() {
    document.getElementById('addItemModal').style.display = 'none';
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemPrice').value = '';
}

// Add custom item
function addCustomItem() {
    const name = document.getElementById('newItemName').value.trim();
    const price = parseInt(document.getElementById('newItemPrice').value);
    
    if (!name || !price || price <= 0) {
        alert('Please enter valid item name and price');
        return;
    }
    
    const id = 'custom_' + Date.now();
    customItems.push({ id, name, price, category: currentCategory });
    localStorage.setItem('customItems', JSON.stringify(customItems));
    
    loadCustomItems();
    closeAddItem();
    showNotification(`${name} added successfully`, 'success');
}

// Load custom items
function loadCustomItems() {
    const categories = ['coffee', 'tea', 'horlicks', 'maska'];
    
    categories.forEach(category => {
        const container = document.getElementById(`custom${category.charAt(0).toUpperCase() + category.slice(1)}`);
        const categoryItems = customItems.filter(item => item.category === category);
        
        container.innerHTML = categoryItems.map(item => `
            <div class="menu-item" id="item-${item.id}">
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <p class="price">₹${item.price}</p>
                </div>
                <div class="custom-item-actions">
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                        <input type="number" id="${item.id}-qty" value="0" min="0" readonly>
                        <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                        <button class="stock-btn" id="${item.id}-stock" onclick="toggleStock('${item.id}')">✓</button>
                        <button class="delete-item-btn" onclick="deleteCustomItem('${item.id}')">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    });
    
    loadStockStatus();
}

// Delete custom item
function deleteCustomItem(id) {
    if (confirm('Delete this item?')) {
        customItems = customItems.filter(item => item.id !== id);
        localStorage.setItem('customItems', JSON.stringify(customItems));
        delete stockStatus[id];
        localStorage.setItem('stockStatus', JSON.stringify(stockStatus));
        loadCustomItems();
        showNotification('Item deleted', 'error');
    }
}

// Get all items (default + custom)
function getAllItems() {
    const allItems = {...menu};
    customItems.forEach(item => {
        allItems[item.id] = { name: item.name, price: item.price };
    });
    return allItems;
}

// Close modals
function closeBill() {
    document.getElementById('billModal').style.display = 'none';
}



// Reset token counter
function resetToken() {
    if (confirm('Are you sure you want to reset the token counter to 0? This cannot be undone.')) {
        tokenCounter = 0;
        localStorage.setItem('tokenCounter', '0');
        updateStatistics();
        alert('Token counter has been reset to 0');
    }
}

// Update statistics
function updateStatistics() {
    document.getElementById('tokenCounter').textContent = tokenCounter;
    document.getElementById('totalOrders').textContent = orders.length;
    
    let totalAmount = 0;
    orders.forEach(order => {
        totalAmount += order.total;
    });
    document.getElementById('totalAmount').textContent = totalAmount;
}

// Clear all orders
function clearAllOrders() {
    if (confirm('Are you sure you want to delete ALL orders? This cannot be undone.')) {
        orders = [];
        tokenCounter = 0;
        localStorage.setItem('ayyanOrders', '[]');
        localStorage.setItem('tokenCounter', '0');
        displayOrders();
        updateStatistics();
        alert('All orders have been cleared!');
    }
}

// Print order bill
function printOrderBill(index) {
    const order = orders[index];
    showBill(order);
}
// Notification system
function showNotification(message, type = 'success') {
    const bar = document.getElementById('notifBar');
    const colors = { success: '#28a745', error: '#dc3545', info: '#007bff', warning: '#ffc107' };
    bar.textContent = message;
    bar.style.background = colors[type] || '#28a745';
    bar.style.transform = 'translateY(0)';
    clearTimeout(bar._timer);
    bar._timer = setTimeout(() => { bar.style.transform = 'translateY(-100%)'; }, 4000);
}

// Daily Statement
function showDailyStatement() {
    const today = new Date().toLocaleDateString('en-IN');
    const todayOrders = orders.filter(order => order.date === today);
    const allItems = getAllItems();
    
    let totalRevenue = 0;
    let cashAmount = 0;
    let onlineAmount = 0;
    
    todayOrders.forEach(order => {
        totalRevenue += order.total;
        if (order.payment === 'cash') {
            cashAmount += order.total;
        } else {
            onlineAmount += order.total;
        }
    });
    
    const statementContent = document.getElementById('statementContent');
    statementContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #6B4423;">
            <h2 style="margin: 0; color: #6B4423;">☕ Ayyan Cafe</h2>
            <h3 style="margin: 0.5rem 0;">Daily Statement</h3>
            <p style="margin: 0.3rem 0;">${today}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.8rem 0; border-bottom: 2px solid #ddd;">
                <strong>Total Orders:</strong>
                <span style="font-size: 1.2rem; font-weight: bold;">${todayOrders.length}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.8rem 0; border-bottom: 2px solid #ddd;">
                <strong>Cash:</strong>
                <span style="font-size: 1.2rem; font-weight: bold; color: #28a745;">₹${cashAmount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.8rem 0; border-bottom: 2px solid #ddd;">
                <strong>Online:</strong>
                <span style="font-size: 1.2rem; font-weight: bold; color: #007bff;">₹${onlineAmount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 1rem 0; margin-top: 0.5rem; border-top: 3px solid #6B4423;">
                <strong style="font-size: 1.3rem;">Total Revenue:</strong>
                <span style="font-size: 1.5rem; font-weight: bold; color: #6B4423;">₹${totalRevenue}</span>
            </div>
        </div>
        
        <div>
            <h4 style="margin-bottom: 1rem; color: #6B4423; border-bottom: 2px solid #6B4423; padding-bottom: 0.5rem;">Orders</h4>
            ${todayOrders.length === 0 ? '<p style="text-align: center; color: #999; padding: 2rem;">No orders today</p>' : todayOrders.map(order => `
                <div style="background: #fff; border: 2px solid #6B4423; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: bold;">
                        <span>Token #${order.token}</span>
                        <span>${order.time}</span>
                    </div>
                    <div style="background: #f8f9fa; padding: 0.8rem; border-radius: 5px; margin: 0.5rem 0;">
                        ${Object.keys(order.items).map(item => `
                            <div style="display: flex; justify-content: space-between; padding: 0.3rem 0;">
                                <span>${allItems[item]?.name || item} x ${order.items[item]}</span>
                                <span>₹${order.items[item] * (allItems[item]?.price || 0)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 0.5rem; border-top: 2px solid #6B4423; font-weight: bold;">
                        <span>${order.payment === 'cash' ? 'CASH' : 'ONLINE'}</span>
                        <span style="color: #6B4423;">₹${order.total}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('statementModal').style.display = 'flex';
}

function closeStatement() {
    document.getElementById('statementModal').style.display = 'none';
}

function printStatement() {
    const printWindow = window.open('', '_blank');
    const statementContent = document.getElementById('statementContent').innerHTML;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Daily Statement - Ayyan Cafe</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                h2, h3, h4 { color: #6B4423; }
                @media print {
                    body { padding: 10px; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            ${statementContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}



// Toggle QR Edit Panel
function toggleQREdit() {
    const panel = document.getElementById('qrEditPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
        const savedUPI = localStorage.getItem('upiID') || '';
        document.getElementById('upiIDInput').value = savedUPI;
    }
}

// Save UPI ID
function saveUPIID() {
    const upiID = document.getElementById('upiIDInput').value.trim();
    if (!upiID) {
        alert('Please enter a valid UPI ID');
        return;
    }
    localStorage.setItem('upiID', upiID);
    showNotification('UPI ID saved successfully', 'success');
    toggleQREdit();
}



// Cafe Card Settings
let cafeCardEnabled = localStorage.getItem('cafeCardEnabled') !== 'false';
let freeBiscuitsEnabled = localStorage.getItem('freeBiscuitsEnabled') !== 'false';

// Show Settings Panel
function showSettingsPanel() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('cafeCardToggle').checked = cafeCardEnabled;
    document.getElementById('freeBiscuitsToggle').checked = freeBiscuitsEnabled;
    toggleMenu();
    updatePaymentButtons();
}

// Close Settings
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

// Show Branding Settings
function showBrandingSettings() {
    const cafeName = localStorage.getItem('cafeName') || 'Ayyan Cafe';
    const cafeTagline = localStorage.getItem('cafeTagline') || 'Where Every Sip Tells a Story';
    const cafeSubtitle = localStorage.getItem('cafeSubtitle') || 'Premium Beverages & Delights';
    
    document.getElementById('cafeNameInput').value = cafeName;
    document.getElementById('cafeTaglineInput').value = cafeTagline;
    document.getElementById('cafeSubtitleInput').value = cafeSubtitle;
    
    document.getElementById('brandingModal').style.display = 'flex';
    toggleMenu();
}

// Close Branding Settings
function closeBrandingSettings() {
    document.getElementById('brandingModal').style.display = 'none';
}

// Save Branding Settings
function saveBrandingSettings() {
    const cafeName = document.getElementById('cafeNameInput').value.trim();
    const cafeTagline = document.getElementById('cafeTaglineInput').value.trim();
    const cafeSubtitle = document.getElementById('cafeSubtitleInput').value.trim();
    
    if (!cafeName) {
        alert('Please enter a cafe name');
        return;
    }
    
    localStorage.setItem('cafeName', cafeName);
    localStorage.setItem('cafeTagline', cafeTagline);
    localStorage.setItem('cafeSubtitle', cafeSubtitle);
    
    // Update page immediately
    updateBranding();
    
    closeBrandingSettings();
    showNotification('Branding updated successfully! Refresh to see all changes.', 'success');
}

// Update Branding on Page
function updateBranding() {
    const cafeName = localStorage.getItem('cafeName') || 'Ayyan Cafe';
    const cafeTagline = localStorage.getItem('cafeTagline') || 'Where Every Sip Tells a Story';
    const cafeSubtitle = localStorage.getItem('cafeSubtitle') || 'Premium Beverages & Delights';
    
    // Update header
    const headerH1 = document.querySelector('.header h1');
    if (headerH1) headerH1.textContent = '☕ ' + cafeName;
    
    const taglineP = document.querySelector('.header .tagline');
    if (taglineP) taglineP.textContent = cafeTagline;
    
    const subtitleP = document.querySelector('.header .subtitle');
    if (subtitleP) subtitleP.textContent = cafeSubtitle;
    
    // Update loading screen
    const loadingH1 = document.querySelector('#loadingScreen h1');
    if (loadingH1) loadingH1.textContent = cafeName;
    
    const loadingP = document.querySelector('#loadingScreen p');
    if (loadingP) loadingP.textContent = cafeTagline;
}

// Initialize branding on page load
document.addEventListener('DOMContentLoaded', function() {
    updateBranding();
});

// Toggle Cafe Card
function toggleCafeCard() {
    cafeCardEnabled = document.getElementById('cafeCardToggle').checked;
    localStorage.setItem('cafeCardEnabled', cafeCardEnabled);
    updatePaymentButtons();
    showNotification(`Cafe Card Payment ${cafeCardEnabled ? 'Enabled' : 'Disabled'}`, 'success');
}

// Toggle Free Biscuits
function toggleFreeBiscuits() {
    freeBiscuitsEnabled = document.getElementById('freeBiscuitsToggle').checked;
    localStorage.setItem('freeBiscuitsEnabled', freeBiscuitsEnabled);
    showNotification(`Free Biscuits ${freeBiscuitsEnabled ? 'Enabled' : 'Disabled'}`, 'success');
}

// Update Payment Buttons
function updatePaymentButtons() {
    const cafeCardBtn = document.querySelector('.payment-btn[onclick="confirmOrder(\'cafecard\')"]');
    if (cafeCardBtn) {
        cafeCardBtn.style.display = cafeCardEnabled ? 'block' : 'none';
    }
}

// Cafe Card System
let cafeCards = JSON.parse(localStorage.getItem('cafeCards') || '[]');

// Toggle Menu
function toggleMenu() {
    const menu = document.getElementById('menuPanel');
    const qrPanel = document.getElementById('qrEditPanel');
    qrPanel.style.display = 'none';
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Show Cafe Card Panel
function showCafeCardPanel() {
    document.getElementById('cafeCardPanelModal').style.display = 'flex';
    showCardSection('create');
    displayCafeCards();
    toggleMenu();
}

// Show Card Section
function showCardSection(section) {
    document.getElementById('createSection').style.display = 'none';
    document.getElementById('addmoneySection').style.display = 'none';
    document.getElementById('viewSection').style.display = 'none';
    
    document.getElementById('createBtn').style.opacity = '0.6';
    document.getElementById('addmoneyBtn').style.opacity = '0.6';
    document.getElementById('viewBtn').style.opacity = '0.6';
    
    if (section === 'create') {
        document.getElementById('createSection').style.display = 'block';
        document.getElementById('createBtn').style.opacity = '1';
    } else if (section === 'addmoney') {
        document.getElementById('addmoneySection').style.display = 'block';
        document.getElementById('addmoneyBtn').style.opacity = '1';
    } else if (section === 'view') {
        document.getElementById('viewSection').style.display = 'block';
        document.getElementById('viewBtn').style.opacity = '1';
        displayCafeCards();
    }
}

// Close Cafe Card Panel
function closeCafeCardPanel() {
    document.getElementById('cafeCardPanelModal').style.display = 'none';
}

// Create Cafe Card
function createCafeCard() {
    const cardNumber = document.getElementById('newCardNumber').value.trim();
    const cardHolder = document.getElementById('newCardHolder').value.trim();
    const balance = parseInt(document.getElementById('newCardBalance').value) || 0;
    const isPremium = document.getElementById('isPremium').checked;
    
    if (!cardNumber || !cardHolder) {
        alert('Please enter card number and holder name');
        return;
    }
    
    if (cafeCards.find(c => c.cardNumber === cardNumber)) {
        alert('Card number already exists!');
        return;
    }
    
    const card = {
        cardNumber: cardNumber,
        cardHolder: cardHolder,
        balance: balance,
        isPremium: isPremium,
        createdDate: new Date().toLocaleDateString('en-IN'),
        transactions: [],
        dailyBiscuits: {} // Track daily biscuit usage: { 'date': count }
    };
    
    if (balance > 0) {
        card.transactions.push({
            type: 'credit',
            amount: balance,
            date: new Date().toLocaleString('en-IN'),
            description: 'Initial Balance'
        });
    }
    
    cafeCards.push(card);
    localStorage.setItem('cafeCards', JSON.stringify(cafeCards));
    
    document.getElementById('newCardNumber').value = '';
    document.getElementById('newCardHolder').value = '';
    document.getElementById('newCardBalance').value = '';
    document.getElementById('isPremium').checked = false;
    
    showNotification(`${isPremium ? 'Premium ' : ''}Cafe Card created successfully!`, 'success');
    showCardSection('view');
}

// Add Money to Cafe Card
function addMoneyToCafeCard() {
    const cardNumber = document.getElementById('addMoneyCardNumber').value.trim();
    const amount = parseInt(document.getElementById('addMoneyAmount').value) || 0;
    
    if (!cardNumber || amount <= 0) {
        alert('Please enter valid card number and amount');
        return;
    }
    
    const card = cafeCards.find(c => c.cardNumber === cardNumber);
    if (!card) {
        alert('Card not found!');
        return;
    }
    
    card.balance += amount;
    card.transactions.push({
        type: 'credit',
        amount: amount,
        date: new Date().toLocaleString('en-IN'),
        description: 'Money Added'
    });
    
    localStorage.setItem('cafeCards', JSON.stringify(cafeCards));
    
    document.getElementById('addMoneyCardNumber').value = '';
    document.getElementById('addMoneyAmount').value = '';
    document.getElementById('addMoneyCardPreview').style.display = 'none';
    
    showNotification(`₹${amount} added to card ${cardNumber}`, 'success');
    showCardSection('view');
}

// Preview Card for Add Money
function previewCardForAddMoney() {
    const cardNumber = document.getElementById('addMoneyCardNumber').value.trim();
    const preview = document.getElementById('addMoneyCardPreview');
    
    if (!cardNumber) {
        preview.style.display = 'none';
        return;
    }
    
    const card = cafeCards.find(c => c.cardNumber === cardNumber);
    if (card) {
        preview.innerHTML = `
            <div style="margin-bottom: 0.5rem;"><strong>Holder:</strong> ${card.cardHolder}</div>
            <div><strong>Current Balance:</strong> <span style="color: #28a745; font-weight: bold; font-size: 1.2rem;">₹${card.balance}</span></div>
        `;
        preview.style.display = 'block';
    } else {
        preview.innerHTML = '<div style="color: #e74c3c;">Card not found!</div>';
        preview.style.display = 'block';
    }
}

// Display Cafe Cards
function displayCafeCards() {
    const list = document.getElementById('cafeCardsList');
    const searchTerm = document.getElementById('searchCard')?.value.toLowerCase() || '';
    
    const filteredCards = cafeCards.filter(card => 
        card.cardNumber.toLowerCase().includes(searchTerm) ||
        card.cardHolder.toLowerCase().includes(searchTerm)
    );
    
    if (filteredCards.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999; padding: 1rem;">No cards found</p>';
        return;
    }
    
    list.innerHTML = filteredCards.map(card => `
        <div style="background: ${card.isPremium ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; padding: 1.5rem; border-radius: 15px; margin-bottom: 1rem; color: white; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                        <span style="font-size: 1.3rem; font-weight: bold;">${card.cardNumber}</span>
                        ${card.isPremium ? '<span style="font-size: 1.2rem;">⭐</span>' : ''}
                    </div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">${card.cardHolder}</div>
                    ${card.isPremium ? '<div style="font-size: 0.8rem; opacity: 0.9; margin-top: 0.2rem;">🍪 Free Biscuits</div>' : ''}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 0.3rem;">Balance</div>
                    <div style="font-size: 1.8rem; font-weight: bold;">₹${card.balance}</div>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button onclick="viewCardTransactions('${card.cardNumber}')" style="flex: 1; padding: 0.5rem; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">📊 History</button>
                <button onclick="deleteCard('${card.cardNumber}')" style="flex: 1; padding: 0.5rem; background: rgba(231,76,60,0.8); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">🗑️ Delete</button>
            </div>
            <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 0.5rem; text-align: right;">Created: ${card.createdDate}</div>
        </div>
    `).join('');
}

// View Card Transactions
function viewCardTransactions(cardNumber) {
    const card = cafeCards.find(c => c.cardNumber === cardNumber);
    if (!card) return;
    
    const transactions = card.transactions.slice().reverse();
    const html = `
        <div style="padding: 1rem;">
            <h3 style="color: #6B4423; margin-bottom: 1rem;">Transaction History</h3>
            <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div><strong>Card:</strong> ${card.cardNumber}</div>
                <div><strong>Holder:</strong> ${card.cardHolder}</div>
                <div><strong>Current Balance:</strong> <span style="color: #28a745; font-weight: bold;">₹${card.balance}</span></div>
            </div>
            ${transactions.length === 0 ? '<p style="text-align: center; color: #999;">No transactions yet</p>' : transactions.map(t => `
                <div style="background: white; padding: 0.8rem; border-radius: 8px; margin-bottom: 0.5rem; border-left: 4px solid ${t.type === 'credit' ? '#28a745' : '#e74c3c'};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem;">
                        <strong style="color: ${t.type === 'credit' ? '#28a745' : '#e74c3c'};">${t.type === 'credit' ? '+ ' : '- '}₹${t.amount}</strong>
                        <span style="font-size: 0.85rem; color: #666;">${t.date}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #666;">${t.description}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            ${html}
        </div>
    `;
    document.body.appendChild(modal);
}

// Delete Card
function deleteCard(cardNumber) {
    if (confirm(`Delete card ${cardNumber}?\n\nThis action cannot be undone!`)) {
        cafeCards = cafeCards.filter(c => c.cardNumber !== cardNumber);
        localStorage.setItem('cafeCards', JSON.stringify(cafeCards));
        displayCafeCards();
        showNotification('Card deleted successfully', 'error');
    }
}

// Close Cafe Card Modal
function closeCafeCard() {
    document.getElementById('cafeCardModal').style.display = 'none';
    document.getElementById('cardBalanceDisplay').style.display = 'none';
}

// Check Card Balance
function checkCardBalance() {
    const cardNumber = document.getElementById('cafeCardNumber').value.trim();
    const balanceDisplay = document.getElementById('cardBalanceDisplay');
    const biscuitsOption = document.getElementById('freeBiscuitsOption');
    
    if (!cardNumber) {
        balanceDisplay.style.display = 'none';
        biscuitsOption.style.display = 'none';
        return;
    }
    
    const card = cafeCards.find(c => c.cardNumber === cardNumber);
    if (card) {
        let biscuitMsg = '';
        let canGetBiscuits = false;
        
        if (card.isPremium) {
            const today = new Date().toLocaleDateString('en-IN');
            const dayOfWeek = new Date().getDay();
            const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
            const todayCount = card.dailyBiscuits?.[today] || 0;
            
            if (freeBiscuitsEnabled && isWeekday && todayCount < 2) {
                biscuitMsg = `<div style="font-size: 0.9rem; color: #28a745; margin-top: 0.3rem;">🍪 Free Biscuits Available (${2 - todayCount} left today)</div>`;
                canGetBiscuits = true;
            } else if (!freeBiscuitsEnabled) {
                biscuitMsg = '<div style="font-size: 0.9rem; color: #e74c3c; margin-top: 0.3rem;">🍪 Free Biscuits (Disabled)</div>';
            } else if (!isWeekday) {
                biscuitMsg = '<div style="font-size: 0.9rem; color: #e74c3c; margin-top: 0.3rem;">🍪 Free Biscuits (Weekdays Only)</div>';
            } else {
                biscuitMsg = '<div style="font-size: 0.9rem; color: #e74c3c; margin-top: 0.3rem;">🍪 Daily Limit Reached (2/2)</div>';
            }
        }
        
        document.getElementById('cardHolderName').innerHTML = card.cardHolder + (card.isPremium ? ' <span style="color: #f5576c;">⭐ PREMIUM</span>' : '');
        document.getElementById('cardBalanceAmount').innerHTML = `₹${card.balance}${biscuitMsg}`;
        balanceDisplay.style.display = 'block';
        
        // Show biscuits option only if eligible
        if (canGetBiscuits) {
            biscuitsOption.style.display = 'block';
            document.getElementById('addFreeBiscuits').checked = false;
        } else {
            biscuitsOption.style.display = 'none';
        }
    } else {
        balanceDisplay.style.display = 'none';
        biscuitsOption.style.display = 'none';
    }
}

// Process Cafe Card Payment
function processCafeCardPayment() {
    const cardNumber = document.getElementById('cafeCardNumber').value.trim();
    const billAmount = parseInt(document.getElementById('cafeCardBillAmount').textContent);
    const wantsBiscuits = document.getElementById('addFreeBiscuits')?.checked || false;
    
    if (!cardNumber) {
        alert('Please enter card number');
        return;
    }
    
    const card = cafeCards.find(c => c.cardNumber === cardNumber);
    if (!card) {
        alert('Card not found!');
        return;
    }
    
    // Check free biscuits eligibility
    let freeBiscuits = false;
    const today = new Date().toLocaleDateString('en-IN');
    const dayOfWeek = new Date().getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    if (!card.dailyBiscuits) card.dailyBiscuits = {};
    const todayCount = card.dailyBiscuits[today] || 0;
    
    if (card.isPremium && isWeekday && todayCount < 2 && wantsBiscuits && freeBiscuitsEnabled) {
        freeBiscuits = true;
        card.dailyBiscuits[today] = todayCount + 1;
    }
    
    if (card.balance >= billAmount) {
        // Sufficient balance
        card.balance -= billAmount;
        card.transactions.push({
            type: 'debit',
            amount: billAmount,
            date: new Date().toLocaleString('en-IN'),
            description: freeBiscuits ? 'Order Payment + Free Biscuits 🍪' : (card.isPremium ? 'Order Payment (Premium)' : 'Order Payment')
        });
        
        localStorage.setItem('cafeCards', JSON.stringify(cafeCards));
        closeCafeCard();
        createOrder('cafecard', billAmount);
        
        if (freeBiscuits) {
            showNotification(`Payment successful! Free Biscuits added 🍪 (${card.dailyBiscuits[today]}/2 today)`, 'success');
        } else {
            showNotification('Payment successful!', 'success');
        }
    } else {
        // Insufficient balance
        const remaining = billAmount - card.balance;
        if (confirm(`Insufficient balance!\n\nCard Balance: ₹${card.balance}\nBill Amount: ₹${billAmount}\nRemaining: ₹${remaining}${freeBiscuits ? '\n\n🍪 Free Biscuits will be added!' : ''}\n\nDo you want to pay the remaining amount in cash?`)) {
            const usedBalance = card.balance;
            card.balance = 0;
            card.transactions.push({
                type: 'debit',
                amount: usedBalance,
                date: new Date().toLocaleString('en-IN'),
                description: freeBiscuits ? 'Partial Payment + Free Biscuits 🍪' : 'Partial Payment'
            });
            localStorage.setItem('cafeCards', JSON.stringify(cafeCards));
            closeCafeCard();
            
            alert(`Please collect ₹${remaining} in cash from customer${freeBiscuits ? '\n\n🍪 Don\'t forget to add Free Biscuits!' : ''}`);
            createOrder('cafecard+cash', billAmount);
            showNotification('Payment completed with cash!', 'success');
        }
    }
}

