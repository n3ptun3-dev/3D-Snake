import { LeaderboardEntry, DeviceType } from '../types';

// URLs for fetching leaderboard data as CSV
const MOBILE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/19INzqGNn-xuOh4sMTD04Z32m3Fhni9H-UP0KjO5n13c/export?format=csv';
const COMPUTER_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1e7glxbMeB_pqdylaNla_SAPDlY-CJmd8oOZ_sb_Pqlo/export?format=csv';

// URLs and entry IDs for submitting scores via Google Forms
const GOOGLE_FORMS = {
    mobile: {
        url: 'https://docs.google.com/forms/d/e/1FAIpQLScRNvC2Od5KbWUDmyf30-WxlhlgfoUOAsAXB_YCcEa9pA-3rQ/formResponse',
        name: 'entry.1806977404',
        score: 'entry.464511137',
        speed: 'entry.523932117',
        time: 'entry.771331505',
        region: 'entry.1054301276',
        level: 'entry.495666438',
    },
    computer: {
        url: 'https://docs.google.com/forms/d/e/1FAIpQLSeokYAZR5A6GYya1MBGKFXEe1Axpg_HqW9huxWP7cI8aTApdw/formResponse',
        name: 'entry.1228869105',
        score: 'entry.1304053771',
        speed: 'entry.2018816908',
        time: 'entry.728817141',
        region: 'entry.1117564551',
        level: 'entry.358267579',
    }
};

/**
 * A robust CSV parser that handles quoted fields, including commas and newlines within them.
 * @param csv The raw CSV string.
 * @returns A 2D array of strings representing the parsed data.
 */
const parseCsv = (csv: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotedField = false;

    // Normalize line endings
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
                    i++; // Skip the second quote of the pair
                } else {
                    // This is the closing quote for the field
                    inQuotedField = false;
                }
            } else {
                currentField += char;
            }
        } else {
            switch (char) {
                case '"':
                    inQuotedField = true;
                    // If currentField has content, it's a malformed CSV, but we'll treat the quote as starting a field.
                    // The content before it will be part of the field.
                    break;
                case ',':
                    currentRow.push(currentField);
                    currentField = '';
                    break;
                case '\n':
                    currentRow.push(currentField);
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


export const fetchLeaderboard = async (deviceType: DeviceType): Promise<LeaderboardEntry[]> => {
    const url = deviceType === 'mobile' ? MOBILE_SHEET_URL : COMPUTER_SHEET_URL;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
    }
    const csvText = await response.text();
    const rows = parseCsv(csvText).slice(1); // Skip header row

    const entries: LeaderboardEntry[] = rows
        .map((row, index): LeaderboardEntry | null => {
            // Columns: Timestamp, Name, Score, Speed, Time (since EPOCH), Region, Level
            if (row.length < 7) return null;
            return {
                rank: index + 1,
                timestamp: row[0],
                name: row[1],
                score: parseInt(row[2], 10) || 0,
                speed: parseFloat(row[3]) || 0,
                time: parseInt(row[4], 10) || 0,
                region: row[5],
                level: parseInt(row[6], 10) || 0,
                device: deviceType,
            };
        })
        .filter((entry): entry is LeaderboardEntry => entry !== null && entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 100)
        .map((entry, index) => ({ ...entry, rank: index + 1 })); // Re-assign rank after sorting

    return entries;
};

export const getGeoInfo = async (): Promise<{ countryCode: string; countryName: string } | null> => {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) return null;
        const data = await response.json();
        return {
            countryCode: data.country_code || 'UNK',
            countryName: data.country_name || 'Unknown',
        };
    } catch (error) {
        console.error("Could not fetch geo info:", error);
        return null;
    }
};

export const submitScore = async (
    deviceType: DeviceType,
    scoreData: { name: string; score: number; level: number; topSpeed: number; region: string }
): Promise<void> => {
    const form = GOOGLE_FORMS[deviceType];
    const formData = new FormData();

    formData.append(form.name, scoreData.name);
    formData.append(form.score, scoreData.score.toString());
    formData.append(form.speed, scoreData.topSpeed.toFixed(2));
    formData.append(form.time, Date.now().toString());
    formData.append(form.region, scoreData.region);
    formData.append(form.level, scoreData.level.toString());

    try {
        await fetch(form.url, {
            method: 'POST',
            body: formData,
            mode: 'no-cors', // We don't need the response, and this avoids CORS issues.
        });
    } catch (error) {
        console.error("Score submission failed:", error);
        throw new Error("Could not submit score.");
    }
};

export const countryCodeToFlag = (isoCode: string): string => {
    if (!isoCode || isoCode.length !== 2 || isoCode === 'UNK') {
        return '🏳️'; // Default flag
    }
    return isoCode
        .toUpperCase()
        .split('')
        .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
        .join('');
};

export const formatTimeAgo = (epochTime: number): string => {
    const now = new Date();
    const past = new Date(epochTime);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (isNaN(diffInSeconds) || diffInSeconds < 0) return "just now";

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    if (diffInSeconds < intervals.day * 7) {
        if (diffInSeconds < 60) return "just now";
        if (diffInSeconds < intervals.hour) return `${Math.floor(diffInSeconds / intervals.minute)} mins ago`;
        if (diffInSeconds < intervals.day) return `${Math.floor(diffInSeconds / intervals.hour)} hours ago`;
        const days = Math.floor(diffInSeconds / intervals.day);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    return past.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};