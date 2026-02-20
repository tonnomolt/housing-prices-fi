-- Add geometry column to postal_code table.
-- Stores GeoJSON geometry as JSONB (WGS84 / EPSG:4326).

ALTER TABLE postal_code
    ADD COLUMN IF NOT EXISTS geometry JSONB;

-- Index for checking which postal codes have geometry
CREATE INDEX IF NOT EXISTS idx_postal_code_has_geometry
    ON postal_code ((geometry IS NOT NULL));
