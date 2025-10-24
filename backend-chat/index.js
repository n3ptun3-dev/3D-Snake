import express from 'express';
import cors from 'cors';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// --- CONFIGURATION ---
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_CONFIG = {
  client_email: process.env.GCP_CLIENT_EMAIL,
  private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
// --- END CONFIGURATION ---

const app = express();
app.use(cors({ origin: '*' })); // Allow all origins
app.use(express.json());

// --- Google Sheets Initialization ---
let doc;
let serviceAccountAuth;
let sheetsInitialized = false;

async function initializeSheets() {
    if (!SERVICE_ACCOUNT_CONFIG.client_email || !SERVICE_ACCOUNT_CONFIG.private_key || !SPREADSHEET_ID) {
        console.warn("Google Sheets environment variables are not set. The service will not work.");
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
        console.error("FATAL ERROR: Could not initialize Google Sheets. Check credentials, SPREADSHEET_ID, and ensure the service account has editor access to the sheet.", e);
        sheetsInitialized = false;
    }
}

// --- API Endpoints ---
app.get('/messages', async (req, res) => {
    if (!sheetsInitialized) {
        return res.status(503).json({ error: "Chat service is not properly configured or has failed to initialize." });
    }
    try {
        const sheet = doc.sheetsByIndex[0]; // Assuming the first sheet holds the chat data
        const rows = await sheet.getRows();
        
        const messages = rows.map(row => {
            const timestamp = parseInt(row.get('TIMES'), 10);
            const id = row.get('MessageID');

            // Basic validation for a row to be considered a message
            if (!id || isNaN(timestamp)) {
                return null;
            }

            return {
                id: id,
                pi_uid: row.get('Pi_UID'),
                pi_name: row.get('Pi_Name'),
                screen_name: row.get('Screen_Name'),
                timestamp: timestamp,
                message: row.get('Message_Text'),
                message_type: row.get('Message_Type'),
                reply_to_id: row.get('Reply_To_ID'),
                status: row.get('Status'),
                region: row.get('Region'),
            };
        }).filter(Boolean); // Filter out any null rows that failed validation

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages from sheet:", error);
        res.status(500).json({ error: "Failed to retrieve chat messages." });
    }
});


app.get('/health', (req, res) => {
  res.status(200).send('Bus Stop Chat Service is running.');
});

const PORT = process.env.PORT || 8080;

// Wait for initialization to complete before starting the server to avoid race conditions.
initializeSheets().finally(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}. Sheets Initialized: ${sheetsInitialized}`);
    });
});
