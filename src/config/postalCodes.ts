/**
 * @deprecated Use fetchConfig.ts instead. This file kept for backward compatibility.
 *
 * Postal codes are now resolved dynamically from municipality names via WFS API.
 * Static exports removed — use MunicipalityResolver at runtime.
 */

export {
    TARGET_MUNICIPALITIES,
    MUNICIPALITY_NAME_TO_CODE,
    FETCH_START_YEAR,
    generateYearRange,
    DEFAULT_YEARS,
    DEFAULT_BUILDING_TYPES,
    DEFAULT_METRICS,
} from './fetchConfig.ts';
