-- Housing Prices FI — Database Schema
-- Designed for multi-source price data by postal code, building type, and time.

-- ── Reference tables ──

-- Canonical building types (source-agnostic)
CREATE TABLE building_type (
    code        VARCHAR(20) PRIMARY KEY,     -- 'apartment_1r', 'terraced', etc.
    description TEXT NOT NULL,               -- English description
    description_fi TEXT                      -- Finnish description
);

-- Seed canonical building types
INSERT INTO building_type (code, description, description_fi) VALUES
    ('all',               'All building types',                    'Kaikki talotyypit'),
    ('apartment_1r',      'Block of flats, one-room flat',         'Kerrostalo, yksiö'),
    ('apartment_2r',      'Block of flats, two-room flat',         'Kerrostalo, kaksio'),
    ('apartment_3r_plus', 'Block of flats, three rooms or more',   'Kerrostalo, kolmio+'),
    ('terraced',          'Terraced houses',                       'Rivitalo');

-- Postal codes (master data, populated separately)
CREATE TABLE postal_code (
    code         VARCHAR(5) PRIMARY KEY,     -- '00100'
    name         TEXT,                        -- 'Helsinki keskusta'
    municipality TEXT                         -- 'Helsinki'
);

-- Data sources
CREATE TABLE data_source (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,        -- 'statfin_ashi_pxt_13mu'
    description  TEXT,
    url          TEXT,
    last_fetched TIMESTAMPTZ
);

-- ── Mapping table ──
-- How each source's building type codes/labels map to our canonical types.
-- Enables auditing and future source onboarding.

CREATE TABLE building_type_mapping (
    id              SERIAL PRIMARY KEY,
    source_id       INTEGER NOT NULL REFERENCES data_source(id),
    source_code     TEXT NOT NULL,            -- Code in source data ('1', '5', 'kt', ...)
    source_label    TEXT,                     -- Label from source ('Blocks of flats, one-room flat')
    building_type   VARCHAR(20) NOT NULL REFERENCES building_type(code),

    UNIQUE(source_id, source_code)
);

-- ── Core data ──

CREATE TABLE price_data (
    id                SERIAL PRIMARY KEY,
    postal_code       VARCHAR(5) NOT NULL REFERENCES postal_code(code),
    building_type     VARCHAR(20) NOT NULL REFERENCES building_type(code),
    date              DATE NOT NULL,          -- Yearly → YYYY-01-01, monthly → YYYY-MM-01, daily → exact
    price_per_sqm     NUMERIC(10,2),          -- €/m² (null if confidential/missing)
    transaction_count INTEGER,                -- Number of sales (null if not available)
    source_id         INTEGER NOT NULL REFERENCES data_source(id),

    UNIQUE(postal_code, building_type, date, source_id)
);

-- ── Indexes ──

CREATE INDEX idx_price_postal        ON price_data(postal_code);
CREATE INDEX idx_price_date          ON price_data(date);
CREATE INDEX idx_price_building_type ON price_data(building_type);
CREATE INDEX idx_price_source        ON price_data(source_id);
-- Composite for typical queries: "all prices for postal code X"
CREATE INDEX idx_price_postal_date   ON price_data(postal_code, date);
