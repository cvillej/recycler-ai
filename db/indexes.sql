-- Core Indexes for RecycleAI User Stories
-- High-priority indexes supporting auction intelligence, inventory visibility,
-- aging reports, pricing analysis, and dashboard queries
-- Generated from db/optimization_plan.sql analysis

-- =====================================================
-- 1. VEHICLES TABLE INDEXES (Auction Intelligence, Vehicle Lookup)
-- =====================================================

-- Primary auction valuation index (most critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_auction_valuation 
ON recycleai.vehicles (make_id, model_id, year, status, acquired_date);

-- Vehicle status filtering (common dashboard filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_status 
ON recycleai.vehicles (status) WHERE status IN ('purchased', 'on_yard', 'dismantled');

-- Make/model lookup for profitability analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_make_model 
ON recycleai.vehicles (make_id, model_id);

-- Temporal filtering for aging reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_acquired_date 
ON recycleai.vehicles (acquired_date);

-- =====================================================
-- 2. PARTS TABLE INDEXES (Inventory Visibility, Aging Reports)
-- =====================================================

-- Vehicle-part lookup (Priority 2: "What parts from this vehicle?")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_vehicle_part 
ON recycleai.parts (vehicle_id, part_type_id, status);

-- Location lookup (Priority 2: "Where is this part?")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_location 
ON recycleai.parts (location_id);

-- Part type filtering (Priority 4: "Most valuable parts by type")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_part_type_status 
ON recycleai.parts (part_type_id, status);

-- Aging analysis (Priority 3: Slow-mover reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_acquired_date_status 
ON recycleai.parts (acquired_date, status) WHERE status = 'in_inventory';

-- High-value inventory filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_high_value 
ON recycleai.parts (listed_price DESC) WHERE status = 'in_inventory';

-- =====================================================
-- 3. GROK_SOLD_LISTINGS INDEXES (Market Intelligence, Pricing)
-- =====================================================

-- Market comps lookup (Priority 4: "How does our pricing compare?")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grok_sold_make_model_part 
ON recycleai.grok_sold_listings (make_id, model_id, part_type_id, date_sold);

-- Data source filtering (real vs synthesized)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grok_sold_data_source 
ON recycleai.grok_sold_listings (data_source);

-- Recent sales for dynamic pricing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grok_sold_recent 
ON recycleai.grok_sold_listings (date_sold DESC, part_type_id) 
WHERE data_source = 'paid_ebay';

-- =====================================================
-- 4. YARD_LOCATIONS INDEXES (Location Intelligence)
-- =====================================================

-- Location hierarchy lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yard_locations_hierarchy 
ON recycleai.yard_locations (yard_id, row_code, shelf);

-- =====================================================
-- 5. SALES TABLE INDEXES (Aging & Velocity Analysis)
-- =====================================================

-- Aging reports (Priority 3)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_sold_date_platform 
ON recycleai.sales (sold_date, platform, condition_grade_id);

-- Velocity analysis by vehicle
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_vehicle 
ON recycleai.sales (vehicle_id, sold_date);

-- =====================================================
-- 6. PARTIAL INDEXES (Status-Specific Queries)
-- =====================================================

-- Most common inventory query pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_inventory_only 
ON recycleai.parts (vehicle_id, part_type_id, listed_price DESC) 
WHERE status = 'in_inventory';

-- Active vehicles only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_active 
ON recycleai.vehicles (make_id, model_id, estimated_part_out_value DESC) 
WHERE status IN ('purchased', 'on_yard');

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '=== INDEX CREATION COMPLETE ===' as status;
SELECT 'All indexes created successfully for RecycleAI user stories.' as message;

-- Show newly created indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'recycleai' 
  AND indexname LIKE '%idx%'
ORDER BY tablename, indexname;

SELECT 'Index creation complete. Ready for materialized views and functions.' as next_steps;