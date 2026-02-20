import { sql } from '../db.ts';

/**
 * GET /api/geometries
 * Returns postal code geometries as a GeoJSON FeatureCollection.
 * Only includes postal codes that have geometry data.
 */
export async function getGeometries(): Promise<Response> {
    const rows = await sql`
        SELECT code, name, municipality, geometry
        FROM postal_code
        WHERE geometry IS NOT NULL
        ORDER BY code
    `;

    const features = rows.map((r) => ({
        type: 'Feature' as const,
        properties: {
            postalCode: r.code,
            name: r.name,
            municipality: r.municipality,
        },
        geometry: r.geometry,
    }));

    const featureCollection = {
        type: 'FeatureCollection',
        features,
    };

    return Response.json(featureCollection);
}
