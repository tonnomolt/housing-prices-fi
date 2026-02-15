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
 * Canonical building type codes used in the DB.
 * These are our internal identifiers — each data source maps its own
 * codes/labels to these via BuildingTypeMapping.
 */
export type BuildingTypeCode =
    | 'all'
    | 'apartment_1r'
    | 'apartment_2r'
    | 'apartment_3r_plus'
    | 'terraced';

/**
 * A building type with its description, stored as reference data.
 * Allows UI to show human-readable labels and supports mapping
 * from different source labels to the same canonical type.
 */
export interface BuildingTypeInfo {
    code: BuildingTypeCode;
    description: string;       // Canonical English description
    descriptionFi?: string;    // Finnish description (optional)
}

/**
 * Maps a source-specific building type code/label to our canonical type.
 * Each data source provides its own mapping configuration.
 */
export interface BuildingTypeMapping {
    sourceCode: string;        // Code in the source data (e.g. '1', '5')
    sourceLabel: string;       // Label from the source (e.g. 'Blocks of flats, one-room flat')
    canonicalCode: BuildingTypeCode;
}

/**
 * A single transformed price record, ready for DB insertion
 */
export interface PriceRecord {
    postalCode: string;        // '00400'
    buildingType: BuildingTypeCode;
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
    /** Building type mappings used in this transformation (for auditing/storage) */
    buildingTypeMappings: BuildingTypeMapping[];
}