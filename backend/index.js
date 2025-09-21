import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION ---
const PI_API_KEY = process.env.PI_API_KEY;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_CONFIG = {
  client_email: process.env.GCP_CLIENT_EMAIL,
  private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
// --- END CONFIGURATION ---

const app = express();
app.use(cors({ origin: '*' }));
app.options('*', cors());
app.use(express.json());

// --- NEW: Static File Serving ---
// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the 'dist' directory located at the project root
const frontendDistPath = path.join(__dirname, '..', 'dist');
console.log(`[Server] Serving static files from: ${frontendDistPath}`);
app.use(express.static(frontendDistPath));
// --- END: Static File Serving ---

// In-memory store for link codes
const linkCodes = new Map();
const LINK_CODE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// --- Google Sheets Initialization ---
let doc;
let serviceAccountAuth;
let sheetsInitialized = false;

async function initializeSheets() {
    if (!SERVICE_ACCOUNT_CONFIG.client_email || !SERVICE_ACCOUNT_CONFIG.private_key || !SPREADSHEET_ID) {
        console.warn("Google Sheets environment variables are not set. Order tracking will be disabled.");
        return;
    }
    try {
        serviceAccountAuth = new JWT({
            email: SERVICE_ACCOUNT_CONFIG.client_email,
            key: SERVICE_ACCOUNT_CONFIG.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        console.log(`Successfully loaded Google Sheet: "${doc.title}"`);
        sheetsInitialized = true;
    } catch (e) {
        console.error("FATAL ERROR: Could not initialize Google Sheets. Check credentials and SPREADSHEET_ID.", e);
        sheetsInitialized = false;
    }
}

// Helper to find a row by Payment ID
async function findPaymentRow(sheet, paymentId) {
  if (!sheetsInitialized) throw new Error("Google Sheets not initialized.");
  const rows = await sheet.getRows();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].get('Payment ID') === paymentId) {
      return rows[i];
    }
  }
  return undefined;
}

// --- Middleware ---
app.use((req, res, next) => {
  if (!PI_API_KEY) {
    console.error("FATAL ERROR: PI_API_KEY environment variable is not set.");
    return res.status(500).json({ error: 'Server configuration error: Missing PI_API_KEY.' });
  }
  next();
});

// Helper to verify Pi accessToken
const verifyPiToken = async (accessToken) => {
  const verificationUrl = 'https://api.minepi.com/v2/me';
  const piApiResponse = await fetch(verificationUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!piApiResponse.ok) {
    const errorText = await piApiResponse.text();
    throw new Error(`Pi API verification failed with status ${piApiResponse.status}: ${errorText}`);
  }
  return await piApiResponse.json();
};


// --- AUTH & LINKING ENDPOINTS ---
app.post('/verifyAuth', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Access token is required.' });
  try {
    const user = await verifyPiToken(accessToken);
    console.log(`Successfully verified token for user: ${user.username}`);
    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('An unexpected error during token verification:', error.message);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

app.post('/generate-link-code', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Access token is required for linking.' });
    try {
        const user = await verifyPiToken(accessToken);
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        linkCodes.set(code, { user, expires: Date.now() + LINK_CODE_EXPIRATION_MS });
        console.log(`Generated link code ${code} for user ${user.username}`);
        res.status(200).json({ success: true, code });
    } catch (error) {
        console.error('Failed to generate link code:', error.message);
        res.status(401).json({ error: 'Authentication failed. Could not generate link code.' });
    }
});

app.post('/validate-link-code', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Link code is required.' });
    const stored = linkCodes.get(code.toUpperCase());
    if (!stored || Date.now() > stored.expires) {
        if(stored) linkCodes.delete(code.toUpperCase());
        return res.status(404).json({ error: 'Invalid or expired code.' });
    }
    linkCodes.delete(code.toUpperCase());
    res.status(200).json({ success: true, user: stored.user });
});

setInterval(() => {
    const now = Date.now();
    for (const [code, { expires }] of linkCodes.entries()) {
        if (now > expires) linkCodes.delete(code);
    }
}, 60 * 1000);


// --- ORDER & PAYMENT ENDPOINTS ---

app.post('/createOrder', async (req, res) => {
    if (!sheetsInitialized) {
        return res.status(503).json({ error: "Order tracking service is currently unavailable." });
    }
    try {
        const orderData = req.body;
        if (!orderData || !orderData.title) {
            return res.status(400).json({ error: "Invalid order data provided." });
        }
        
        const paymentId = `pi_payment_${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
        
        const adTypeToNumeric = { 'Billboard': '1', 'Poster': '2', 'Banner': '3', 'Flyer': '4', 'CosmeticBanner': '5' };
        const rowData = {
            'Timestamp': new Date().toISOString(), 'Payment ID': paymentId, 'Status': 'PENDING',
            'Paid': 'no', 'Approved': 'PENDING', 'Schedule date': orderData.scheduleDate,
            'Image URL': orderData.imageUrl, 'Title': orderData.title, 'Description': orderData.description,
            'Advertiser name': orderData.piUsername, 'Website URL': orderData.websiteUrl, 'Price': orderData.price,
            'Quantity': orderData.quantity, 'Type': adTypeToNumeric[orderData.adType] || '', 'Promo code': orderData.promoCode,
        };

        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow(rowData);
        
        console.log(`Successfully created new order with Payment ID: ${paymentId}`);
        res.status(200).json({ success: true, paymentId });
    } catch (error) {
        console.error("Error in /createOrder:", error);
        res.status(500).json({ error: "Could not create order in the database." });
    }
});

app.post('/approvePayment', async (req, res) => {
    const { paymentId, piPaymentId } = req.body;
    if (!paymentId || !piPaymentId) return res.status(400).json({ error: 'paymentId and piPaymentId are required' });
    if (!sheetsInitialized) return res.status(503).json({ error: "Order tracking service unavailable." });

    try {
        const sheet = doc.sheetsByIndex[0];
        const row = await findPaymentRow(sheet, paymentId);

        if (!row) return res.status(404).json({ error: 'Payment not found in tracking system.' });
        
        const currentStatus = row.get('Status');
        if (currentStatus === 'APPROVED' || currentStatus === 'COMPLETED') {
            return res.status(200).json({});
        }

        if (currentStatus !== 'PENDING') {
            return res.status(409).json({ error: `Payment is not in PENDING state. Current state: ${currentStatus}` });
        }
        
        console.log(`Approving payment with Pi server for piPaymentId: ${piPaymentId}`);
        const piResponse = await fetch(`https://api.minepi.com/v2/payments/${piPaymentId}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${PI_API_KEY}` },
        });

        if (!piResponse.ok) {
            const errorText = await piResponse.text();
            console.error(`Pi API approval failed for ${piPaymentId}: ${errorText}`);
            throw new Error(`Pi API approval failed: ${errorText}`);
        }
        
        row.set('Status', 'APPROVED');
        await row.save();

        console.log(`Successfully approved payment in sheet: ${paymentId}`);
        res.status(200).json({});
    } catch (error) {
        console.error(`Error in /approvePayment for ${paymentId}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/completePayment', async (req, res) => {
    const { paymentId, piPaymentId, txid } = req.body;
    if (!paymentId || !piPaymentId || !txid) return res.status(400).json({ error: 'paymentId, piPaymentId, and txid are required' });
    if (!sheetsInitialized) return res.status(503).json({ error: "Order tracking service unavailable." });

    try {
        const sheet = doc.sheetsByIndex[0];
        const row = await findPaymentRow(sheet, paymentId);
        if (!row) return res.status(404).json({ error: 'Payment not found in tracking system.' });
        
        const currentStatus = row.get('Status');
        if (currentStatus === 'COMPLETED') {
            return res.status(200).json({});
        }

        if (currentStatus !== 'APPROVED') {
            return res.status(409).json({ error: `Payment is not in APPROVED state. Current state: ${currentStatus}` });
        }

        console.log(`Completing payment with Pi server for piPaymentId: ${piPaymentId}`);
        const piResponse = await fetch(`https://api.minepi.com/v2/payments/${piPaymentId}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ txid }),
        });

        if (!piResponse.ok) {
            const errorText = await piResponse.text();
            console.error(`Pi API completion failed for ${piPaymentId}: ${errorText}`);
            throw new Error(`Pi API completion failed. Please check your API Key. Server says: ${errorText}`);
        }
        
        row.set('Status', 'COMPLETED');
        row.set('Paid', 'yes');
        row.set('TXID', txid);
        await row.save();
        
        console.log(`Successfully completed payment in sheet: ${paymentId} with TXID: ${txid}`);
        res.status(200).json({});
    } catch (error) {
        console.error(`Error in /completePayment for ${paymentId}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/handleIncompletePayment', async (req, res) => {
    const { payment } = req.body;
    const internalPaymentId = payment?.memo;
    const piPaymentId = payment?.identifier;
    const txid = payment?.transaction?.txid;
    if (!internalPaymentId || !piPaymentId || !txid) return res.status(400).json({ error: 'Valid payment object with memo, identifier and txid required' });
    if (!sheetsInitialized) return res.status(503).json({ error: "Order tracking service unavailable." });

    try {
        console.log(`Handling incomplete payment, completing with Pi server for ${piPaymentId}`);
         await fetch(`https://api.minepi.com/v2/payments/${piPaymentId}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ txid }),
        });

        const sheet = doc.sheetsByIndex[0];
        const row = await findPaymentRow(sheet, internalPaymentId);
        if (row && row.get('Paid') !== 'yes') {
            row.set('Status', 'COMPLETED');
            row.set('Paid', 'yes');
            row.set('TXID', txid);
            await row.save();
            console.log(`Successfully completed recovered payment: ${internalPaymentId}`);
        }
        res.status(200).json({ message: 'Incomplete payment reconciled.' });
    } catch (error) {
        console.error(`Error in /handleIncompletePayment for ${internalPaymentId}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// --- ROOT & SERVER START ---
// API routes must come before the SPA catch-all
app.get('/api/health', (req, res) => {
  res.status(200).send('Pi Auth, Linking & Order Service is running.');
});

// --- NEW: SPA Fallback ---
// This catch-all route should be the LAST route defined.
// It sends the main index.html file for any GET request that doesn't match a static file or an API route.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});
// --- END: SPA Fallback ---

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  initializeSheets();
});
