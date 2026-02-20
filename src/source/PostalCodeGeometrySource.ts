import { createLogger } from '../utils/Logger.ts';

const logger = createLogger('PostalCodeGeometrySource');

/**
 * A single postal code area with geometry and metadata from Tilastokeskus WFS.
 */
export interface PostalCodeFeature {
    postalCode: string;
    name: string;          // Finnish name
    municipality: string;  // Municipality code (e.g. '091')
    geometry: object;      // GeoJSON geometry (MultiPolygon in WGS84)
}

const WFS_BASE = 'https://geo.stat.fi/geoserver/postialue/wfs';
const LAYER = 'postialue:pno_tilasto_2024';

/**
 * Fetches postal code area geometries from Tilastokeskus WFS API.
 * Returns GeoJSON geometries in WGS84 (EPSG:4326) suitable for Leaflet.
 */
export class PostalCodeGeometrySource {
    /**
     * Fetch all postal code areas from WFS.
     * The API returns ~3000 features; we fetch in one request.
     */
    async fetchAll(): Promise<PostalCodeFeature[]> {
        const url = new URL(WFS_BASE);
        url.searchParams.set('service', 'WFS');
        url.searchParams.set('version', '2.0.0');
        url.searchParams.set('request', 'GetFeature');
        url.searchParams.set('typeName', LAYER);
        url.searchParams.set('outputFormat', 'application/json');
        url.searchParams.set('srsName', 'EPSG:4326');
        // Note: propertyName filter excludes geometry, so we fetch all properties
        logger.info(`Fetching postal code geometries from Tilastokeskus WFS...`);

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`WFS request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as {
            features: Array<{
                properties: {
                    postinumeroalue: string;
                    nimi: string;
                    kunta: string;
                };
                geometry: object;
            }>;
            totalFeatures: number;
        };

        logger.info(`Received ${data.features.length} / ${data.totalFeatures} features`);

        return data.features.map((f) => ({
            postalCode: f.properties.postinumeroalue,
            name: f.properties.nimi,
            municipality: f.properties.kunta,
            geometry: f.geometry,
        }));
    }

    /**
     * Fetch geometries only for specific postal codes.
     * Uses CQL_FILTER for server-side filtering.
     */
    async fetchForCodes(codes: string[]): Promise<PostalCodeFeature[]> {
        if (codes.length === 0) return [];

        const cqlValues = codes.map((c) => `'${c}'`).join(',');
        const cqlFilter = `postinumeroalue IN (${cqlValues})`;

        const url = new URL(WFS_BASE);
        url.searchParams.set('service', 'WFS');
        url.searchParams.set('version', '2.0.0');
        url.searchParams.set('request', 'GetFeature');
        url.searchParams.set('typeName', LAYER);
        url.searchParams.set('outputFormat', 'application/json');
        url.searchParams.set('srsName', 'EPSG:4326');
        url.searchParams.set('CQL_FILTER', cqlFilter);

        logger.info(`Fetching geometries for ${codes.length} postal codes...`);

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`WFS request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as {
            features: Array<{
                properties: {
                    postinumeroalue: string;
                    nimi: string;
                    kunta: string;
                };
                geometry: object;
            }>;
        };

        logger.info(`Received ${data.features.length} features`);

        return data.features.map((f) => ({
            postalCode: f.properties.postinumeroalue,
            name: f.properties.nimi,
            municipality: f.properties.kunta,
            geometry: f.geometry,
        }));
    }
}
