/**
 * Represents metadata about a PX-Web dataset
 */
export interface DatasetMetadata {
    title: string;
    variables: Variable[];
    source?: string;
    updated?: string;
    description?: string;
}

/**
 * Represents a variable (dimension) in the dataset
 */
export interface Variable {
    code: string;
    text: string;
    values: string[];
    valueTexts: string[];
    elimination?: boolean;
    time?: boolean;
}

/**
 * Represents a raw dataset extracted from the API
 */
export interface RawDataset {
    format: string;
    data: string;
    metadata: DatasetMetadata;
}

/**
 * Query to send to PX-Web API for data extraction
 */
export interface PxWebQuery {
    query: VariableSelection[];
    response: ResponseFormat;
}

/**
 * Variable selection for the query
 */
export interface VariableSelection {
    code: string;
    selection: Selection;
}

/**
 * Selection criteria for a variable
 */
export interface Selection {
    filter: string;
    values: string[];
}

/**
 * Response format specification
 */
export interface ResponseFormat {
    format: string;
}

// ── Transformer output models ──

/**
 * Building type enum matching the DB schema
 */
export type BuildingType = 'all' | 'apartment_1r' | 'apartment_2r' | 'apartment_3r_plus' | 'terraced';

/**
 * A single transformed price record, ready for DB insertion
 */
export interface PriceRecord {
    postalCode: string;        // '00400'
    buildingType: BuildingType;
    date: Date;                // Year → YYYY-01-01
    pricePerSqm: number | null;
    transactionCount: number | null;
    sourceName: string;        // e.g. 'statfin_ashi_pxt_13mu'
}

/**
 * Result of a transformation run
 */
export interface TransformResult {
    records: PriceRecord[];
    skipped: number;           // Records skipped (e.g. both values null)
    sourceName: string;
}