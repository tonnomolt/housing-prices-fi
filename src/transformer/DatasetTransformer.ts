import { createLogger } from '../utils/Logger.ts';

import type {
    RawDataset,
    BuildingType,
    PriceRecord,
    TransformResult,
} from '../model/Models.ts';
import type { Logger } from 'pino';

/**
 * Mapping from stat.fi building type codes to our domain enum.
 * Source codes (from statfin_ashi_pxt_13mu):
 *   1 = Blocks of flats, one-room flat
 *   2 = Blocks of flats, two-room flat
 *   3 = Blocks of flats, three-room flat+
 *   5 = Terraced houses total
 */
const BUILDING_TYPE_MAP: Record<string, BuildingType> = {
    '1': 'apartment_1r',
    '2': 'apartment_2r',
    '3': 'apartment_3r_plus',
    '5': 'terraced',
};

/**
 * Known metric codes from the PxWeb dataset.
 * Used to identify which value in the flat array is price vs transaction count.
 */
const METRIC_PRICE = 'keskihinta_aritm_nw';
const METRIC_COUNT = 'lkm_julk20';

/**
 * Transforms a RawDataset (json-stat2 format from PxWeb) into
 * structured PriceRecord[] ready for database insertion.
 *
 * The json-stat2 format stores values in a flat array where the position
 * is determined by the cartesian product of all dimension indices:
 *   index = i_dim0 * size[1]*size[2]*...*size[n]
 *         + i_dim1 * size[2]*...*size[n]
 *         + ...
 *         + i_dimN
 */
export class DatasetTransformer {
    private logger: Logger;
    private sourceName: string;
    private rawDataset: RawDataset;

    constructor(rawDataset: RawDataset, datasetName: string) {
        this.logger = createLogger('DatasetTransformer');
        this.rawDataset = rawDataset;
        this.sourceName = datasetName;
    }

    /**
     * Main entry point: parse json-stat2 and produce PriceRecords.
     */
    transform(): TransformResult {
        this.logger.info('Starting transformation...');

        const jsonStat = JSON.parse(this.rawDataset.data);

        // Validate format
        if (jsonStat.class !== 'dataset') {
            throw new Error(`Unexpected json-stat2 class: ${jsonStat.class}`);
        }

        const dimensionIds: string[] = jsonStat.id;   // e.g. ['Vuosi', 'Postinumero', 'Talotyyppi', 'Tiedot']
        const sizes: number[] = jsonStat.size;          // e.g. [1, 1, 4, 2]
        const values: (number | null)[] = jsonStat.value;
        const statusMap: Record<string, string> = jsonStat.status ?? {};

        // Build dimension lookup: for each dimension, an ordered array of codes
        const dimensions = this.buildDimensionLookup(jsonStat.dimension, dimensionIds);

        // Find dimension indices by their role/id
        const yearDimIdx = dimensionIds.indexOf('Vuosi');
        const postalDimIdx = dimensionIds.indexOf('Postinumero');
        const typeDimIdx = dimensionIds.indexOf('Talotyyppi');
        const metricDimIdx = dimensionIds.indexOf('Tiedot');

        if ([yearDimIdx, postalDimIdx, typeDimIdx, metricDimIdx].includes(-1)) {
            throw new Error(
                `Missing expected dimension(s). Found: ${dimensionIds.join(', ')}`
            );
        }

        // Find metric indices within the Tiedot dimension
        const metricCodes = dimensions[metricDimIdx];
        const priceMetricIdx = metricCodes.indexOf(METRIC_PRICE);
        const countMetricIdx = metricCodes.indexOf(METRIC_COUNT);

        if (priceMetricIdx === -1 && countMetricIdx === -1) {
            throw new Error(
                `Neither price nor count metric found. Available: ${metricCodes.join(', ')}`
            );
        }

        // Pre-compute stride for each dimension (for flat array indexing)
        const strides = this.computeStrides(sizes);

        const records: PriceRecord[] = [];
        let skipped = 0;

        // Iterate over all combinations except the metric dimension
        const yearCodes = dimensions[yearDimIdx];
        const postalCodes = dimensions[postalDimIdx];
        const typeCodes = dimensions[typeDimIdx];

        for (let yi = 0; yi < yearCodes.length; yi++) {
            const year = yearCodes[yi];
            const date = new Date(`${year}-01-01T00:00:00Z`);

            for (let pi = 0; pi < postalCodes.length; pi++) {
                const postalCode = postalCodes[pi];

                for (let ti = 0; ti < typeCodes.length; ti++) {
                    const typeCode = typeCodes[ti];
                    const buildingType = BUILDING_TYPE_MAP[typeCode];

                    if (!buildingType) {
                        this.logger.warn(
                            `Unknown building type code '${typeCode}', skipping`
                        );
                        skipped++;
                        continue;
                    }

                    // Compute flat array indices for price and count
                    const baseIndex = this.computeIndex(
                        [yi, pi, ti, 0],
                        [yearDimIdx, postalDimIdx, typeDimIdx, metricDimIdx],
                        strides,
                        dimensionIds.length
                    );

                    const priceValue =
                        priceMetricIdx !== -1
                            ? this.getValue(values, baseIndex, priceMetricIdx, strides[metricDimIdx], statusMap)
                            : null;

                    const countValue =
                        countMetricIdx !== -1
                            ? this.getValue(values, baseIndex, countMetricIdx, strides[metricDimIdx], statusMap)
                            : null;

                    // Skip if both values are null (no data at all)
                    if (priceValue === null && countValue === null) {
                        skipped++;
                        continue;
                    }

                    records.push({
                        postalCode,
                        buildingType,
                        date,
                        pricePerSqm: priceValue,
                        transactionCount: countValue !== null ? Math.round(countValue) : null,
                        sourceName: this.sourceName,
                    });
                }
            }
        }

        this.logger.info(
            `Transformation complete: ${records.length} records, ${skipped} skipped`
        );

        return { records, skipped, sourceName: this.sourceName };
    }

    /**
     * Builds an ordered array of category codes for each dimension.
     */
    private buildDimensionLookup(
        dimensionObj: Record<string, any>,
        dimensionIds: string[]
    ): string[][] {
        return dimensionIds.map((dimId) => {
            const dim = dimensionObj[dimId];
            if (!dim?.category?.index) {
                throw new Error(`Dimension '${dimId}' missing category index`);
            }
            // category.index is { code: position }, we need codes ordered by position
            const indexMap: Record<string, number> = dim.category.index;
            const entries = Object.entries(indexMap).sort(
                ([, a], [, b]) => a - b
            );
            return entries.map(([code]) => code);
        });
    }

    /**
     * Computes strides for each dimension in the flat value array.
     * stride[i] = product of sizes[i+1] * sizes[i+2] * ... * sizes[n-1]
     */
    private computeStrides(sizes: number[]): number[] {
        const strides = new Array(sizes.length);
        strides[sizes.length - 1] = 1;
        for (let i = sizes.length - 2; i >= 0; i--) {
            strides[i] = strides[i + 1] * sizes[i + 1];
        }
        return strides;
    }

    /**
     * Computes the flat array index for a given set of dimension indices.
     * dimIndices and dimPositions map which dimension index goes where.
     * The metric dimension is set to 0 (base), caller adds metric offset separately.
     */
    private computeIndex(
        indices: number[],
        dimPositions: number[],
        strides: number[],
        numDims: number
    ): number {
        let flatIndex = 0;
        for (let d = 0; d < dimPositions.length; d++) {
            flatIndex += indices[d] * strides[dimPositions[d]];
        }
        return flatIndex;
    }

    /**
     * Gets a value from the flat array, respecting the status map for
     * confidential/missing data.
     */
    private getValue(
        values: (number | null)[],
        baseIndex: number,
        metricOffset: number,
        metricStride: number,
        statusMap: Record<string, string>
    ): number | null {
        const idx = baseIndex + metricOffset * metricStride;
        const statusKey = String(idx);

        // If status indicates confidential or missing, return null
        if (statusMap[statusKey]) {
            return null;
        }

        const val = values[idx];
        return val !== null && val !== undefined ? val : null;
    }
}
