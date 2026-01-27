import { createLogger } from '../utils/Logger.ts';

import type { DatasetMetadata, Variable } from '../model/Models.ts';
import type { Logger } from 'pino';

/**
 * Implementation of DatasetSource for PX-Web API
 * Handles communication with Statistics Finland's PX-Web API
 */
export class PxWebDatasetSource {
    private datasetUrl: string;
    private logger: Logger;

    constructor(datasetUrl: string) {
        this.datasetUrl = datasetUrl;
        this.logger = createLogger('PxWebDatasetSource');
    }

    async fetchMetadata(): Promise<DatasetMetadata> {
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
        return this.parseMetadata(body);
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
}