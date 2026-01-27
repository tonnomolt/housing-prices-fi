import { createLogger } from '../utils/Logger.ts';

import type {
    RawDataset,
} from '../model/Models.ts';
import type { Logger } from 'pino';

/**
 * Transforms RawDataset to a format insertable to a DB (postgres)
 */
export class DatasetTransformer {
    private logger: Logger;
    private targetTableName: string;
    private rawDataset: RawDataset;

    constructor(
        rawDataset: RawDataset,
        datasetName: string
    ) {
        this.logger = createLogger('DatasetTransformer');
        this.rawDataset = rawDataset;
        this.targetTableName = datasetName;
    }

    testPrint(){
        console.log("test prints begin")
        console.log(this.targetTableName)
        console.log(this.rawDataset.format)
        console.log(this.rawDataset.metadata)
        console.log(this.rawDataset.data)
        console.log("test prints end")
    }
}