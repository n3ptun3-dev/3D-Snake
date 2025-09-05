import { GameConfig } from '../types';

const CONFIG_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT4eopNiDcPvt5OZqLnFexOmOPTDiincK75HFygfucJh2MF20_UbeMBFjmb6NyvDqVJQF01jt92WTyY/pub?output=csv';

const CONFIG_STORAGE_KEY = 'snakeGameConfig';

export const DEFAULT_CONFIG: GameConfig = {
    // Gameplay
    initialGameSpeed: 400,
    initialSnakeLength: 3,
    initialLives: 3,
    speedIncreasePerApple: 1,
    slowDownEffectValue: 40,
    pointsPerLevel: 10,
    // Fruit & Power-ups
    boardFruitSpawnDelay: 12000,
    passageFruitSpawnDelay: 20000,
    boardFruitLifetime: 30000,
    boardFruitCooldown: 5000,
    passageFruitRetryDelay: 10000,
    extraLifeChance: 0.3,
    maxExtraLivesPerLife: 1,
    maxExtraLivesTotal: 3,
    appleScore: 1,
    speedBoostDuration: 5000,
    magnetDuration: 10000,
    scoreDoublerDuration: 10000,
    tripleDuration: 10000,
    slowDownFrequencyMultiplier: 3,
    // New fruit logic config
    slowDownSpeedThreshold: 4,
    highSpeedSpeedBoostChance: 0.25,
    streetFruitBucketTripleCount: 3,
    streetFruitBucketExtraLifeCount: 1,
    // Promotions
    promoTitle: '',
    promoDescription: '',
    // Ad Pricing
    priceBillboard: 3,
    pricePoster: 1,
    priceBanner: 1,
    priceFlyer: 0.5,
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


const saveConfigToStorage = (config: GameConfig) => {
    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
        console.error("Failed to save config to localStorage.", error);
    }
};

/**
 * Synchronously loads the game configuration from localStorage if available,
 * otherwise falls back to the default configuration.
 */
export const getInitialConfig = (): GameConfig => {
    try {
        const storedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (storedConfig) {
            // Merge with defaults to ensure all keys are present after updates
            return { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
        }
    } catch (error) {
        console.error("Failed to read config from localStorage, using defaults.", error);
    }
    return DEFAULT_CONFIG;
};

/**
 * Fetches the latest game configuration from the remote CSV file and caches it
 * in localStorage upon success. This is intended to be run in the background.
 * @returns The new config if successful, otherwise null.
 */
export const fetchAndCacheGameConfig = async (): Promise<GameConfig | null> => {
    try {
        console.log("Attempting to fetch remote game config...");
        const response = await fetch(`${CONFIG_SHEET_URL}&t=${new Date().getTime()}`); // Cache-bust
        if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
        }
        const csvText = await response.text();
        console.log("Successfully fetched remote config.");
        const rows = parseCsv(csvText).slice(1); // Skip header

        const fetchedConfig: Partial<GameConfig> = {};
        for (const row of rows) {
            if (row.length >= 2) {
                const key = row[0] as keyof GameConfig;
                const stringValue = row[1];
                
                if (key in DEFAULT_CONFIG) {
                    if (key === 'promoTitle' || key === 'promoDescription') {
                         (fetchedConfig[key] as any) = stringValue.replace(/\\n/g, '\n');
                    } else {
                        const numericValue = parseFloat(stringValue);
                        if (!isNaN(numericValue)) {
                            (fetchedConfig[key] as any) = numericValue;
                        }
                    }
                }
            }
        }
        
        const finalConfig = { ...DEFAULT_CONFIG, ...fetchedConfig };
        const oldConfigJSON = localStorage.getItem(CONFIG_STORAGE_KEY);
        
        // Only update if the new config is different from the old one.
        if (JSON.stringify(finalConfig) !== oldConfigJSON) {
            saveConfigToStorage(finalConfig);
            console.log("Fetched and cached new game config.");
        }
        
        return finalConfig;

    } catch (error) {
        console.warn(`Failed to fetch game config, using previously cached or default values. ${error}`);
        return null;
    }
};