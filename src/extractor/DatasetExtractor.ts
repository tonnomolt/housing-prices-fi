import { createLogger } from '../utils/Logger.ts';

import type {
    DatasetMetadata,
    RawDataset,
    PxWebQuery,
    QueryConfig,
    VariableSelection,
    Selection,
    ResponseFormat
} from '../model/Models.ts';
import { DEFAULT_BUILDING_TYPES, DEFAULT_METRICS } from '../config/fetchConfig.ts';
import type { Logger } from 'pino';

/**
 * Extracts raw datasets from PX-Web API based on metadata
 */
export class DatasetExtractor {
    /**
     * Extracts the complete dataset using metadata information
     * @param metadata Dataset metadata containing variables and structure
     * @param apiUrl The API endpoint URL for the dataset
     * @param format Output format (default: "json-stat2")
     * @return RawDataset containing the extracted data
     */
    private logger: Logger;

    constructor() {
        this.logger = createLogger('DatasetExtractor');
    }

    async extract(
        metadata: DatasetMetadata,
        apiUrl: string,
        format: string = 'json-stat2'
    ): Promise<RawDataset> {
        this.logger.info("Extracting dataset (default query — all values)...");
        const query = this.buildDefaultQuery(metadata, format);

        let fetchedData: RawDataset = await this.executeQuery(apiUrl, metadata, query, format);
        this.logger.info("Extracting dataset complete");
        this.logger.info(`Format: ${fetchedData.format}`);
        this.logger.info(`Data size: ${fetchedData.data.length} bytes`);
        return fetchedData;
    }

    /**
     * Extracts dataset using a QueryConfig, batching postal codes to avoid
     * API response size limits. Returns one RawDataset per batch.
     */
    async extractBatched(
        metadata: DatasetMetadata,
        apiUrl: string,
        config: QueryConfig,
        batchSize: number = 30,
        format: string = 'json-stat2'
    ): Promise<RawDataset[]> {
        // Validate postal codes and years against metadata
        const validConfig = this.validateConfig(metadata, config);
        const postalBatches = this.chunk(validConfig.postalCodes, batchSize);
        this.logger.info(`Extracting ${validConfig.postalCodes.length} postal codes in ${postalBatches.length} batch(es), years: ${validConfig.years.join(',')}`);

        const results: RawDataset[] = [];

        for (let i = 0; i < postalBatches.length; i++) {
            const batch = postalBatches[i];
            this.logger.info(`Batch ${i + 1}/${postalBatches.length}: ${batch.length} postal codes (${batch[0]}–${batch[batch.length - 1]})`);

            const query = this.buildConfigQuery({
                ...validConfig,
                postalCodes: batch,
            }, format);

            try {
                const raw = await this.executeQuery(apiUrl, metadata, query, format);
                this.logger.info(`  → ${raw.data.length} bytes`);
                results.push(raw);
            } catch (err) {
                this.logger.warn(`  → Batch ${i + 1} failed: ${err instanceof Error ? err.message : err}`);
                // Continue with remaining batches
            }

            // Rate limit: wait between requests (skip after last batch)
            if (i < postalBatches.length - 1) {
                await this.delay(500);
            }
        }

        this.logger.info(`Extraction complete: ${results.length}/${postalBatches.length} batches succeeded`);
        return results;
    }

    /**
     * Validates QueryConfig against metadata, filtering out codes that don't exist in the API.
     */
    private validateConfig(metadata: DatasetMetadata, config: QueryConfig): QueryConfig {
        const postalVar = metadata.variables.find(v => v.code === 'Postinumero');
        const yearVar = metadata.variables.find(v => v.code === 'Vuosi');
        const typeVar = metadata.variables.find(v => v.code === 'Talotyyppi');

        const validPostal = postalVar
            ? config.postalCodes.filter(pc => postalVar.values.includes(pc))
            : config.postalCodes;

        const validYears = yearVar
            ? config.years.filter(y => yearVar.values.includes(y))
            : config.years;

        const buildingTypes = config.buildingTypes ?? DEFAULT_BUILDING_TYPES;
        const validTypes = typeVar
            ? buildingTypes.filter(t => typeVar.values.includes(t))
            : buildingTypes;

        const removedPostal = config.postalCodes.length - validPostal.length;
        const removedYears = config.years.length - validYears.length;
        if (removedPostal > 0) {
            this.logger.info(`Filtered out ${removedPostal} postal codes not found in API`);
        }
        if (removedYears > 0) {
            this.logger.info(`Filtered out ${removedYears} years not found in API`);
        }

        return {
            ...config,
            postalCodes: validPostal,
            years: validYears,
            buildingTypes: validTypes,
        };
    }

    /**
     * Builds a query from QueryConfig
     */
    private buildConfigQuery(config: QueryConfig, format: string): PxWebQuery {
        const buildingTypes = config.buildingTypes ?? DEFAULT_BUILDING_TYPES;
        const metrics = config.metrics ?? DEFAULT_METRICS;

        const selections: VariableSelection[] = [
            { code: 'Vuosi', selection: { filter: 'item', values: config.years } },
            { code: 'Postinumero', selection: { filter: 'item', values: config.postalCodes } },
            { code: 'Talotyyppi', selection: { filter: 'item', values: buildingTypes } },
            { code: 'Tiedot', selection: { filter: 'item', values: metrics } },
        ];

        return { query: selections, response: { format } };
    }

    private chunk<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Extracts dataset with a custom query
     * @param metadata Dataset metadata
     * @param apiUrl The API endpoint URL for the dataset
     * @param query Custom PxWebQuery
     * @param format Output format
     * @return RawDataset containing the extracted data
     */
    async extractWithQuery(
        metadata: DatasetMetadata,
        apiUrl: string,
        query: PxWebQuery,
        format: string = 'json-stat2'
    ): Promise<RawDataset> {
        return this.executeQuery(apiUrl, metadata, query, format);
    }

    /**
     * Builds a default query that selects all values for all variables
     */
    private buildDefaultQuery(metadata: DatasetMetadata, format: string): PxWebQuery {
        const selections = metadata.variables.map((variable) => ({
            code: variable.code,
            selection: {
                filter: 'item',
                values: variable.values
            }
        }));

        return {
            query: selections,
            response: { format }
        };
    }

    /**
     * Executes the query against the PX-Web API
     */
    private async executeQuery(
        apiUrl: string,
        metadata: DatasetMetadata,
        query: PxWebQuery,
        format: string
    ): Promise<RawDataset> {
        const requestBody = JSON.stringify(query, null, 2);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: requestBody,
            redirect: 'follow'
        });

        if (!response.ok) {
            const body = await response.text();
            let err: string = `Failed to extract dataset. Status code: ${response.status}, Body: ${body}`;
            this.logger.error(err);
            throw new Error(err);
        }

        const data = await response.text();

        return {
            format,
            data,
            metadata
        };
    }

    /**
     * Helper method to create a query that selects the latest N values for time variables
     */
    buildLatestDataQuery(
        metadata: DatasetMetadata,
        topN: number = 1,
        format: string = 'json-stat2'
    ): PxWebQuery {
        const selections = metadata.variables.map((variable) => {
            if (variable.time === true) {
                // For time variables, select the top N latest values
                return {
                    code: variable.code,
                    selection: {
                        filter: 'top',
                        values: [topN.toString()]
                    }
                };
            } else {
                // For other variables, select all values
                return {
                    code: variable.code,
                    selection: {
                        filter: 'item',
                        values: variable.values
                    }
                };
            }
        });

        return {
            query: selections,
            response: { format }
        };
    }
}