-- Fixed Taxonomy Migration Script
-- Corrected column mappings and execution order for recycleai schema
-- Runs after schema creation (Phase 2, todo: migrate-taxonomy)

-- Set timezone for consistent timestamps
SET timezone = 'UTC';

-- 1. Migrate makes (simple mapping)
INSERT INTO recycleai.makes (id, name, created_at, updated_at)
SELECT 
    id,
    name,
    NOW() as created_at,
    NOW() as updated_at
FROM salvage.make
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate models 
INSERT INTO recycleai.models (id, make_id, name, created_at, updated_at)
SELECT 
    id,
    make_id,
    name,
    NOW() as created_at,
    NOW() as updated_at
FROM salvage.model
ON CONFLICT (id) DO NOTHING;

-- 3. Migrate part_types
INSERT INTO recycleai.part_types (
    id, part_key, part_name, part_category, 
    ebay_category_id, search_keywords, excluded_keywords,
    created_at, updated_at
)
SELECT 
    id,
    part_key,
    part_name,
    part_category,
    ebay_category_id,
    search_keywords,
    excluded_keywords,
    NOW() as created_at,
    NOW() as updated_at
FROM salvage.part_types
ON CONFLICT (id) DO NOTHING;

-- 4. Migrate condition_grades (must come before ebay_condition_mappings)
INSERT INTO recycleai.condition_grades (
    id, grade_key, display_name, sort_order, 
    price_adjustment_pct, description, created_at, updated_at
)
SELECT 
    id,
    grade_key,
    display_name,
    sort_order,
    price_adjustment_pct,
    description,
    NOW() as created_at,
    NOW() as updated_at
FROM salvage.condition_grades
ON CONFLICT (id) DO NOTHING;

-- 5. Migrate ebay_categories
INSERT INTO recycleai.ebay_categories (id, name, parent_id)
SELECT id, name, parent_id
FROM salvage.ebay_categories
ON CONFLICT (id) DO NOTHING;

-- 6. Migrate ebay_condition_mappings (now that condition_grades exist)
INSERT INTO recycleai.ebay_condition_mappings (
    id, ebay_condition_id, ebay_condition_text, 
    condition_grade_id, match_priority
)
SELECT 
    id, 
    ebay_condition_id, 
    ebay_condition_text, 
    condition_grade_id, 
    match_priority
FROM salvage.ebay_condition_mappings
ON CONFLICT (id) DO NOTHING;

-- 7. Migrate alias tables (using correct column names: 'name' not 'alias')
INSERT INTO recycleai.make_aliases (id, make_id, name, created_at)
SELECT 
    id, 
    make_id, 
    name, 
    NOW() as created_at
FROM salvage.make_alias
ON CONFLICT (id) DO NOTHING;

INSERT INTO recycleai.model_aliases (id, model_id, name, created_at)
SELECT 
    id, 
    model_id, 
    name, 
    NOW() as created_at
FROM salvage.model_alias
ON CONFLICT (id) DO NOTHING;

INSERT INTO recycleai.part_aliases (id, part_type_id, name, created_at)
SELECT 
    id, 
    part_type_id, 
    name, 
    NOW() as created_at
FROM salvage.part_alias
ON CONFLICT (id) DO NOTHING;

-- Final verification
SELECT '=== TAXONOMY MIGRATION COMPLETE ===' as status;
SELECT 'makes' as table_name, COUNT(*) as row_count FROM recycleai.makes
UNION ALL
SELECT 'models', COUNT(*) FROM recycleai.models
UNION ALL
SELECT 'part_types', COUNT(*) FROM recycleai.part_types
UNION ALL
SELECT 'condition_grades', COUNT(*) FROM recycleai.condition_grades
UNION ALL
SELECT 'ebay_categories', COUNT(*) FROM recycleai.ebay_categories
UNION ALL
SELECT 'ebay_condition_mappings', COUNT(*) FROM recycleai.ebay_condition_mappings
UNION ALL
SELECT 'make_aliases', COUNT(*) FROM recycleai.make_aliases
UNION ALL
SELECT 'model_aliases', COUNT(*) FROM recycleai.model_aliases
UNION ALL
SELECT 'part_aliases', COUNT(*) FROM recycleai.part_aliases
ORDER BY table_name;