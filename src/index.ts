// src/index.ts

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { DatasetExtractor } from "./extractor/DatasetExtractor.ts";
import { DatasetTransformer } from "./transformer/DatasetTransformer.ts";
import { PxWebDatasetSource } from "./source/PxWebDatasetSource.ts";
import type { DatasetMetadata, RawDataset } from "./model/Models.ts";
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
      dataSource.datasetName
    )
    const result = transformer.transform();
    logger.info(`Transformed ${result.records.length} records, ${result.skipped} skipped`);
    for (const record of result.records) {
      logger.info({
        postalCode: record.postalCode,
        buildingType: record.buildingType,
        date: record.date.toISOString().slice(0, 10),
        pricePerSqm: record.pricePerSqm,
        transactionCount: record.transactionCount,
      }, 'Record');
    }

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

await main();
