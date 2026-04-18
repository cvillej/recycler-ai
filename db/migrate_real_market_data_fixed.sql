-- Fixed Real Market Data Migration
-- Migrates 99 real paid records from salvage.ebay_sold_listings to recycleai.grok_sold_listings
-- Simplified to avoid complex FK resolution issues in initial migration

-- Set timezone for consistent timestamps
SET timezone = 'UTC';

-- Clear any existing paid_ebay data to avoid duplicates
DELETE FROM recycleai.grok_sold_listings WHERE data_source = 'paid_ebay';

-- Migrate 99 representative real records
-- Using a simplified approach that focuses on the core fields
-- make_id, model_id, part_type_id will use reasonable defaults or be updated in later steps
INSERT INTO recycleai.grok_sold_listings (
    make_id, model_id, part_type_id, 
    year_range, ebay_item_id, title, sold_price, date_sold,
    condition_raw, condition_grade_id, image_url, listing_url,
    raw_json, collected_at, data_source, confidence_score, created_at
)
SELECT 
    1 as make_id,           -- Default for initial migration, can be refined later
    1 as model_id,          -- Default for initial migration, can be refined later  
    COALESCE(part_type_id, 1) as part_type_id,
    NULL as year_range,
    ebay_item_id,
    title,
    sale_price as sold_price,
    date_sold,
    condition_raw,
    condition_grade_id,
    image_url,
    listing_url,
    raw_json,
    NOW() as collected_at,
    'paid_ebay' as data_source,
    1.0 as confidence_score,        -- Real data gets maximum confidence
    NOW() as created_at
FROM salvage.ebay_sold_listings
WHERE sale_price IS NOT NULL 
  AND date_sold IS NOT NULL
  AND title IS NOT NULL
  AND ebay_item_id IS NOT NULL
LIMIT 99;

-- Verify the migration
SELECT '=== REAL MARKET DATA MIGRATION COMPLETE ===' as status;
SELECT 
    data_source,
    COUNT(*) as record_count,
    MIN(sold_price) as min_price,
    MAX(sold_price) as max_price,
    MIN(date_sold) as earliest_sale,
    MAX(date_sold) as latest_sale
FROM recycleai.grok_sold_listings 
WHERE data_source = 'paid_ebay'
GROUP BY data_source;

SELECT 'Total records in grok_sold_listings:' as info, COUNT(*) as total 
FROM recycleai.grok_sold_listings;