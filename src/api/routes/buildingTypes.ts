import { sql } from '../db.ts';

/**
 * GET /api/building-types
 * Returns all canonical building types.
 */
export async function getBuildingTypes(): Promise<Response> {
    const rows = await sql`
        SELECT code, description, description_fi
        FROM building_type
        ORDER BY
            CASE code
                WHEN 'all' THEN 0
                WHEN 'apartment_1r' THEN 1
                WHEN 'apartment_2r' THEN 2
                WHEN 'apartment_3r_plus' THEN 3
                WHEN 'terraced' THEN 4
                ELSE 5
            END
    `;

    return Response.json(rows);
}
