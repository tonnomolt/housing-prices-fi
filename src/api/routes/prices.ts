import { sql } from '../db.ts';

/**
 * GET /api/prices?year=2024&building_type=all
 *
 * Returns per-postal-code prices for the given year and building type,
 * including the previous year's price and year-over-year change percentage.
 */
export async function getPrices(url: URL): Promise<Response> {
    const yearParam = url.searchParams.get('year');
    const buildingType = url.searchParams.get('building_type') ?? 'all';

    if (!yearParam) {
        return Response.json({ error: 'year parameter is required' }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year)) {
        return Response.json({ error: 'year must be a number' }, { status: 400 });
    }

    const prevYear = year - 1;
    const currentDate = `${year}-01-01`;
    const prevDate = `${prevYear}-01-01`;

    const rows = await sql`
        WITH current AS (
            SELECT
                pd.postal_code,
                pc.name,
                pc.municipality,
                pd.price_per_sqm
            FROM price_data pd
            LEFT JOIN postal_code pc ON pc.code = pd.postal_code
            WHERE pd.date = ${currentDate}
              AND pd.building_type = ${buildingType}
        ),
        previous AS (
            SELECT
                pd.postal_code,
                pd.price_per_sqm
            FROM price_data pd
            WHERE pd.date = ${prevDate}
              AND pd.building_type = ${buildingType}
        )
        SELECT
            c.postal_code,
            c.name,
            c.municipality,
            c.price_per_sqm,
            p.price_per_sqm AS prev_price_per_sqm,
            CASE
                WHEN p.price_per_sqm IS NOT NULL AND p.price_per_sqm > 0 AND c.price_per_sqm IS NOT NULL
                THEN ROUND(((c.price_per_sqm - p.price_per_sqm) / p.price_per_sqm * 100)::numeric, 2)
                ELSE NULL
            END AS change_percent
        FROM current c
        LEFT JOIN previous p ON p.postal_code = c.postal_code
        ORDER BY c.postal_code
    `;

    const result = rows.map((r) => ({
        postalCode: r.postal_code,
        name: r.name,
        municipality: r.municipality,
        pricePerSqm: r.price_per_sqm ? Number(r.price_per_sqm) : null,
        prevPricePerSqm: r.prev_price_per_sqm ? Number(r.prev_price_per_sqm) : null,
        changePercent: r.change_percent ? Number(r.change_percent) : null,
    }));

    return Response.json(result);
}
