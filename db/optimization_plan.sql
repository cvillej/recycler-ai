-- Database Optimization Plan for RecycleAI
-- Analyzes query patterns from user stories and recommends indexes, 
-- materialized views, and performance optimizations

SELECT '🚀 RECYCLEAI DATABASE OPTIMIZATION PLAN' as title;
SELECT 'Based on user stories from docs/user-stories.md' as subtitle;
SELECT 'Generated: ' || NOW()::text as generated_at;
SELECT '============================================================' as separator;

-- 1. Query Pattern Analysis from User Stories
SELECT '1. KEY QUERY PATTERNS IDENTIFIED' as section;

SELECT 'Auction Intelligence Queries:' as query_type;
SELECT '- Part-out value estimation: vehicles + parts JOINs with make/model filters' as pattern;
SELECT '- Margin calculations: estimated_part_out_value - purchase_price' as pattern;
SELECT '- Top parts by vehicle: GROUP BY make, model, part_type' as pattern;

SELECT 'Inventory Visibility Queries:' as query_type;
SELECT '- Search by make/model/part/condition: multi-column filters' as pattern;
SELECT '- Location lookup: parts JOIN yard_locations on location_id' as pattern;
SELECT '- Vehicle part inventory: parts GROUP BY vehicle_id' as pattern;

SELECT 'Aging & Slow-Mover Queries:' as query_type;
SELECT '- AGE() calculations on acquired_date/listed_date' as pattern;
SELECT '- GROUP BY aging buckets (<30, 30-90, 90-180, >180 days)' as pattern;
SELECT '- Value of aging inventory: SUM(listed_price) by age bucket' as pattern;

SELECT 'Pricing & Profitability Queries:' as query_type;
SELECT '- Most valuable parts: GROUP BY part_type, SUM(listed_price)' as pattern;
SELECT '- Margin by make/model: GROUP BY make, model with profitability calculations' as pattern;
SELECT '- Price comparisons: grok_sold_listings vs current inventory' as pattern;

SELECT 'Dashboard & Reporting Queries:' as query_type;
SELECT '- Real-time summaries, heat maps, top-N queries across multiple tables' as pattern;

-- 2. Recommended Indexes
SELECT '2. RECOMMENDED INDEXES' as section;

SELECT 'High Priority Indexes for Frequent Queries:' as priority;
SELECT '1. vehicles(make_id, model_id, year, status, acquired_date)' as index;
SELECT '2. parts(vehicle_id, part_type_id, location_id, status, acquired_date)' as index;
SELECT '3. grok_sold_listings(make_id, model_id, part_type_id, date_sold, data_source)' as index;
SELECT '4. parts(location_id) - for location lookups and yard heat maps' as index;
SELECT '5. yard_sales(sold_date, platform, condition_grade_id) - for aging reports' as index;

SELECT 'Composite Indexes for Common JOIN Patterns:' as index_type;
SELECT '- parts(vehicle_id, part_type_id, status)' as composite;
SELECT '- vehicles(make_id, model_id, status)' as composite;
SELECT '- grok_sold_listings(part_type_id, condition_grade_id, data_source)' as composite;

-- 3. Materialized Views for Expensive Aggregations
SELECT '3. RECOMMENDED MATERIALIZED VIEWS' as section;

SELECT 'Aging Inventory Summary (refreshed daily):' as view_name;
SELECT 'CREATE MATERIALIZED VIEW aging_inventory_summary AS
SELECT 
    CASE 
        WHEN AGE(CURRENT_DATE, acquired_date::date) < INTERVAL ''30 days'' THEN ''< 30 days''
        WHEN AGE(CURRENT_DATE, acquired_date::date) < INTERVAL ''90 days'' THEN ''30-90 days''
        WHEN AGE(CURRENT_DATE, acquired_date::date) < INTERVAL ''180 days'' THEN ''90-180 days''
        ELSE ''> 180 days''
    END as age_bucket,
    COUNT(*) as part_count,
    ROUND(SUM(listed_price), 2) as total_value,
    ROUND(AVG(listed_price), 2) as avg_value,
    COUNT(CASE WHEN status = ''in_inventory'' THEN 1 END) as in_inventory_count
FROM recycleai.parts 
GROUP BY age_bucket;' as view_sql;

SELECT 'Most Valuable Parts Dashboard:' as view_name;
SELECT 'CREATE MATERIALIZED VIEW top_valuable_parts AS
SELECT 
    pt.part_name,
    COUNT(*) as inventory_count,
    ROUND(AVG(p.listed_price), 2) as avg_listed_price,
    ROUND(SUM(p.listed_price), 2) as total_inventory_value,
    COUNT(CASE WHEN p.status = ''in_inventory'' THEN 1 END) as available_count
FROM recycleai.parts p
JOIN recycleai.part_types pt ON p.part_type_id = pt.id
WHERE p.status IN (''in_inventory'', ''listed'')
GROUP BY pt.part_name
ORDER BY total_inventory_value DESC;' as view_sql;

SELECT 'Profitability by Make/Model:' as view_name;
SELECT 'CREATE MATERIALIZED VIEW profitability_by_vehicle AS
SELECT 
    m.name as make_name,
    mo.name as model_name,
    COUNT(DISTINCT v.id) as vehicle_count,
    COUNT(p.id) as part_count,
    ROUND(SUM(p.listed_price), 2) as total_listed_value,
    ROUND(AVG(v.estimated_part_out_value), 2) as avg_part_out_value
FROM recycleai.vehicles v
JOIN recycleai.makes m ON v.make_id = m.id
JOIN recycleai.models mo ON v.model_id = mo.id
LEFT JOIN recycleai.parts p ON p.vehicle_id = v.id
GROUP BY m.name, mo.name
ORDER BY total_listed_value DESC;' as view_sql;

-- 4. Performance Recommendations
SELECT '4. PERFORMANCE RECOMMENDATIONS' as section;

SELECT 'Indexing Strategy:' as recommendation;
SELECT '- Create indexes on all columns used in WHERE, JOIN, GROUP BY, and ORDER BY' as detail;
SELECT '- Use composite indexes for common multi-column query patterns' as detail;
SELECT '- Consider BRIN indexes for date-based aging queries on large tables' as detail;
SELECT '- Partial indexes for common status filters (status = ''in_inventory'').' as detail;

SELECT 'Materialized View Strategy:' as recommendation;
SELECT '- Refresh aging_inventory_summary and top_valuable_parts daily or on significant changes' as detail;
SELECT '- Use concurrent refresh to avoid locking production queries' as detail;
SELECT '- Consider incremental materialized views for very large datasets' as detail;

SELECT 'Query Optimization:' as recommendation;
SELECT '- Use appropriate indexes for auction valuation queries (make_id, model_id, year)' as detail;
SELECT '- Cache frequently accessed dashboard queries in application layer' as detail;
SELECT '- Consider database functions for complex calculations (part-out value, aging buckets)' as detail;
SELECT '- Monitor slow queries and add indexes based on actual usage patterns' as detail;

SELECT 'Scaling Considerations:' as recommendation;
SELECT '- Partition large tables (parts, grok_sold_listings, sales) by date or vehicle type' as detail;
SELECT '- Consider read replicas for analytical queries if dashboard usage grows' as detail;
SELECT '- Archive old sales data (>2 years) to maintain query performance' as detail;

-- 5. Implementation Priority
SELECT '5. IMPLEMENTATION PRIORITY' as section;

SELECT 'Phase 1 (Immediate):' as priority;
SELECT '1. Add all recommended indexes (vehicles, parts, grok_sold_listings, yard_locations)' as item;
SELECT '2. Create core materialized views for aging and valuable parts' as item;
SELECT '3. Add indexes for common user story queries' as item;

SELECT 'Phase 2 (After validation):' as priority;
SELECT '1. Create database functions for complex business logic' as item;
SELECT '2. Implement query caching layer in application' as item;
SELECT '3. Add monitoring for slow queries and performance metrics' as item;

SELECT 'Phase 3 (Scale):' as priority;
SELECT '1. Table partitioning for large tables' as item;
SELECT '2. Read replicas for analytical workload' as item;
SELECT '3. Advanced indexing strategies based on real usage patterns' as item;

SELECT '
🎯 RECOMMENDATION SUMMARY:

The current schema design is solid, but to support all user stories efficiently we need:

1. **Strategic indexes** on high-frequency query columns (make_id, model_id, part_type_id, status, acquired_date, location_id)
2. **Materialized views** for expensive aggregations (aging reports, top valuable parts, profitability by vehicle)
3. **Database functions** to encapsulate complex business logic (part-out valuation, aging calculations)
4. **Query monitoring** to identify and optimize real-world performance bottlenecks

This optimization layer will ensure the system remains responsive even as data grows to support 200+ profiles and thousands of daily queries.

The validation queries in validate_user_stories.sql can be extended to include performance testing of these optimized queries.

All recommendations are documented and ready for implementation.' as final_recommendation;