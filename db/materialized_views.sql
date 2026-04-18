-- Materialized Views for RecycleAI Dashboard and Reports
-- Critical for Priority 3 (Aging Reports) and Priority 4 (Pricing Intelligence)
-- Generated from db/optimization_plan.sql analysis

-- =====================================================
-- 1. AGING INVENTORY SUMMARY (Priority 3: Slow-Mover Intelligence)
-- =====================================================
-- Refreshed daily - provides aging buckets and value totals for dashboard
DROP MATERIALIZED VIEW IF EXISTS recycleai.aging_inventory_summary CASCADE;

CREATE MATERIALIZED VIEW recycleai.aging_inventory_summary AS
SELECT 
    CASE 
        WHEN AGE(CURRENT_DATE, p.acquired_date::date) < INTERVAL '30 days' THEN '< 30 days'
        WHEN AGE(CURRENT_DATE, p.acquired_date::date) < INTERVAL '90 days' THEN '30-90 days'
        WHEN AGE(CURRENT_DATE, p.acquired_date::date) < INTERVAL '180 days' THEN '90-180 days'
        ELSE '> 180 days'
    END as age_bucket,
    COUNT(*) as part_count,
    ROUND(SUM(p.listed_price), 2) as total_value,
    ROUND(AVG(p.listed_price), 2) as avg_value,
    COUNT(CASE WHEN p.status = 'in_inventory' THEN 1 END) as in_inventory_count,
    COUNT(CASE WHEN p.status = 'listed' THEN 1 END) as listed_count
FROM recycleai.parts p
WHERE p.status IN ('in_inventory', 'listed')
GROUP BY age_bucket
ORDER BY 
    CASE age_bucket 
        WHEN '< 30 days' THEN 1
        WHEN '30-90 days' THEN 2  
        WHEN '90-180 days' THEN 3
        ELSE 4
    END;

-- Concurrent refresh policy (safe for production)
CREATE UNIQUE INDEX CONCURRENTLY aging_inventory_summary_refresh_idx 
ON recycleai.aging_inventory_summary (age_bucket);

COMMENT ON MATERIALIZED VIEW recycleai.aging_inventory_summary IS 
'Priority 3 User Story: Aging & Slow-Mover Intelligence. Daily refreshed view for dashboard and PDF reports.';

-- =====================================================
-- 2. TOP VALUABLE PARTS DASHBOARD (Priority 4: Pricing Intelligence)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS recycleai.top_valuable_parts CASCADE;

CREATE MATERIALIZED VIEW recycleai.top_valuable_parts AS
SELECT 
    pt.part_name,
    pt.part_category,
    COUNT(*) as inventory_count,
    ROUND(AVG(p.listed_price), 2) as avg_listed_price,
    ROUND(SUM(p.listed_price), 2) as total_inventory_value,
    COUNT(CASE WHEN p.status = 'in_inventory' THEN 1 END) as available_count,
    COUNT(CASE WHEN p.status = 'listed' THEN 1 END) as listed_count,
    ROUND(AVG(CASE WHEN p.status = 'sold' THEN p.listed_price END), 2) as avg_sold_price
FROM recycleai.parts p
JOIN recycleai.part_types pt ON p.part_type_id = pt.id
WHERE p.status IN ('in_inventory', 'listed', 'sold')
GROUP BY pt.part_name, pt.part_category
HAVING COUNT(*) > 0
ORDER BY total_inventory_value DESC;

CREATE UNIQUE INDEX CONCURRENTLY top_valuable_parts_refresh_idx 
ON recycleai.top_valuable_parts (part_name);

COMMENT ON MATERIALIZED VIEW recycleai.top_valuable_parts IS 
'Priority 4 User Story: Pricing & Profitability Intelligence. Dashboard view showing most valuable parts by total inventory value.';

-- =====================================================
-- 3. PROFITABILITY BY VEHICLE (Priority 4: Margin Analysis)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS recycleai.profitability_by_vehicle CASCADE;

CREATE MATERIALIZED VIEW recycleai.profitability_by_vehicle AS
SELECT 
    m.name as make_name,
    mo.name as model_name,
    v.year,
    COUNT(DISTINCT v.id) as vehicle_count,
    COUNT(p.id) as total_parts,
    COUNT(CASE WHEN p.status = 'in_inventory' THEN 1 END) as available_parts,
    ROUND(SUM(p.listed_price), 2) as total_listed_value,
    ROUND(AVG(v.estimated_part_out_value), 2) as avg_part_out_value,
    ROUND(AVG(v.purchase_price), 2) as avg_purchase_price,
    ROUND(AVG(v.estimated_part_out_value - v.purchase_price), 2) as avg_potential_margin,
    ROUND((AVG(v.estimated_part_out_value) - AVG(v.purchase_price)) / AVG(v.purchase_price) * 100, 1) as avg_margin_pct
FROM recycleai.vehicles v
JOIN recycleai.makes m ON v.make_id = m.id
JOIN recycleai.models mo ON v.model_id = mo.id
LEFT JOIN recycleai.parts p ON p.vehicle_id = v.id
GROUP BY m.name, mo.name, v.year
HAVING COUNT(DISTINCT v.id) > 0
ORDER BY avg_potential_margin DESC;

CREATE UNIQUE INDEX CONCURRENTLY profitability_by_vehicle_refresh_idx 
ON recycleai.profitability_by_vehicle (make_name, model_name, year);

COMMENT ON MATERIALIZED VIEW recycleai.profitability_by_vehicle IS 
'Priority 4 User Story: "Which models/parts give us the best margins?". Margin analysis by make/model/year for profitability reporting.';

-- =====================================================
-- REFRESH POLICY
-- =====================================================

-- Create refresh function for safe concurrent updates
CREATE OR REPLACE FUNCTION recycleai.refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY recycleai.aging_inventory_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY recycleai.top_valuable_parts;
    REFRESH MATERIALIZED VIEW CONCURRENTLY recycleai.profitability_by_vehicle;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '=== MATERIALIZED VIEWS CREATION COMPLETE ===' as status;
SELECT 'All dashboard and reporting views created successfully.' as message;

-- Test the views
SELECT 'Aging Summary Sample:' as test;
SELECT * FROM recycleai.aging_inventory_summary LIMIT 3;

SELECT 'Top Valuable Parts Sample:' as test;
SELECT * FROM recycleai.top_valuable_parts LIMIT 3;

SELECT 'Profitability Sample:' as test;
SELECT * FROM recycleai.profitability_by_vehicle LIMIT 3;

SELECT 'Refresh function created. Run REFRESH MATERIALIZED VIEW CONCURRENTLY or recycleai.refresh_materialized_views() for updates.' as next_steps;

-- Show materialized views
SELECT 
    schemaname,
    matviewname,
    matviewowner,
    definition
FROM pg_matviews 
WHERE schemaname = 'recycleai'
ORDER BY matviewname;