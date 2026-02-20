import { sql } from '../db.ts';

/**
 * GET /api/years
 * Returns distinct years that have price data, sorted ascending.
 */
export async function getYears(): Promise<Response> {
    const rows = await sql`
        SELECT DISTINCT EXTRACT(YEAR FROM date)::int AS year
        FROM price_data
        ORDER BY year
    `;

    const years = rows.map((r) => r.year);
    return Response.json(years);
}
