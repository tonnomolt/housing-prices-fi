import type { BuildingTypeMapping, BuildingTypeInfo } from '../model/Models.ts';

/**
 * Canonical building type reference data.
 * This is the "truth" — all sources map to these.
 */
export const BUILDING_TYPES: BuildingTypeInfo[] = [
    {
        code: 'all',
        description: 'All building types',
        descriptionFi: 'Kaikki talotyypit',
    },
    {
        code: 'apartment_1r',
        description: 'Block of flats, one-room flat',
        descriptionFi: 'Kerrostalo, yksiö',
    },
    {
        code: 'apartment_2r',
        description: 'Block of flats, two-room flat',
        descriptionFi: 'Kerrostalo, kaksio',
    },
    {
        code: 'apartment_3r_plus',
        description: 'Block of flats, three rooms or more',
        descriptionFi: 'Kerrostalo, kolmio+',
    },
    {
        code: 'terraced',
        description: 'Terraced houses',
        descriptionFi: 'Rivitalo',
    },
];

/**
 * Building type mappings for Statistics Finland (statfin_ashi_pxt_13mu).
 *
 * Source codes and labels come from the PxWeb API dimension
 * "Talotyyppi" → category.index + category.label.
 *
 * When adding a new data source, create a similar mapping array
 * with that source's codes/labels pointing to the same canonical codes.
 */
export const STATFIN_BUILDING_TYPE_MAPPINGS: BuildingTypeMapping[] = [
    {
        sourceCode: '1',
        sourceLabel: 'Blocks of flats, one-room flat',
        canonicalCode: 'apartment_1r',
    },
    {
        sourceCode: '2',
        sourceLabel: 'Blocks of flats, two-room flat',
        canonicalCode: 'apartment_2r',
    },
    {
        sourceCode: '3',
        sourceLabel: 'Blocks of flats, three-room flat+',
        canonicalCode: 'apartment_3r_plus',
    },
    {
        sourceCode: '5',
        sourceLabel: 'Terraced houses total',
        canonicalCode: 'terraced',
    },
];

/**
 * Utility: builds BuildingTypeMappings from a json-stat2 dimension,
 * using a provided code→canonical lookup.
 * Useful when a new source has known codes but you want to auto-extract labels.
 */
export function buildMappingsFromDimension(
    dimensionCategory: { index: Record<string, number>; label: Record<string, string> },
    codeToCanonical: Record<string, string>
): BuildingTypeMapping[] {
    return Object.entries(dimensionCategory.index)
        .sort(([, a], [, b]) => a - b)
        .map(([code]) => ({
            sourceCode: code,
            sourceLabel: dimensionCategory.label[code] ?? code,
            canonicalCode: (codeToCanonical[code] ?? 'all') as any,
        }));
}
