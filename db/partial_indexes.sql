-- Partial Indexes for Common Status Filters
-- Optimizes the most frequent query patterns identified in user stories
-- Partial indexes are smaller and faster than full indexes for common conditions

-- =====================================================
-- PARTIAL INDEXES FOR INVENTORY QUERIES (Priority 2)
-- =====================================================

-- Most common query: "Show me available inventory" (in_inventory status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_inventory_vehicle 
ON recycleai.parts (vehicle_id, part_type_id, listed_price DESC) 
WHERE status = 'in_inventory';

-- "Show me listed parts" (for sales dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_listed 
ON recycleai.parts (part_type_id, listed_price DESC) 
WHERE status = 'listed';

-- "Show me recently acquired parts" (intake monitoring)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parts_recent_acquired 
ON recycleai.parts (acquired_date DESC, part_type_id) 
WHERE acquired_date > CURRENT_DATE - INTERVAL '90 days' 
  AND status = 'in_inventory';

-- =====================================================
-- PARTIAL INDEXES FOR VEHICLE QUERIES (Priority 1)
-- =====================================================

-- Active vehicles for auction analysis (purchased/on_yard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_active_valuation 
ON recycleai.vehicles (make_id, model_id, estimated_part_out_value DESC) 
WHERE status IN ('purchased', 'on_yard');

-- Dismantled vehicles for part lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vehicles_dismantled 
ON recycleai.vehicles (make_id, model_id, dismantled_date) 
WHERE status = 'dismantled';

-- =====================================================
-- PARTIAL INDEXES FOR SALES VELOCITY (Priority 3)
-- =====================================================

-- Recent sales for velocity analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_recent 
ON recycleai.sales (sold_date DESC, vehicle_id, part_type_id) 
WHERE sold_date > CURRENT_DATE - INTERVAL '180 days';

-- High-margin sales analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_high_margin 
ON recycleai.sales (margin_pct DESC, sold_date) 
WHERE margin_pct > 20;

-- =====================================================
-- PARTIAL INDEXES FOR MARKET COMPS (Priority 4)
-- =====================================================

-- Real paid_ebay data only (most reliable comps)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grok_sold_paid_ebay 
ON recycleai.grok_sold_listings (part_type_id, date_sold DESC, sold_price) 
WHERE data_source = 'paid_ebay';

-- Recent comps for dynamic pricing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grok_sold_recent_comps 
ON recycleai.grok_sold_listings (part_type_id, date_sold DESC) 
WHERE date_sold > CURRENT_DATE - INTERVAL '90 days';

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '=== PARTIAL INDEXES CREATION COMPLETE ===' as status;
SELECT 'All status-specific indexes created for optimal query performance.' as message;

-- Show newly created partial indexes
SELECT 
    schemanameschemaname,
    tablename,
    indexname,
    indexdef,
    CASE 
        WHEN indexdef LIKE '%WHERE%' THEN 'PARTIAL'
        ELSE 'FULL'
    END as index_type
FROM pg_indexes 
WHERE schemaname = 'recycleai' 
  AND indexname LIKE '%partial%' OR indexname LIKE '%recent%' OR indexname LIKE '%active%'
ORDER BY tablename, indexname;

SELECT 'Partial indexes complete. Ready for performance validation.' as next_steps;