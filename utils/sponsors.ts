import { AdType, AdSubmissionData, ApprovedAd, BookedSlots, PromoCode } from '../types';

// --- ADVERTISING LOGIC ---

export const AD_PRICING: Record<AdType, number> = {
    Billboard: 5,
    Poster: 3,
    Banner: 2,
    Flyer: 1,
    CosmeticBanner: 0,
};

const AD_TYPE_TO_FORM_VALUE: Record<AdType, string> = {
    Billboard: '1',
    Poster: '2',
    Banner: '3',
    Flyer: '4',
    CosmeticBanner: '5',
};

const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdHpcyds_11z8bdfUscblCj31CzcRDEhNvfUm_9JPOhBU7qLQ/formResponse';

const FORM_ENTRIES = {
    scheduleDate: 'entry.299343912',
    imageUrl: 'entry.1343532424',
    title: 'entry.427161818',
    description: 'entry.507673891',
    contact: 'entry.2123826114',
    websiteUrl: 'entry.1789573637',
    price: 'entry.1806463483',
    quantity: 'entry.1270854340',
    paymentId: 'entry.604258250',
    type: 'entry.28965347',
    promoCode: 'entry.1235169537',
};

const CLICK_TRACKING_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdTNCQ8fd36eCBbeacaUToyhlf6v4OIgHEjpJ2Hw6XPVfh0sQ/formResponse';
const CLICK_TRACKING_ENTRIES = {
    type: 'entry.1928849296',
    title: 'entry.847633199',
};

const BOOKED_SLOTS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSbwbyacDequDMMHwPI0lS5B8krVKJyOiMBxa13LN3v3RbQ_5J8XD5JoY-RxGabPVAkxlNKjcQJueE6/pub?output=csv';
const APPROVED_ADS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSdR-vfhxfzG9rwWyXo27Tujdz_-FpeKp3pQsMPPgBHpC_AZD_EXx5XPq_NVGv7SpSebJqwctib_J-_/pub?output=csv';
const PROMO_CODES_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRrGcQhPRBIXl6IxbqBoc0h3j1Afk3v0p03BGKlxjft9RqttHaI49DD_tVG9KsezDXqD69kleaeGEXK/pub?output=csv';
const REPORT_DISPLAYED_ADS_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe51bcOZ-A7O-NrgbrSMkrpFLZzMW1cbbmHQUTTK5Me67uzlg/formResponse';
const REPORT_DISPLAYED_ADS_ENTRY = 'entry.708158634';
const CONFIRM_PAYMENT_URL = 'https://us-central1-d-snake-7a80a.cloudfunctions.net/api/confirm';

const FORM_VALUE_TO_AD_TYPE: Record<string, AdType> = {
    '1': 'Billboard',
    '2': 'Poster',
    '3': 'Banner',
    '4': 'Flyer',
    '5': 'CosmeticBanner',
};

/**
 * A robust CSV parser that handles quoted fields, including newlines and escaped quotes.
 * @param csv The raw CSV string.
 * @returns A 2D array of strings representing the parsed data.
 */
const parseCsv = (csv: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotedField = false;

    csv = csv.replace(/\r\n/g, '\n');
    if (!csv.endsWith('\n')) {
        csv += '\n';
    }

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];

        if (inQuotedField) {
            if (char === '"') {
                if (i + 1 < csv.length && csv[i + 1] === '"') {
                    // This is an escaped quote ("")
                    currentField += '"';
                    i++; 
                } else {
                    inQuotedField = false;
                }
            } else {
                currentField += char;
            }
        } else {
            switch (char) {
                case '"':
                    inQuotedField = true;
                    break;
                case ',':
                    currentRow.push(currentField.trim());
                    currentField = '';
                    break;
                case '\n':
                    currentRow.push(currentField.trim());
                    rows.push(currentRow);
                    currentRow = [];
                    currentField = '';
                    break;
                default:
                    if (char !== '\r') {
                        currentField += char;
                    }
                    break;
            }
        }
    }
    return rows.filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''));
};


export const logAdClick = async (type: 'View Sponsors' | 'Viewed' | 'Website', title?: string) => {
    const formData = new FormData();
    formData.append(CLICK_TRACKING_ENTRIES.type, type);
    if (title) {
        formData.append(CLICK_TRACKING_ENTRIES.title, title);
    } else {
        formData.append(CLICK_TRACKING_ENTRIES.title, "N/A");
    }

    try {
        await fetch(CLICK_TRACKING_URL, {
            method: 'POST',
            body: formData,
            mode: 'no-cors',
        });
    } catch (error) {
        console.error('Ad click logging failed:', error);
    }
};

export const fetchBookedSlots = async (): Promise<BookedSlots> => {
    try {
        const response = await fetch(`${BOOKED_SLOTS_URL}&t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Failed to fetch booked slots');
        const csv = await response.text();
        const rows = parseCsv(csv).slice(1);
        
        const bookedSlots: BookedSlots = {};

        for (const row of rows) {
            // We need at least 12 columns for Type (index 11).
            if (row.length < 12) continue;

            const rawScheduleDate = row[2];
            const dates: string[] = [];
            const rawDates = rawScheduleDate.split(',');

            for (const rawDate of rawDates) {
                try {
                    const datePart = rawDate.trim().split(' ')[0];
                    let year, month, day;

                    // Make date parsing robust for both M/D/YYYY and YYYY-MM-DD
                    if (datePart.includes('/')) {
                        const parts = datePart.split('/');
                        if (parts.length !== 3) throw new Error(`Invalid date format (expected M/D/YYYY), got '${datePart}'`);
                        month = parseInt(parts[0], 10);
                        day = parseInt(parts[1], 10);
                        year = parseInt(parts[2], 10);
                    } else if (datePart.includes('-')) {
                        const parts = datePart.split('-');
                        if (parts.length !== 3) throw new Error(`Invalid date format (expected YYYY-MM-DD), got '${datePart}'`);
                        year = parseInt(parts[0], 10);
                        month = parseInt(parts[1], 10);
                        day = parseInt(parts[2], 10);
                    } else if (datePart) {
                         throw new Error(`Unrecognized date format in '${datePart}'`);
                    } else {
                        continue; // Skip empty date parts
                    }
                    
                    if (isNaN(month) || isNaN(day) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
                        throw new Error(`Invalid date components from '${datePart}'`);
                    }
                    
                    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    dates.push(formattedDate);
                } catch (e) {
                    console.warn(`Skipping invalid date '${rawDate}' in booked slots: ${(e as Error).message}`);
                    continue;
                }
            }

            const adTypeNumeric = row[11];
            const adType = FORM_VALUE_TO_AD_TYPE[adTypeNumeric];
            const quantity = parseInt(row[9], 10) || 0;

            if (adType && quantity > 0) {
                for (const date of dates) {
                    const trimmedDate = date.trim();
                    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
                        if (!bookedSlots[trimmedDate]) {
                            bookedSlots[trimmedDate] = {};
                        }
                        bookedSlots[trimmedDate][adType] = (bookedSlots[trimmedDate][adType] || 0) + quantity;
                    }
                }
            }
        }
        return bookedSlots;
    } catch (e) {
        console.error("Error fetching booked slots:", e);
        return {};
    }
};

export const fetchApprovedAds = async (): Promise<ApprovedAd[]> => {
    const AD_TYPE_MAP: { [key: string]: AdType } = {
        '1': 'Billboard',
        '2': 'Poster',
        '3': 'Banner',
        '4': 'Flyer',
        '5': 'CosmeticBanner',
    };

    try {
        const response = await fetch(`${APPROVED_ADS_URL}&t=${new Date().getTime()}`);
        if (!response.ok) {
            console.error('Failed to fetch approved ads sheet:', response.statusText);
            throw new Error('Failed to fetch approved ads');
        }
        const csv = await response.text();
        const rows = parseCsv(csv).slice(1); // Skip header

        const ads: ApprovedAd[] = [];

        for (const row of rows) {
            // There should be 8 columns: Timestamp, Order number, Schedule date, Image URL, Title, Description, Advertiser name, Website URL
            const paddedRow = [...row, ...Array(8 - row.length).fill('')];
            const [timestamp, orderNumber, rawScheduleDate, imageUrl, title, description, piUsername, websiteUrl] = paddedRow;

            if (!orderNumber || orderNumber.length < 3) {
                 if (orderNumber) console.warn('Skipping row with invalid order number:', paddedRow);
                 continue;
            }
            
            const isSystemAd = orderNumber.includes('sys');
            const adTypeCode = orderNumber.charAt(2);
            const adType = AD_TYPE_MAP[adTypeCode];

            if (!adType) {
                console.warn(`Skipping row with unknown ad type code '${adTypeCode}' in order number:`, paddedRow);
                continue;
            }
            
            if (!imageUrl) {
                console.warn('Skipping row with missing required Image URL:', paddedRow);
                continue;
            }
            
            let scheduleDate = '';
            if (!isSystemAd) {
                if (!title) {
                    console.warn('Skipping paid ad with missing Title:', paddedRow);
                    continue;
                }
                try {
                    const datePart = rawScheduleDate.trim().split(' ')[0]; // "8/10/2025"
                    const parts = datePart.split('/'); // ["8", "10", "2025"]
                    if (parts.length !== 3) throw new Error('Invalid date format (expected M/D/YYYY)');
                    
                    const month = parseInt(parts[0], 10);
                    const day = parseInt(parts[1], 10);
                    const year = parseInt(parts[2], 10);

                    if (isNaN(month) || isNaN(day) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
                        throw new Error('Invalid date components');
                    }
                    
                    // Reconstruct in YYYY-MM-DD format, which is unambiguous
                    scheduleDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                } catch (e) {
                    console.warn(`Skipping paid ad with invalid date format '${rawScheduleDate}':`, e, paddedRow);
                    continue;
                }
            }
            
            ads.push({
                orderNumber,
                timestamp,
                scheduleDate,
                imageUrl,
                title: title || (isSystemAd ? 'System Ad' : 'Untitled Ad'),
                description: description || 'No description provided.',
                piUsername: piUsername || 'N/A',
                websiteUrl: websiteUrl || '#',
                adType,
            });
        }
        console.log(`Fetched and parsed ${ads.length} approved ads.`);
        return ads;
    } catch (e) {
        console.error("Error fetching or parsing approved ads:", e);
        return [];
    }
};

export const fetchPromoCodes = async (): Promise<Map<string, PromoCode>> => {
    const promoCodes = new Map<string, PromoCode>();
    try {
        const response = await fetch(`${PROMO_CODES_URL}&t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Failed to fetch promo codes');

        const csv = await response.text();
        const rows = parseCsv(csv).slice(1); // Skip header

        // Columns: Code, Type, Value, IsActive
        for (const row of rows) {
            if (row.length < 4) continue;
            const [code, type, value, isActiveStr] = row;
            const isActive = isActiveStr.toUpperCase() === 'TRUE';
            const promoType = type.toUpperCase();

            if (code && (promoType === 'BOGO' || promoType === 'DISC') && isActive) {
                promoCodes.set(code.toUpperCase(), {
                    code,
                    type: promoType as 'BOGO' | 'DISC',
                    value: parseInt(value, 10) || (promoType === 'BOGO' ? 1 : 0),
                    isActive: true
                });
            }
        }
        console.log(`Fetched ${promoCodes.size} active promo codes.`);
        return promoCodes;
    } catch (e) {
        console.error("Error fetching promo codes:", e);
        return promoCodes; // Return empty map on error
    }
};

export const reportDisplayedAds = async (orderNumbers: string[]): Promise<void> => {
    if (orderNumbers.length === 0) return;
    const formData = new FormData();
    // Prepend with a single quote to ensure Google Sheets treats it as a string
    formData.append(REPORT_DISPLAYED_ADS_ENTRY, "'" + orderNumbers.join(','));

    try {
        await fetch(REPORT_DISPLAYED_ADS_URL, {
            method: 'POST',
            body: formData,
            mode: 'no-cors',
        });
        console.log(`Confirmed ${orderNumbers.length} displayed ads:`, orderNumbers.join(','));
    } catch (error) {
        console.error('Failed to report displayed ads:', error);
    }
};

export const confirmPayment = async (paymentId: string): Promise<void> => {
    try {
        const response = await fetch(CONFIRM_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentId }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Confirmation failed with non-JSON response' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        console.log(`Payment confirmed for ${paymentId}`);
    } catch (error) {
        console.error('Failed to confirm payment:', error);
        throw error; // Re-throw to be handled by the caller
    }
};


export const generatePaymentId = (title: string): string => {
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${sanitizedTitle || 'AD'}-${randomSuffix}`;
};


export const submitAd = async (data: AdSubmissionData): Promise<void> => {
    const { adType } = data;
    const formData = new FormData();

    formData.append(FORM_ENTRIES.paymentId, data.paymentId);
    formData.append(FORM_ENTRIES.scheduleDate, data.scheduleDate);
    formData.append(FORM_ENTRIES.imageUrl, data.imageUrl);
    formData.append(FORM_ENTRIES.title, data.title);
    formData.append(FORM_ENTRIES.description, data.description);
    formData.append(FORM_ENTRIES.websiteUrl, data.websiteUrl);
    formData.append(FORM_ENTRIES.price, data.price.toString());
    formData.append(FORM_ENTRIES.quantity, data.quantity.toString());
    formData.append(FORM_ENTRIES.contact, data.piUsername);
    if(data.promoCode) {
        formData.append(FORM_ENTRIES.promoCode, data.promoCode);
    }


    const adTypeValue = AD_TYPE_TO_FORM_VALUE[adType];
    formData.append(FORM_ENTRIES.type, adTypeValue);
    
    try {
        await fetch(FORM_URL, {
            method: 'POST',
            body: formData,
            mode: 'no-cors', // We don't need to read the response from Google Forms.
        });
        // 'no-cors' requests will have an opaque response, so we can't check `response.ok`.
        // We assume success if the request doesn't throw a network error.
    } catch (error) {
        console.error('Ad submission to Google Form failed:', error);
        throw new Error('Could not submit ad to Google Form.');
    }
};