/**
 * Fetch configuration — master input is a list of municipality names.
 *
 * Postal codes are resolved dynamically at runtime via WFS API:
 *   municipality name → municipality code → postal codes (WFS) → filter against stat.fi
 */

// ── Master input: municipalities to fetch ──

/** Municipalities to include in data fetching. Add/remove names here. */
export const TARGET_MUNICIPALITIES: string[] = [
    'Helsinki',
    'Espoo',
    'Vantaa',
    'Tampere',
    'Pirkkala',
    'Ylöjärvi',
    'Kangasala',
    'Nokia',
];

// ── Municipality name → code mapping ──

/**
 * Known municipality name → Tilastokeskus municipality code.
 * WFS data uses codes (e.g. '091'), not names.
 * Add new municipalities here when expanding TARGET_MUNICIPALITIES.
 *
 * Full list: https://stat.fi/fi/luokitukset/kunta/
 */
export const MUNICIPALITY_NAME_TO_CODE: ReadonlyMap<string, string> = new Map([
    ['Helsinki', '091'],
    ['Espoo', '049'],
    ['Vantaa', '092'],
    ['Tampere', '837'],
    ['Pirkkala', '604'],
    ['Ylöjärvi', '980'],
    ['Kangasala', '211'],
    ['Nokia', '536'],
    ['Turku', '853'],
    ['Oulu', '564'],
    ['Jyväskylä', '179'],
    ['Kuopio', '297'],
    ['Lahti', '398'],
    ['Pori', '609'],
    ['Joensuu', '167'],
    ['Lappeenranta', '405'],
    ['Hämeenlinna', '109'],
    ['Vaasa', '905'],
    ['Seinäjoki', '743'],
    ['Rovaniemi', '698'],
    ['Kouvola', '286'],
    ['Kotka', '285'],
    ['Mikkeli', '491'],
    ['Porvoo', '638'],
    ['Rauma', '684'],
    ['Kajaani', '205'],
    ['Kokkola', '272'],
    ['Lempäälä', '418'],
    ['Järvenpää', '186'],
    ['Kerava', '245'],
    ['Kirkkonummi', '257'],
    ['Nurmijärvi', '543'],
    ['Tuusula', '858'],
    ['Hyvinkää', '106'],
    ['Riihimäki', '694'],
    ['Sipoo', '753'],
    ['Kauniainen', '235'],
    ['Sastamala', '790'],
    ['Valkeakoski', '908'],
    ['Akaa', '020'],
]);

// ── Other fetch parameters ──

/** Starting year for data fetch */
export const FETCH_START_YEAR = 2018;

/**
 * Generate year range from FETCH_START_YEAR to current year (inclusive).
 */
export function generateYearRange(): string[] {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let y = FETCH_START_YEAR; y <= currentYear; y++) {
        years.push(String(y));
    }
    return years;
}

/** Default years to fetch (2018 → current year) */
export const DEFAULT_YEARS: string[] = generateYearRange();

/** Default building type codes from stat.fi */
export const DEFAULT_BUILDING_TYPES: string[] = ['1', '2', '3', '5'];

/** Default metric codes from stat.fi */
export const DEFAULT_METRICS: string[] = ['keskihinta_aritm_nw', 'lkm_julk20'];
