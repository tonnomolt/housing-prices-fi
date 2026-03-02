import { sql } from '../db.ts';

/**
 * GET /api/municipalities
 *
 * Returns the list of available municipalities with their postal code counts.
 * Data sourced from the postal_code table in the database.
 */
export async function getMunicipalities(): Promise<Response> {
    const rows = await sql`
        SELECT municipality AS name, COUNT(*) AS postal_code_count
        FROM postal_code
        WHERE municipality IS NOT NULL
        GROUP BY municipality
        ORDER BY municipality
    `;

    const result = rows.map(r => ({
        name: r.name,
        postalCodeCount: Number(r.postal_code_count),
    }));

    return Response.json(result);
}
