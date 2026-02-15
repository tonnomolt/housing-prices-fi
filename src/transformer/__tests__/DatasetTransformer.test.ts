import { describe, test, expect } from 'bun:test';
import { DatasetTransformer } from '../DatasetTransformer.ts';
import { STATFIN_BUILDING_TYPE_MAPPINGS } from '../StatfinBuildingTypes.ts';
import type { RawDataset, DatasetMetadata, BuildingTypeMapping } from '../../model/Models.ts';

// ── Test helpers ──

const DUMMY_METADATA: DatasetMetadata = {
    title: 'Test dataset',
    variables: [],
};

/**
 * Builds a minimal json-stat2 dataset string for testing.
 * Dimensions: Vuosi × Postinumero × Talotyyppi × Tiedot
 */
function buildJsonStat2(opts: {
    years: string[];
    postalCodes: string[];
    buildingTypes: Record<string, string>; // code → label
    metrics: Record<string, string>;       // code → label
    values: (number | null)[];
    status?: Record<string, string>;
}): string {
    const { years, postalCodes, buildingTypes, metrics, values, status } = opts;

    const buildIndex = (keys: string[]) =>
        Object.fromEntries(keys.map((k, i) => [k, i]));

    const buildLabels = (map: Record<string, string>) => map;

    return JSON.stringify({
        class: 'dataset',
        id: ['Vuosi', 'Postinumero', 'Talotyyppi', 'Tiedot'],
        size: [
            years.length,
            postalCodes.length,
            Object.keys(buildingTypes).length,
            Object.keys(metrics).length,
        ],
        dimension: {
            Vuosi: {
                label: 'Year',
                category: {
                    index: buildIndex(years),
                    label: Object.fromEntries(years.map((y) => [y, y])),
                },
            },
            Postinumero: {
                label: 'Postal code',
                category: {
                    index: buildIndex(postalCodes),
                    label: Object.fromEntries(
                        postalCodes.map((p) => [p, `${p} Test`])
                    ),
                },
            },
            Talotyyppi: {
                label: 'Building type',
                category: {
                    index: buildIndex(Object.keys(buildingTypes)),
                    label: buildLabels(buildingTypes),
                },
            },
            Tiedot: {
                label: 'Information',
                category: {
                    index: buildIndex(Object.keys(metrics)),
                    label: buildLabels(metrics),
                },
            },
        },
        value: values,
        ...(status ? { status } : {}),
    });
}

const DEFAULT_BUILDING_TYPES: Record<string, string> = {
    '1': 'Blocks of flats, one-room flat',
    '2': 'Blocks of flats, two-room flat',
    '3': 'Blocks of flats, three-room flat+',
    '5': 'Terraced houses total',
};

const DEFAULT_METRICS: Record<string, string> = {
    keskihinta_aritm_nw: 'Price per square meter (EUR/m2)',
    lkm_julk20: 'Number of sales',
};

function makeRawDataset(data: string): RawDataset {
    return { format: 'json-stat2', data, metadata: DUMMY_METADATA };
}

// ── Tests ──

describe('DatasetTransformer', () => {
    test('happy path: single postal code, single year, 4 building types', () => {
        const data = buildJsonStat2({
            years: ['2024'],
            postalCodes: ['00400'],
            buildingTypes: DEFAULT_BUILDING_TYPES,
            metrics: DEFAULT_METRICS,
            // 4 types × 2 metrics = 8 values
            // apartment_1r: 4668€, 29 sales
            // apartment_2r: 3939€, 63 sales
            // apartment_3r_plus: 4175€, 60 sales
            // terraced: 3500€, 10 sales
            values: [4668, 29, 3939, 63, 4175, 60, 3500, 10],
        });

        const transformer = new DatasetTransformer(
            makeRawDataset(data),
            'test_source',
            STATFIN_BUILDING_TYPE_MAPPINGS
        );
        const result = transformer.transform();

        expect(result.records).toHaveLength(4);
        expect(result.skipped).toBe(0);
        expect(result.sourceName).toBe('test_source');

        expect(result.records[0]).toEqual({
            postalCode: '00400',
            buildingType: 'apartment_1r',
            date: new Date('2024-01-01T00:00:00Z'),
            pricePerSqm: 4668,
            transactionCount: 29,
            sourceName: 'test_source',
        });

        expect(result.records[1].buildingType).toBe('apartment_2r');
        expect(result.records[1].pricePerSqm).toBe(3939);

        expect(result.records[2].buildingType).toBe('apartment_3r_plus');
        expect(result.records[3].buildingType).toBe('terraced');
        expect(result.records[3].pricePerSqm).toBe(3500);
        expect(result.records[3].transactionCount).toBe(10);
    });

    test('confidential data: status map marks value as missing → null price, count preserved', () => {
        const data = buildJsonStat2({
            years: ['2024'],
            postalCodes: ['00400'],
            buildingTypes: { '1': 'Yksiöt', '5': 'Rivitalot' },
            metrics: DEFAULT_METRICS,
            // apartment_1r: 4668€, 29 sales
            // terraced: null (confidential), 1 sale
            values: [4668, 29, null, 1],
            status: { '2': '...' }, // index 2 = terraced price → confidential
        });

        const mappings: BuildingTypeMapping[] = [
            { sourceCode: '1', sourceLabel: 'Yksiöt', canonicalCode: 'apartment_1r' },
            { sourceCode: '5', sourceLabel: 'Rivitalot', canonicalCode: 'terraced' },
        ];

        const transformer = new DatasetTransformer(
            makeRawDataset(data),
            'test_source',
            mappings
        );
        const result = transformer.transform();

        expect(result.records).toHaveLength(2);

        // apartment_1r: normal
        expect(result.records[0].pricePerSqm).toBe(4668);
        expect(result.records[0].transactionCount).toBe(29);

        // terraced: price null (confidential), count preserved
        expect(result.records[1].pricePerSqm).toBeNull();
        expect(result.records[1].transactionCount).toBe(1);
    });

    test('both values null → record is skipped', () => {
        const data = buildJsonStat2({
            years: ['2024'],
            postalCodes: ['00400'],
            buildingTypes: { '1': 'Yksiöt' },
            metrics: DEFAULT_METRICS,
            values: [null, null],
            status: { '0': '...', '1': '...' },
        });

        const mappings: BuildingTypeMapping[] = [
            { sourceCode: '1', sourceLabel: 'Yksiöt', canonicalCode: 'apartment_1r' },
        ];

        const transformer = new DatasetTransformer(
            makeRawDataset(data),
            'test_source',
            mappings
        );
        const result = transformer.transform();

        expect(result.records).toHaveLength(0);
        expect(result.skipped).toBe(1);
    });

    test('unknown building type code → skipped with warning', () => {
        const data = buildJsonStat2({
            years: ['2024'],
            postalCodes: ['00100'],
            buildingTypes: { '1': 'Yksiöt', '99': 'Tuntematon tyyppi' },
            metrics: DEFAULT_METRICS,
            values: [4000, 20, 3000, 5],
        });

        // Only map code '1', leave '99' unmapped
        const mappings: BuildingTypeMapping[] = [
            { sourceCode: '1', sourceLabel: 'Yksiöt', canonicalCode: 'apartment_1r' },
        ];

        const transformer = new DatasetTransformer(
            makeRawDataset(data),
            'test_source',
            mappings
        );
        const result = transformer.transform();

        expect(result.records).toHaveLength(1);
        expect(result.skipped).toBe(1); // code '99' skipped
        expect(result.records[0].buildingType).toBe('apartment_1r');
    });

    test('multiple years and postal codes → stride calculation correct', () => {
        const data = buildJsonStat2({
            years: ['2023', '2024'],
            postalCodes: ['00100', '00200'],
            buildingTypes: { '1': 'Yksiöt' },
            metrics: DEFAULT_METRICS,
            // Layout: year0/postal0/type0/[price,count], year0/postal1/type0/[price,count],
            //         year1/postal0/type0/[price,count], year1/postal1/type0/[price,count]
            values: [
                3000, 10,  // 2023, 00100
                3500, 15,  // 2023, 00200
                3200, 12,  // 2024, 00100
                3800, 18,  // 2024, 00200
            ],
        });

        const mappings: BuildingTypeMapping[] = [
            { sourceCode: '1', sourceLabel: 'Yksiöt', canonicalCode: 'apartment_1r' },
        ];

        const transformer = new DatasetTransformer(
            makeRawDataset(data),
            'test_source',
            mappings
        );
        const result = transformer.transform();

        expect(result.records).toHaveLength(4);

        // 2023, 00100
        expect(result.records[0].date).toEqual(new Date('2023-01-01T00:00:00Z'));
        expect(result.records[0].postalCode).toBe('00100');
        expect(result.records[0].pricePerSqm).toBe(3000);

        // 2023, 00200
        expect(result.records[1].postalCode).toBe('00200');
        expect(result.records[1].pricePerSqm).toBe(3500);

        // 2024, 00100
        expect(result.records[2].date).toEqual(new Date('2024-01-01T00:00:00Z'));
        expect(result.records[2].postalCode).toBe('00100');
        expect(result.records[2].pricePerSqm).toBe(3200);

        // 2024, 00200
        expect(result.records[3].postalCode).toBe('00200');
        expect(result.records[3].pricePerSqm).toBe(3800);
        expect(result.records[3].transactionCount).toBe(18);
    });

    test('empty dataset → 0 records, no crash', () => {
        // A dataset with 0 years means size[0]=0, empty value array
        const jsonStat = JSON.stringify({
            class: 'dataset',
            id: ['Vuosi', 'Postinumero', 'Talotyyppi', 'Tiedot'],
            size: [0, 1, 1, 2],
            dimension: {
                Vuosi: { label: 'Year', category: { index: {}, label: {} } },
                Postinumero: {
                    label: 'Postal code',
                    category: { index: { '00100': 0 }, label: { '00100': '00100 Test' } },
                },
                Talotyyppi: {
                    label: 'Building type',
                    category: { index: { '1': 0 }, label: { '1': 'Yksiöt' } },
                },
                Tiedot: {
                    label: 'Information',
                    category: {
                        index: { keskihinta_aritm_nw: 0, lkm_julk20: 1 },
                        label: { keskihinta_aritm_nw: 'Price', lkm_julk20: 'Count' },
                    },
                },
            },
            value: [],
        });

        const mappings: BuildingTypeMapping[] = [
            { sourceCode: '1', sourceLabel: 'Yksiöt', canonicalCode: 'apartment_1r' },
        ];

        const transformer = new DatasetTransformer(
            makeRawDataset(jsonStat),
            'test_source',
            mappings
        );
        const result = transformer.transform();

        expect(result.records).toHaveLength(0);
        expect(result.skipped).toBe(0);
    });

    test('transform result includes building type mappings', () => {
        const data = buildJsonStat2({
            years: ['2024'],
            postalCodes: ['00100'],
            buildingTypes: { '1': 'Yksiöt' },
            metrics: DEFAULT_METRICS,
            values: [5000, 40],
        });

        const mappings: BuildingTypeMapping[] = [
            { sourceCode: '1', sourceLabel: 'Yksiöt', canonicalCode: 'apartment_1r' },
        ];

        const transformer = new DatasetTransformer(
            makeRawDataset(data),
            'test_source',
            mappings
        );
        const result = transformer.transform();

        expect(result.buildingTypeMappings).toEqual(mappings);
    });
});
