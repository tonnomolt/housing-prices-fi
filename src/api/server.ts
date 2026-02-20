import { createLogger } from '../utils/Logger.ts';
import { getYears } from './routes/years.ts';
import { getPrices } from './routes/prices.ts';
import { getBuildingTypes } from './routes/buildingTypes.ts';

const logger = createLogger('API');
const PORT = parseInt(process.env.API_PORT ?? '3000', 10);

/**
 * Housing Prices FI — Backend API
 *
 * Endpoints:
 *   GET /api/years           — Available years
 *   GET /api/prices          — Prices by year & building type (with YoY change)
 *   GET /api/building-types  — Canonical building types
 */

const server = Bun.serve({
    port: PORT,

    async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const { pathname } = url;

        // CORS headers for frontend dev
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (req.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            let response: Response;

            switch (pathname) {
                case '/api/years':
                    response = await getYears();
                    break;
                case '/api/prices':
                    response = await getPrices(url);
                    break;
                case '/api/building-types':
                    response = await getBuildingTypes();
                    break;
                case '/health':
                    response = Response.json({ status: 'ok' });
                    break;
                default:
                    response = Response.json({ error: 'Not found' }, { status: 404 });
            }

            // Attach CORS headers to every response
            for (const [key, value] of Object.entries(corsHeaders)) {
                response.headers.set(key, value);
            }

            return response;
        } catch (err) {
            logger.error({ err }, 'Request error');
            return Response.json(
                { error: 'Internal server error' },
                { status: 500, headers: corsHeaders }
            );
        }
    },
});

logger.info(`API server running on http://localhost:${server.port}`);
