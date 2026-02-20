import postgres from 'postgres';
import { createLogger } from '../utils/Logger.ts';
import type {
    PriceRecord,
    TransformResult,
    BuildingTypeMapping,
} from '../model/Models.ts';
import type { PostalCodeFeature } from '../source/PostalCodeGeometrySource.ts';
import type { Logger } from 'pino';

/**
 * Handles all database operations for the housing prices pipeline.
 * Uses the 'postgres' (porsager/postgres) driver for Bun/Node compatibility.
 */
export class DatabaseClient {
    private sql: postgres.Sql;
    private logger: Logger;

    constructor(connectionUrl?: string) {
        this.logger = createLogger('DatabaseClient');
        const url = connectionUrl ?? process.env.DATABASE_URL;
        if (!url) {
            throw new Error(
                'DATABASE_URL not set. Provide it as env var or constructor arg.'
            );
        }
        this.sql = postgres(url);
    }

    /**
     * Ensures the data source exists, returns its id.
     * Creates if missing, updates last_fetched if exists.
     */
    async ensureDataSource(
        name: string,
        description?: string,
        url?: string
    ): Promise<number> {
        this.logger.info(`Ensuring data source: ${name}`);

        const rows = await this.sql`
            INSERT INTO data_source (name, description, url, last_fetched)
            VALUES (${name}, ${description ?? null}, ${url ?? null}, NOW())
            ON CONFLICT (name) DO UPDATE SET last_fetched = NOW()
            RETURNING id
        `;

        const id = rows[0].id;
        this.logger.info(`Data source '${name}' → id ${id}`);
        return id;
    }

    /**
     * Stores building type mappings for a source.
     * Upserts: if a mapping for (source_id, source_code) exists, updates it.
     */
    async storeBuildingTypeMappings(
        sourceId: number,
        mappings: BuildingTypeMapping[]
    ): Promise<void> {
        if (mappings.length === 0) return;

        this.logger.info(
            `Storing ${mappings.length} building type mappings for source ${sourceId}`
        );

        for (const m of mappings) {
            await this.sql`
                INSERT INTO building_type_mapping (source_id, source_code, source_label, building_type)
                VALUES (${sourceId}, ${m.sourceCode}, ${m.sourceLabel}, ${m.canonicalCode})
                ON CONFLICT (source_id, source_code) DO UPDATE SET
                    source_label = EXCLUDED.source_label,
                    building_type = EXCLUDED.building_type
            `;
        }
    }

    /**
     * Ensures postal codes exist in the postal_code table.
     * Inserts missing ones with name/municipality as null (to be enriched later).
     */
    async ensurePostalCodes(codes: string[]): Promise<void> {
        if (codes.length === 0) return;

        const uniqueCodes = [...new Set(codes)];
        this.logger.info(`Ensuring ${uniqueCodes.length} postal codes exist`);

        // Batch insert, skip conflicts
        for (const code of uniqueCodes) {
            await this.sql`
                INSERT INTO postal_code (code)
                VALUES (${code})
                ON CONFLICT (code) DO NOTHING
            `;
        }
    }

    /**
     * Inserts price records into the database.
     * Uses upsert: if a record for the same (postal_code, building_type, date, source_id)
     * already exists, it updates the price and transaction count.
     *
     * @returns Number of records inserted/updated
     */
    async insertPriceRecords(
        records: PriceRecord[],
        sourceId: number
    ): Promise<number> {
        if (records.length === 0) return 0;

        this.logger.info(`Inserting ${records.length} price records...`);

        let count = 0;
        // Batch in chunks to avoid huge queries
        const BATCH_SIZE = 500;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);

            for (const r of batch) {
                await this.sql`
                    INSERT INTO price_data (postal_code, building_type, date, price_per_sqm, transaction_count, source_id)
                    VALUES (
                        ${r.postalCode},
                        ${r.buildingType},
                        ${r.date.toISOString().slice(0, 10)},
                        ${r.pricePerSqm},
                        ${r.transactionCount},
                        ${sourceId}
                    )
                    ON CONFLICT (postal_code, building_type, date, source_id) DO UPDATE SET
                        price_per_sqm = EXCLUDED.price_per_sqm,
                        transaction_count = EXCLUDED.transaction_count
                `;
                count++;
            }

            this.logger.info(
                `Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count}/${records.length}`
            );
        }

        this.logger.info(`Insert complete: ${count} records`);
        return count;
    }

    /**
     * Full pipeline: store a TransformResult into the database.
     * Handles source registration, postal codes, mappings, and price data.
     */
    async storeTransformResult(
        result: TransformResult,
        sourceDescription?: string,
        sourceUrl?: string
    ): Promise<{ sourceId: number; recordsStored: number }> {
        const sourceId = await this.ensureDataSource(
            result.sourceName,
            sourceDescription,
            sourceUrl
        );

        // Ensure postal codes exist
        const postalCodes = result.records.map((r) => r.postalCode);
        await this.ensurePostalCodes(postalCodes);

        // Store building type mappings
        await this.storeBuildingTypeMappings(sourceId, result.buildingTypeMappings);

        // Insert price records
        const recordsStored = await this.insertPriceRecords(
            result.records,
            sourceId
        );

        this.logger.info(
            `Pipeline complete for '${result.sourceName}': ${recordsStored} records stored`
        );

        return { sourceId, recordsStored };
    }

    /**
     * Upsert postal code geometry and metadata from Tilastokeskus WFS data.
     * Updates name, municipality and geometry for each postal code.
     *
     * @returns Number of records upserted
     */
    async storePostalCodeGeometries(
        features: PostalCodeFeature[]
    ): Promise<number> {
        if (features.length === 0) return 0;

        this.logger.info(
            `Storing geometries for ${features.length} postal codes...`
        );

        let count = 0;
        const BATCH_SIZE = 200;

        for (let i = 0; i < features.length; i += BATCH_SIZE) {
            const batch = features.slice(i, i + BATCH_SIZE);

            for (const f of batch) {
                const geometryJson = f.geometry
                    ? this.sql.json(f.geometry)
                    : null;

                await this.sql`
                    INSERT INTO postal_code (code, name, municipality, geometry)
                    VALUES (
                        ${f.postalCode},
                        ${f.name},
                        ${f.municipality},
                        ${geometryJson}
                    )
                    ON CONFLICT (code) DO UPDATE SET
                        name = EXCLUDED.name,
                        municipality = EXCLUDED.municipality,
                        geometry = EXCLUDED.geometry
                `;
                count++;
            }

            this.logger.info(
                `Stored batch ${Math.floor(i / BATCH_SIZE) + 1}: ${count}/${features.length}`
            );
        }

        this.logger.info(`Geometry store complete: ${count} postal codes`);
        return count;
    }

    /**
     * Close the database connection pool.
     */
    async close(): Promise<void> {
        await this.sql.end();
        this.logger.info('Database connection closed');
    }
}
