-- Taxonomy Migration Script
-- Migrates core taxonomy tables from salvage.* to recycleai.*
-- Part of Phase 2 migration per the active Cursor plan

-- 1. Migrate makes (simple mapping)
INSERT INTO recycleai.makes (id, name, created_at, updated_at)
SELECT 
    id,
    name,
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM salvage.make
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate models (with FK to makes)
INSERT INTO recycleai.models (id, make_id, name, created_at, updated_at)
SELECT 
    id,
    make_id,
    name,
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
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
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM salvage.part_types
ON CONFLICT (id) DO NOTHING;

-- 4. Migrate condition_grades
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
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM salvage.condition_grades
ON CONFLICT (id) DO NOTHING;

-- 5. Migrate ebay_categories
INSERT INTO recycleai.ebay_categories (id, name, parent_id)
SELECT id, name, parent_id
FROM salvage.ebay_categories
ON CONFLICT (id) DO NOTHING;

-- 6. Migrate ebay_condition_mappings
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

-- 7. Migrate alias tables (with added created_at if missing)
INSERT INTO recycleai.make_aliases (id, make_id, alias, created_at)
SELECT 
    id, 
    make_id, 
    alias, 
    COALESCE(created_at, NOW()) as created_at
FROM salvage.make_alias
ON CONFLICT (id) DO NOTHING;

INSERT INTO recycleai.model_aliases (id, model_id, alias, created_at)
SELECT 
    id, 
    model_id, 
    alias, 
    COALESCE(created_at, NOW()) as created_at
FROM salvage.model_alias
ON CONFLICT (id) DO NOTHING;

INSERT INTO recycleai.part_aliases (id, part_type_id, alias, created_at)
SELECT 
    id, 
    part_type_id, 
    alias, 
    COALESCE(created_at, NOW()) as created_at
FROM salvage.part_alias
ON CONFLICT (id) DO NOTHING;

-- Verify migration
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