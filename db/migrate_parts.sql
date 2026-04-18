-- Parts Migration Script (Most Complex)
-- Migrates/renames data from salvage.inventories to recycleai.parts
-- Also generates realistic yard_locations from parsing location_notes
-- Part of Phase 2 migration (todo: migrate-parts)

-- Set timezone for consistent timestamps
SET timezone = 'UTC';

-- 1. First, generate yard_locations from parsing location_notes
-- Clear existing data
TRUNCATE recycleai.yard_locations RESTART IDENTITY;

-- Extract unique locations and create yard_location entries
INSERT INTO recycleai.yard_locations (
    yard_id, row_code, bay, shelf, bin, description, capacity, created_at
)
WITH parsed_locations AS (
    SELECT DISTINCT 
        yard_id,
        CASE 
            WHEN location_notes ~ 'Row ([A-Z])' THEN substring(location_notes from 'Row ([A-Z])')
            ELSE 'A' 
        END as row_code,
        CASE 
            WHEN location_notes ~ 'Shelf (\d+)' THEN (substring(location_notes from 'Shelf (\d+)'))::int
            ELSE 1 
        END as shelf,
        NULL as bin,
        location_notes as description
    FROM salvage.inventories 
    WHERE location_notes IS NOT NULL
)
SELECT 
    yard_id,
    row_code,
    NULL as bay,           -- Not specified in source data
    shelf,
    NULL as bin,           -- Not specified in source data
    description,
    10 as capacity,        -- Default capacity
    NOW() as created_at
FROM parsed_locations
ON CONFLICT (yard_id, row_code, shelf) DO NOTHING;

-- 2. Now migrate inventories to parts
TRUNCATE recycleai.parts RESTART IDENTITY;

INSERT INTO recycleai.parts (
    id, vehicle_id, part_type_id, condition_grade_id, quantity,
    location_id, listed_price, status, acquired_date, listed_date,
    notes, created_at, updated_at, data_source
)
SELECT 
    i.id,
    i.vehicle_id,
    i.part_type_id,
    i.condition_grade_id,
    COALESCE(i.quantity, 1) as quantity,
    -- Link to yard_location (simplified - in production would do more sophisticated matching)
    (SELECT id FROM recycleai.yard_locations 
     WHERE row_code = (CASE WHEN i.location_notes ~ 'Row ([A-Z])' THEN substring(i.location_notes from 'Row ([A-Z])') ELSE 'A' END)
     AND (shelf = (CASE WHEN i.location_notes ~ 'Shelf (\d+)' THEN (substring(i.location_notes from 'Shelf (\d+)'))::int ELSE 1 END) OR shelf IS NULL)
     LIMIT 1) as location_id,
    i.listed_price,
    'in_inventory' as status,                    -- Default for migrated inventory
    COALESCE(i.purchase_date::timestamptz, i.created_at) as acquired_date,
    NULL as listed_date,                         -- Not yet listed
    COALESCE(i.notes, i.condition_notes, i.location_notes) as notes,
    COALESCE(i.created_at, NOW()) as created_at,
    COALESCE(i.updated_at, NOW()) as updated_at,
    'migrated' as data_source
FROM salvage.inventories i;

-- 3. Verification
SELECT '=== PARTS MIGRATION COMPLETE ===' as status;

SELECT 
    'parts' as table_name, 
    COUNT(*) as record_count,
    COUNT(CASE WHEN location_id IS NOT NULL THEN 1 END) as with_location,
    COUNT(CASE WHEN acquired_date IS NOT NULL THEN 1 END) as with_acquired_date
FROM recycleai.parts
UNION ALL
SELECT 
    'yard_locations', 
    COUNT(*),
    COUNT(*),
    COUNT(*)
FROM recycleai.yard_locations;

SELECT 'Sample parts with locations:' as sample;
SELECT 
    p.id, 
    p.status, 
    p.acquired_date,
    l.row_code,
    l.shelf,
    l.description as location_description
FROM recycleai.parts p
LEFT JOIN recycleai.yard_locations l ON p.location_id = l.id
LIMIT 5;