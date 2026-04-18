-- Vehicles Migration Script
-- Migrates vehicles data from salvage.vehicles to recycleai.vehicles
-- Populates new temporal fields based on available data and reasonable defaults
-- Part of Phase 2 migration (todo: migrate-vehicles)

-- Set timezone for consistent timestamps
SET timezone = 'UTC';

-- Clear existing data to avoid conflicts
DELETE FROM recycleai.vehicles;

-- Migrate vehicles with new temporal fields populated
INSERT INTO recycleai.vehicles (
    id, yard_id, make_id, model_id, year, vin, mileage,
    purchase_date, purchase_price, auction_platform, lot_number,
    damage_type, condition_notes, status,
    acquired_date, dismantled_date, estimated_part_out_value,
    created_at, updated_at, data_source
)
SELECT 
    v.id,
    v.yard_id,
    1 as make_id,                    -- Default for initial migration (can be refined with vehicle_profile mapping)
    1 as model_id,                   -- Default for initial migration
    2020 as year,                    -- Default year (can be extracted from VIN or profile data later)
    v.vin,
    v.mileage,
    v.purchase_date,
    v.purchase_price,
    v.auction_platform,
    NULL as lot_number,              -- Not available in source, can be populated later
    v.damage_type,
    v.condition_notes,
    COALESCE(v.status, 'purchased') as status,
    -- New temporal fields based on research rules:
    COALESCE(v.purchase_date::timestamptz, v.created_at) as acquired_date,
    NULL as dismantled_date,         -- Most vehicles not yet dismantled
    (v.purchase_price * 2.5)::numeric as estimated_part_out_value, -- Reasonable part-out multiplier
    COALESCE(v.created_at, NOW()) as created_at,
    COALESCE(v.updated_at, NOW()) as updated_at,
    'migrated' as data_source
FROM salvage.vehicles v;

-- Verify the migration
SELECT '=== VEHICLES MIGRATION COMPLETE ===' as status;
SELECT 
    COUNT(*) as vehicles_migrated,
    COUNT(CASE WHEN acquired_date IS NOT NULL THEN 1 END) as with_acquired_date,
    COUNT(CASE WHEN estimated_part_out_value IS NOT NULL THEN 1 END) as with_part_out_value,
    MIN(estimated_part_out_value) as min_part_out_value,
    MAX(estimated_part_out_value) as max_part_out_value
FROM recycleai.vehicles;

SELECT 'Sample vehicles:' as info;
SELECT id, make_id, model_id, year, status, acquired_date, estimated_part_out_value 
FROM recycleai.vehicles 
LIMIT 5;