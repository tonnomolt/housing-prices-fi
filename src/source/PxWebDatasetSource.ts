import { createLogger } from '../utils/Logger.ts';

import type { DatasetMetadata, Variable } from '../model/Models.ts';
import type { Logger } from 'pino';

/**
 * Implementation of DatasetSource for PX-Web API
 * Handles communication with Statistics Finland's PX-Web API
 */
export class PxWebDatasetSource {
    datasetUrl: string;
    datasetName: string;
    private logger: Logger;

    constructor(datasetUrl: string) {
        this.datasetUrl = datasetUrl;
        this.datasetName = this.extractTableName(datasetUrl);
        this.logger = createLogger('PxWebDatasetSource');
    }

    async fetchMetadata(): Promise<DatasetMetadata> {
        this.logger.info(`Fetching metadata from: ${this.datasetUrl}`);
        const apiUrl = this.convertToApiUrl(this.datasetUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            let err: string = `Failed to fetch metadata. Status code: ${response.status}`;
            this.logger.error(err);
            throw new Error(err);
        }

        const body = await response.text();
        let parsedMetadata: DatasetMetadata = this.parseMetadata(body);
        this.logger.info("Metadata fetch done. Metadata information:");
        this.logger.info(`Title: ${parsedMetadata.title}`);
        this.logger.info(`Variables: ${parsedMetadata.variables.length}`);
        return parsedMetadata;
    }

    getUrl(): string {
        return this.datasetUrl;
    }

    /**
     * Converts a PX-Web UI URL to an API URL
     * Example: .../pxweb/fi/StatFin/.../table.px/ -> .../api/v1/fi/StatFin/.../table.px
     */
    private convertToApiUrl(url: string): string {
        // Remove trailing slash if present
        const cleanUrl = url.replace(/\/$/, '');

        // Check if already an API URL
        if (cleanUrl.includes('/api/v1/')) {
            return cleanUrl;
        }

        // Convert pxweb URL to API URL
        return cleanUrl.replace('/PXWeb/pxweb/', '/PXWeb/api/v1/');
    }

    /**
     * Parses the JSON metadata response from PX-Web API
     */
    private parseMetadata(jsonString: string): DatasetMetadata {
        const jsonObject = JSON.parse(jsonString);

        const title = jsonObject.title ?? 'Unknown';
        const source = jsonObject.source ?? undefined;
        const updated = jsonObject.updated ?? undefined;
        const description = jsonObject.description ?? undefined;

        const variables = (jsonObject.variables ?? []).map((varElement: any) =>
            this.parseVariable(varElement)
        );

        return {
            title,
            variables,
            source,
            updated,
            description
        };
    }

    /**
     * Parses a single variable from the metadata JSON
     */
    private parseVariable(varObject: any): Variable {
        const code = varObject.code ?? '';
        const text = varObject.text ?? '';

        const values = (varObject.values ?? []).map((v: any) => String(v));
        const valueTexts = (varObject.valueTexts ?? []).map((v: any) => String(v));

        const elimination = varObject.elimination ?? false;
        const time = varObject.time ?? false;

        return {
            code,
            text,
            values,
            valueTexts,
            elimination,
            time
        };
    }

    private extractTableName(url: string): string {
        let pxPos = url.lastIndexOf(".px");
        let lastSlashPos = url.lastIndexOf("/", pxPos - 1);
        if (pxPos === -1 || lastSlashPos === -1) {
            let err: string = `Failed to find slash OR .px in the given URL, only valid URLs ending with .px are required. URL that was used: ${url}`;
            this.logger.error(err);
            throw new Error(err);
        }
        
        return url.substring(lastSlashPos + 1, pxPos);
    }

}