import { createLogger } from '../utils/Logger.ts';

import type {
    DatasetMetadata,
    RawDataset,
    PxWebQuery,
    VariableSelection,
    Selection,
    ResponseFormat
} from '../model/Models.ts';
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
        this.logger.info("Extracting dataset...");
        //TODO replace with buildDefaultQuery after initial tests
        const query = this.buildTestQuery(metadata, format);
        //const query = this.buildDefaultQuery(metadata, format);

        let fetchedData: RawDataset = await this.executeQuery(apiUrl, metadata, query, format);
        this.logger.info("Extracting dataset complete");
        this.logger.info(`Format: ${fetchedData.format}`);
        this.logger.info(`Data size: ${fetchedData.data.length} bytes`);
        return fetchedData;
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

    //TEMP method that mimics only parts of metadata for a certain API just to see that extracting this works
    //wont make the final implementation
    private buildTestQuery(metadata: DatasetMetadata, format: string = 'json-stat'): PxWebQuery {
        // Define the exact variable codes and values from your working query
        const testSelections: VariableSelection[] = [
            {
                code: 'Vuosi',
                selection: {
                    filter: 'item',
                    values: ['2024']
                }
            },
            {
                code: 'Postinumero',
                selection: {
                    filter: 'item',
                    values: ['00400']
                }
            },
            {
                code: 'Talotyyppi',
                selection: {
                    filter: 'item',
                    values: ['1', '2', '3', '5'] // All building types
                }
            },
            {
                code: 'Tiedot',
                selection: {
                    filter: 'item',
                    values: ['keskihinta_aritm_nw', 'lkm_julk20'] // Both metrics
                }
            }
        ];

        return {
            query: testSelections,
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