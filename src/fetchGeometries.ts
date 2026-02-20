import { PostalCodeGeometrySource } from './source/PostalCodeGeometrySource.ts';
import { DatabaseClient } from './db/DatabaseClient.ts';
import { createLogger } from './utils/Logger.ts';

/**
 * Standalone script to fetch postal code geometries from Tilastokeskus WFS
 * and store them in the database.
 *
 * Usage: bun run src/fetchGeometries.ts
 * Requires DATABASE_URL environment variable.
 */

const logger = createLogger('FetchGeometries');

async function main() {
    const source = new PostalCodeGeometrySource();
    const db = new DatabaseClient();

    try {
        logger.info('Fetching all postal code geometries from Tilastokeskus...');
        const features = await source.fetchAll();
        logger.info(`Fetched ${features.length} postal code areas`);

        const count = await db.storePostalCodeGeometries(features);
        logger.info(`Done — stored ${count} postal code geometries`);
    } finally {
        await db.close();
    }
}

main().catch((err) => {
    logger.error({ err }, 'Failed to fetch geometries');
    process.exit(1);
});
