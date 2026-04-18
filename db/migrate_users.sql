-- User Migration Script
-- Migrates users and user_yard_access from salvage to recycleai
-- Part of Phase 2 migration (todo: migrate-users)

-- Set timezone for consistent timestamps
SET timezone = 'UTC';

-- 1. Migrate users
INSERT INTO recycleai.users (id, cognito_sub, email, created_at)
SELECT 
    id,
    cognito_sub,
    email,
    COALESCE(created_at, NOW()) as created_at
FROM salvage.users
ON CONFLICT (id) DO NOTHING;

-- 2. Migrate user_yard_access (note: table was renamed from user_yards)
INSERT INTO recycleai.user_yard_access (user_id, yard_id, created_at)
SELECT 
    user_id,
    yard_id,
    COALESCE(created_at, NOW()) as created_at
FROM salvage.user_yards
ON CONFLICT (user_id, yard_id) DO NOTHING;

-- Verification
SELECT '=== USER MIGRATION COMPLETE ===' as status;
SELECT 'recycleai.users' as table_name, COUNT(*) as row_count FROM recycleai.users
UNION ALL
SELECT 'recycleai.user_yard_access', COUNT(*) FROM recycleai.user_yard_access
UNION ALL
SELECT 'salvage.users (source)', COUNT(*) FROM salvage.users
UNION ALL
SELECT 'salvage.user_yards (source)', COUNT(*) FROM salvage.user_yards;