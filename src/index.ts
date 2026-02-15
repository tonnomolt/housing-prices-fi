// src/index.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { DatasetExtractor } from "./extractor/DatasetExtractor.ts";
import { DatasetTransformer } from "./transformer/DatasetTransformer.ts";
import { STATFIN_BUILDING_TYPE_MAPPINGS } from "./transformer/StatfinBuildingTypes.ts";
import { PxWebDatasetSource } from "./source/PxWebDatasetSource.ts";
import type { DatasetMetadata, RawDataset, TransformResult } from "./model/Models.ts";
import { createLogger } from './utils/Logger.ts';

//central logger init
const logger = createLogger('app');
logger.info('Application starting...');


async function main() {
  const datasetUrl =
    "https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin/statfin_ashi_pxt_13mu.px";

  logger.info("statfin extract starting...");

  const dataSource: PxWebDatasetSource = new PxWebDatasetSource(datasetUrl);
  const extractor: DatasetExtractor = new DatasetExtractor();

  try {
    //step one: get metadata
    const metadata: DatasetMetadata = await dataSource.fetchMetadata();
    //step two: extract actual data
    const rawDataset = await extractor.extract(
      metadata,
      dataSource.getUrl()
    );
    //step three: transform raw data into structured records
    const transformer: DatasetTransformer = new DatasetTransformer(
      rawDataset,
      dataSource.datasetName,
      STATFIN_BUILDING_TYPE_MAPPINGS
    )
    const result = transformer.transform();
    logger.info(`Transformed ${result.records.length} records, ${result.skipped} skipped`);

    // ── Temporary preview output ──
    prettyPrintResults(result);

    //await saveToFile(rawDataset); //TODO remove this test save
  } catch (err) {
    logger.error({ originalError: err }, "Extraction failed");
    if (err instanceof Error) {
      logger.error(err.stack);
    }
    throw err;
  }
}

//this is a temp testing function, will be deleted and shall not be used in the final 
async function saveToFile(dataset: RawDataset) {
  const outputDir = "stat_fin_data_output";
  await mkdir(outputDir, { recursive: true });

  const filename = `dataset_${Date.now()}.${dataset.format}`;
  const filePath = join(outputDir, filename);

  await writeFile(filePath, dataset.data, "utf-8");
  logger.info(`Saved to: ${filePath}`);
}

/**
 * Temporary pretty-print for previewing transformer output.
 * TODO: Remove when DB insert is implemented.
 */
function prettyPrintResults(result: TransformResult) {
  console.log('\n' + '═'.repeat(80));
  console.log(`  SOURCE: ${result.sourceName}`);
  console.log(`  Records: ${result.records.length} | Skipped: ${result.skipped}`);
  console.log('═'.repeat(80));

  if (result.records.length === 0) {
    console.log('  (no records)\n');
    return;
  }

  // Column widths
  const header = `  ${'Postal'.padEnd(7)} ${'Building Type'.padEnd(18)} ${'Date'.padEnd(12)} ${'€/m²'.padStart(8)} ${'Sales'.padStart(7)}`;
  console.log(header);
  console.log('  ' + '─'.repeat(76));

  for (const r of result.records) {
    const price = r.pricePerSqm !== null ? r.pricePerSqm.toFixed(0).padStart(8) : '     N/A';
    const count = r.transactionCount !== null ? String(r.transactionCount).padStart(7) : '    N/A';
    const date = r.date.toISOString().slice(0, 10);
    console.log(`  ${r.postalCode.padEnd(7)} ${r.buildingType.padEnd(18)} ${date.padEnd(12)} ${price} ${count}`);
  }

  console.log('═'.repeat(80) + '\n');
}

await main();
