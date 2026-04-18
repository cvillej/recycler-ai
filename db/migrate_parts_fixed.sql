-- Fixed Parts Migration Script
-- Handles foreign key constraints and correct column mappings
-- Generates yard_locations from location_notes parsing

-- Set timezone for consistent timestamps
SET timezone = 'UTC';

-- 1. Generate yard_locations first (before truncating parts)
TRUNCATE recycleai.yard_locations RESTART IDENTITY;

WITH parsed_locations AS (
    SELECT DISTINCT 
        COALESCE(yard_id, 1) as yard_id,
        CASE 
            WHEN location_notes ~ 'Row ([A-Z])' THEN substring(location_notes from 'Row ([A-Z])')
            ELSE 'A' 
        END as row_code,
        CASE 
            WHEN location_notes ~ 'Shelf (\d+)' THEN (substring(location_notes from 'Shelf (\d+)'))::int
            ELSE NULL 
        END as shelf,
        location_notes as description
    FROM salvage.inventories 
    WHERE location_notes IS NOT NULL
)
INSERT INTO recycleai.yard_locations (
    yard_id, row_code, bay, shelf, bin, description, capacity, created_at
)
SELECT 
    yard_id,
    row_code,
    NULL as bay,
    shelf,
    NULL as bin,
    description,
    10 as capacity,
    NOW() as created_at
FROM parsed_locations;

-- 2. Now migrate inventories to parts (using CASCADE for FK constraints)
TRUNCATE recycleai.parts CASCADE;

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
    -- Find matching yard location
    (SELECT id FROM recycleai.yard_locations 
     WHERE row_code = (CASE WHEN i.location_notes ~ 'Row ([A-Z])' THEN substring(i.location_notes from 'Row ([A-Z])') ELSE 'A' END)
       AND (shelf = (CASE WHEN i.location_notes ~ 'Shelf (\d+)' THEN (substring(i.location_notes from 'Shelf (\d+)'))::int ELSE NULL END) 
            OR shelf IS NULL)
     LIMIT 1) as location_id,
    i.listed_price,
    'in_inventory' as status,
    COALESCE(i.purchase_date::timestamptz, i.created_at) as acquired_date,
    NULL as listed_date,
    i.notes as notes,
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

SELECT 'Sample data:' as sample;
SELECT 
    p.id, 
    p.status, 
    p.acquired_date,
    l.row_code as row,
    l.shelf,
    l.description as location
FROM recycleai.parts p
LEFT JOIN recycleai.yard_locations l ON p.location_id = l.id
WHERE l.row_code IS NOT NULL
LIMIT 5;