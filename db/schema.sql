-- recycleai Schema DDL
-- Generated from Phase 0 design in docs/db-todo.md
-- Single source of truth for creating the schema
-- Run with: psql -h localhost -p 5432 -U car -d ai -f db/schema.sql

-- Create schema
CREATE SCHEMA IF NOT EXISTS recycleai;

-- Taxonomy Tables (no dependencies)
CREATE TABLE recycleai.makes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recycleai.models (
    id SERIAL PRIMARY KEY,
    make_id INT NOT NULL REFERENCES recycleai.makes(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recycleai.part_types (
    id SERIAL PRIMARY KEY,
    part_key TEXT NOT NULL UNIQUE,
    part_name TEXT NOT NULL,
    part_category TEXT NOT NULL,
    ebay_category_id TEXT,
    search_keywords TEXT,
    excluded_keywords TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recycleai.condition_grades (
    id SERIAL PRIMARY KEY,
    grade_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    sort_order INT NOT NULL,
    price_adjustment_pct NUMERIC,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supporting taxonomy (from salvage)
CREATE TABLE recycleai.ebay_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES recycleai.ebay_categories(id)
);

CREATE TABLE recycleai.ebay_condition_mappings (
    id SERIAL PRIMARY KEY,
    ebay_condition_id INT,
    ebay_condition_text TEXT,
    condition_grade_id INT REFERENCES recycleai.condition_grades(id),
    match_priority INT DEFAULT 1
);

-- Alias tables
CREATE TABLE recycleai.make_aliases (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    make_id INT REFERENCES recycleai.makes(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recycleai.model_aliases (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    model_id INT REFERENCES recycleai.models(id),
    make_id INT REFERENCES recycleai.makes(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recycleai.part_aliases (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    part_type_id INT REFERENCES recycleai.part_types(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yard locations
CREATE TABLE recycleai.yard_locations (
    id SERIAL PRIMARY KEY,
    yard_id INT NOT NULL,
    row_code TEXT NOT NULL,
    bay INT,
    shelf INT,
    bin TEXT,
    description TEXT,
    capacity INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core instance tables
CREATE TABLE recycleai.vehicles (
    id SERIAL PRIMARY KEY,
    yard_id INT NOT NULL,
    make_id INT NOT NULL REFERENCES recycleai.makes(id),
    model_id INT NOT NULL REFERENCES recycleai.models(id),
    year INT NOT NULL,
    vin VARCHAR(17) UNIQUE,
    mileage INT,
    purchase_date DATE,
    purchase_price NUMERIC,
    auction_platform TEXT,
    lot_number TEXT,
    damage_type TEXT,
    condition_notes TEXT,
    status TEXT NOT NULL,
    acquired_date TIMESTAMPTZ,
    dismantled_date TIMESTAMPTZ,
    estimated_part_out_value NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_source TEXT DEFAULT 'migrated'
);

CREATE TABLE recycleai.parts (
    id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES recycleai.vehicles(id),
    part_type_id INT NOT NULL REFERENCES recycleai.part_types(id),
    condition_grade_id INT REFERENCES recycleai.condition_grades(id),
    quantity INT DEFAULT 1 NOT NULL,
    location_id INT REFERENCES recycleai.yard_locations(id),
    listed_price NUMERIC,
    status TEXT NOT NULL,
    acquired_date TIMESTAMPTZ,
    listed_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_source TEXT DEFAULT 'migrated'
);

-- Market data (unified)
CREATE TABLE recycleai.grok_sold_listings (
    id SERIAL PRIMARY KEY,
    make_id INT REFERENCES recycleai.makes(id),
    model_id INT REFERENCES recycleai.models(id),
    part_type_id INT REFERENCES recycleai.part_types(id),
    year_range TEXT,
    ebay_item_id TEXT,
    title TEXT NOT NULL,
    sold_price NUMERIC NOT NULL,
    date_sold DATE NOT NULL,
    condition_raw TEXT,
    condition_grade_id INT REFERENCES recycleai.condition_grades(id),
    image_url TEXT,
    listing_url TEXT,
    raw_json JSONB,
    collected_at TIMESTAMPTZ,
    data_source TEXT NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales
CREATE TABLE recycleai.sales (
    id SERIAL PRIMARY KEY,
    part_id INT REFERENCES recycleai.parts(id),
    vehicle_id INT REFERENCES recycleai.vehicles(id),
    part_type_id INT REFERENCES recycleai.part_types(id),
    sold_price NUMERIC NOT NULL,
    sold_date DATE NOT NULL,
    platform TEXT NOT NULL,
    ebay_item_id TEXT,
    condition_grade_id INT REFERENCES recycleai.condition_grades(id),
    margin_pct NUMERIC,
    days_to_sell INT,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data_source TEXT DEFAULT 'migrated'
);

-- Auctions
CREATE TABLE recycleai.salvage_auctions (
    id SERIAL PRIMARY KEY,
    make_id INT REFERENCES recycleai.makes(id),
    model_id INT REFERENCES recycleai.models(id),
    year INT,
    vin VARCHAR(17),
    lot_number TEXT,
    auction_platform TEXT NOT NULL,
    auction_date DATE NOT NULL,
    asking_price NUMERIC,
    mileage INT,
    damage_type TEXT,
    condition_notes TEXT,
    image_url TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users and access
CREATE TABLE recycleai.users (
    id SERIAL PRIMARY KEY,
    cognito_sub TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recycleai.user_yard_access (
    user_id INT REFERENCES recycleai.users(id),
    yard_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, yard_id)
);

-- Indexes for user stories
CREATE INDEX idx_vehicles_make_model_year_status ON recycleai.vehicles(make_id, model_id, year, status);
CREATE INDEX idx_parts_vehicle_part_location_status_acquired ON recycleai.parts(vehicle_id, part_type_id, location_id, status, acquired_date);
CREATE INDEX idx_grok_sold_make_model_part_date_source ON recycleai.grok_sold_listings(make_id, model_id, part_type_id, date_sold, data_source);
CREATE INDEX idx_parts_location ON recycleai.parts(location_id);

-- Views for user stories (examples)
CREATE VIEW recycleai.vehicle_inventory_summary AS
SELECT 
    v.id,
    m.name as make,
    mo.name as model,
    v.year,
    v.status,
    COUNT(p.id) as part_count,
    SUM(p.listed_price * p.quantity) as total_listed_value
FROM recycleai.vehicles v
LEFT JOIN recycleai.parts p ON v.id = p.vehicle_id
JOIN recycleai.makes m ON v.make_id = m.id
JOIN recycleai.models mo ON v.model_id = mo.id
GROUP BY v.id, m.name, mo.name, v.year, v.status;

-- Additional views/functions can be added based on user stories
-- End of schema.sql
