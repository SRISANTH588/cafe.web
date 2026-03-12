// ========================================
// CAFE CONFIGURATION - UPDATE HERE
// ========================================
// Change these values to customize your cafe

const CAFE_CONFIG = {
    // Cafe Name - CHANGE THIS
    name: "Ayyan Cafe",
    
    // Tagline - CHANGE THIS
    tagline: "Where Every Sip Tells a Story",
    
    // Subtitle - CHANGE THIS
    subtitle: "Premium Beverages & Delights",
    
    // UPI Payment Details - CHANGE THIS
    upiId: "merchant@upi",
    upiName: "AyyanCafe",
    
    // Contact Information - CHANGE THIS
    phone: "+91 1234567890",
    email: "contact@ayyancafe.com",
    address: "123 Main Street, City",
    
    // Business Settings
    maxTokens: 300,
    
    // Currency
    currency: "₹",
    
    // Menu Prices - CHANGE THESE
    prices: {
        coffee: 30,
        tea: 30,
        horlicks: 25,
        maskaBun: 45,
        sugarFree: 10,
        parcelCharge: 5
    },
    
    // API URL - CHANGE AFTER DEPLOYMENT
    apiUrl: "http://localhost:3000"
    // After Vercel deploy, change to: "https://your-cafe.vercel.app"
};

// ========================================
// HOW TO USE:
// ========================================
// 1. Change values above
// 2. Save this file
// 3. Refresh your websites
// 4. All changes apply automatically!

// ========================================
// EXAMPLES:
// ========================================
// Change cafe name:
//   name: "My Coffee Shop"
//
// Change tagline:
//   tagline: "Best Coffee in Town"
//
// Change prices:
//   coffee: 50
//   tea: 40
//
// Change UPI:
//   upiId: "yourname@paytm"
