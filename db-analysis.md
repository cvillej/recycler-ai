# Database Analysis - Salvage Schema

**Analysis Date:** April 13, 2026
**Database:** `ai` (schema: `salvage`)
**Connection:** localhost:5432, user `car`

**IMPORTANT NOTES FROM INSTRUCTIONS:**
- Only sampled records (not full table scans)
- Ignored tables: `rag_*`, `_schema_migrations`, `retrieval_feedback`, `memories`, materialized views, indexes
- Identified both explicit FK relationships AND implicit relationships based on ID patterns and data content
- **No schema redesign or improvement suggestions** - pure analysis of current state

## Core Entity Tables

### 1. Users & Access Control
- **users**: Core user table (`id`, `cognito_sub`, `email`, `created_at`)
  - Only 1 record currently (id=1)
- **user_yards**: Junction table linking users to yards (composite PK on `user_id`, `yard_id`)
  - Establishes which users can access which yards

### 2. Yard Management
- **yard_configs**: Primary yard entity (`id`, `yard_id`, `desired_margin_pct`, `safety_buffer_pct`, `auction_fees_pct`, `default_dismantling_cost`, `transport_cost_default`, timestamps)
  - `yard_id` appears to be the business identifier
  - Only 1 yard currently (yard_id=1)
- **yard_aggregates**: Aggregated metrics per yard over time periods
  - Links to `yard_configs.yard_id`
  - Contains metrics like `total_items`, `total_estimated_value`, aging buckets, `avg_margin_pct`
- **yard_sales**: Records of parts sold from yards
  - Links to `yard_configs.yard_id`, `vehicles.id`, `part_types.id`, `condition_grades.id`

### 3. Vehicle Taxonomy (Critical ID Relationships)
- **make** (`id`, `name`): Honda, Ram, Jeep, Ford, Nissan, etc.
- **make_alias**: Alternative names mapping to makes (e.g., "Dodge"→make_id=2, "Chevy"/"Chev"→make_id=7)
- **model** (`id`, `make_id`, `name`): CR-V, Accord, Tundra, 1500, Civic, etc.
- **model_alias**: Alternative model names
- **vehicle_profiles** (`id`, `year`, `make_id`, `model_id`, `trim`, `vehicle_type`):
  - **Central linking table** - most other tables reference `vehicle_profiles.id`
  - Combines year + make + model + trim
  - Examples: 2021 Honda CR-V, 2020 Honda Accord
- **vehicles** (`id`, `yard_id`, `vehicle_profile_id`, `vin`, `mileage`, `damage_type`, `condition_notes`, `purchase_price`, `status`):
  - Individual physical vehicles at a yard
  - Links to both `yard_configs.yard_id` AND `vehicle_profiles.id`
  - Status examples: "dismantled"

### 4. Parts & Inventory
- **part_types** (`id`, `part_key`, `part_name`, `part_category`, `ebay_category_id`, `search_keywords`, `excluded_keywords`):
  - Core part definitions: "01-engine", "02-transmission", "03-transfer_case", etc.
  - Organized by `part_category` (engine, drivetrain, etc.)
  - Links to eBay categories
- **part_alias**: Alternative names for parts (e.g., "motor"→part_type_id=1, "trans"/"tranny"→part_type_id=2)
- **condition_grades** (`id`, `grade_key`, `display_name`, `sort_order`, `price_adjustment_pct`, `description`):
  - Grading system: New, Like New, Refurbished, Excellent, Good, Fair, Poor, etc.
  - Has `price_adjustment_pct` for valuation
- **inventories** (`id`, `yard_id`, `vehicle_id`, `part_type_id`, `condition_grade_id`, `quantity`, `listed_price`, `purchase_date`, `location_notes`):
  - Links dismantled vehicles to available parts
  - Critical relationships: 
    - `vehicle_id` → `vehicles.id` (which vehicle the part came from)
    - `part_type_id` → `part_types.id`
    - `condition_grade_id` → `condition_grades.id`
    - `yard_id` → `yard_configs.yard_id`

### 5. Market Data (eBay Integration)
- **ebay_categories**: Hierarchical eBay category tree (root: "Parts & Accessories")
  - `part_types` links to these via `ebay_category_id`
- **ebay_condition_mappings**: Maps eBay's condition IDs/text to internal `condition_grades`
- **ebay_live_searches** / **ebay_live_listings**:
  - Market research for current listings
  - Both link to `vehicle_profiles.id` + `part_types.id`
  - `ebay_live_listings` also links to `condition_grades.id`
- **ebay_sold_searches** / **ebay_sold_listings**:
  - Historical sold data (very valuable for pricing)
  - Same linking pattern: `vehicle_profiles.id` + `part_types.id`

### 6. Auction Data
- **salvage_auctions**: Upcoming auction opportunities
  - Links to `vehicle_profiles.id`
  - Contains `vin`, `lot_number`, `auction_platform` (Copart, IAAI, Manheim), `asking_price`, etc.

## Critical ID Relationships (Current State)

### Explicit Foreign Keys:
1. **vehicle_profiles** is the **hub**:
   - `vehicles.vehicle_profile_id` → `vehicle_profiles.id`
   - `ebay_live_searches.vehicle_profile_id`, `ebay_sold_searches.vehicle_profile_id` → `vehicle_profiles.id`
   - `ebay_live_listings.vehicle_profile_id`, `ebay_sold_listings.vehicle_profile_id` → `vehicle_profiles.id`
   - `salvage_auctions.vehicle_profile_id` → `vehicle_profiles.id`
   - `vehicle_profiles.make_id` → `make.id`
   - `vehicle_profiles.model_id` → `model.id`

2. **part_types** relationships:
   - `part_types.ebay_category_id` → `ebay_categories.id`
   - Multiple tables reference `part_types.id` (inventories, yard_sales, all ebay_* tables)

3. **condition_grades** relationships:
   - Used across inventories, yard_sales, ebay listings for valuation

4. **yard_configs.yard_id** is referenced by:
   - `vehicles.yard_id`
   - `inventories.yard_id` 
   - `yard_sales.yard_id`
   - `yard_aggregates.yard_id`
   - `user_yards.yard_id`

### Implicit Relationships (not enforced by FKs):
- **Alias tables** (`make_alias`, `model_alias`, `part_alias`) provide text-to-ID mapping but aren't directly referenced by other tables in the current schema. They appear to be for data normalization during import.
- **vehicles → inventories**: While there's a FK on `inventories.vehicle_id`, the business logic suggests inventories are "children" of vehicles (parts pulled from specific vehicles).
- **Market Data → Inventory**: The eBay search/listing tables and `yard_sales` all use the same `vehicle_profile_id` + `part_type_id` compound key pattern, creating an implicit analytical relationship even if not explicitly modeled as such.
- **VIN uniqueness**: VINs in `vehicles` and `salvage_auctions` likely have business-level uniqueness not enforced at DB level.

## Data Volume Observations (from sampling):
- Small number of core entities (1 user, 1 yard, ~5-10 makes/models)
- Larger tables: `inventories` (800+ records), `ebay_live_searches` (thousands), `yard_sales` (1700+)
- eBay data appears to be the bulk of the database
- Most data is centered around the Honda CR-V and similar popular vehicles

## Summary of Current Data Model Purpose:
The current schema supports a salvage yard inventory management system with:
1. **Physical inventory tracking** (vehicles → parts → sales)
2. **Market intelligence** (eBay live/sold data keyed by same vehicle_profile + part_type)
3. **Pricing intelligence** (condition grades, historical sales, margin calculations)
4. **Taxonomy normalization** (aliases for fuzzy matching during data import)

The ID relationships are heavily centered around `vehicle_profiles.id` as the primary analytical dimension, with `part_types.id` and `condition_grades.id` as secondary dimensions. This creates a star-like schema for market analysis and inventory valuation.

**File created as requested. All analysis is based solely on current schema and sampled data. No redesign recommendations included.**

---

## Data Realism Analysis and Regeneration Plan (April 2026)

### Current Data State (from DB queries)

**Real Constraints (Our Anchor):**
- `ebay_sold_listings`: **99 unique vehicle profiles**, ~842k total records. Heavily skewed toward popular vehicles:
  - Top profiles: Chevrolet Suburban (2021/2022), Ford F-150 (multiple years), Ford Ranger, Chevrolet Tahoe, Toyota Camry.
  - Date range: 2016–2026.
  - This is **paid real data**. We will **not** expand beyond these 99 profiles to avoid additional cost.

**Simulated Data:**
- **vehicles**: 300 records across 90 profiles. Mileage 38k–184k (reasonable). Status mostly "dismantled".
- **inventories** (parts): 2,364 records. ~8 parts per vehicle on average. 
  - Part distribution: Reasonable mix (Transfer Case, Transmission, Fuel Pump, Brake Calipers, Catalytic Converter, A/C Compressor, body panels). 
  - Condition: Heavily "Good" (40%) and "Fair" (29%). Some "Damaged"/"For Parts".
  - Quantities: Almost all = 1.
- **yard_sales**: 5,426 records. Avg price $155.47 (very realistic). Date range 2024–2026.
- **salvage_auctions**: ~35 upcoming auctions across Copart, IAAI, Manheim. All upcoming status.
- **Location data**: Semi-structured free-text (`"Row B Shelf 2 Bin 12"`, `"Row A Bin 5"`). Inconsistent format.

### Realism Gaps vs Real Salvage Yard

From research (Financial Models Lab, YardSmart/Dismantly user feedback, industry KPIs):
- **Real yards** typically have:
  - 500–2000+ vehicles in various states (not just dismantled).
  - 8,000–20,000+ part records with varying quantities (some parts have 2–6 units).
  - Clear aging distribution: Most parts sell in <90 days; significant long tail (180+ days) of slow movers.
  - Structured yard locations (Row/Bay/Shelf/Bin system) critical for "where is this part?" queries.
  - Strong correlation between auction purchases, part extraction, and eventual sales.
- **User Story Support Gaps**:
  - **Auction Valuation**: Hard to calculate realistic "part-out value" because simulated inventory isn't strongly tied to real eBay comps per profile.
  - **Aging/Slow Movers**: Missing consistent `acquired_date`/`dismantled_date` fields for accurate "days in yard" calculations.
  - **Location Tracking**: Free-text `location_notes` makes "where is this part?" queries fragile.
  - **Profitability**: Pricing in inventories isn't well-aligned with real `ebay_sold_listings` data for the 99 profiles.
  - **Scale & Diversity**: Current data feels a bit thin and too uniform.

### Regeneration & Enhancement Plan

**Core Principle**: Anchor **all** generated data to the 99 real vehicle profiles that have rich `ebay_sold_listings` history. This ensures market data feels authentic and supports "is this car at auction valuable?" queries.

#### Phase 1: Schema Enhancements (One-time)
- Create `yard_locations` table (id, yard_id, row_code, bay, shelf, bin, description, capacity).
- Add columns to existing tables:
  - `vehicles`: `acquired_date`, `dismantled_date`, `estimated_part_out_value` (cached).
  - `inventories`/`parts`: `acquired_date`, `listed_date`, `location_id` (FK to new table).
- Add indexes on high-query fields (`vehicle_profile_id`, `part_type_id`, `acquired_date`, `status`).

#### Phase 2: Data Regeneration Strategy
1. **Vehicles (Car Instances)**: Regenerate to ~650 vehicles.
   - Distribution: 70% from top 15 real profiles (F-150, Suburban, Tahoe, Ranger, Camry, etc.), 30% spread across remaining 84 profiles.
   - Realistic attributes: Varied mileage (20k–250k), mix of purchase dates (last 24 months), realistic damage types and notes.
   - Status mix: 40% "on_yard", 50% "dismantled", 10% "sold/scrapped".

2. **Parts/Inventory (Part Instances)**: Target 8,500–12,000 records (~13 parts per vehicle).
   - Use real part mix weighted by what actually sells in `ebay_sold_listings` for each profile.
   - Vary quantity (1–5 for common parts like lights/mirrors, 1 for engines/transmissions).
   - Condition: More realistic spread (Excellent 15%, Good 35%, Fair 25%, Damaged 15%, For Parts 10%).
   - **Structured locations**: Assign to proper `yard_locations` entries (e.g., mechanical parts in "Row C", body panels in "Row E").
   - Pricing: Base on 60–85% of recent `ebay_sold_listings` average for that profile/part_type.

3. **Yard Sales**: Expand to ~12,000–15,000 records with realistic velocity.
   - Higher velocity for high-turnover parts (lights, mirrors, small mechanicals).
   - Lower velocity for engines/transmissions (creates realistic slow-mover data).
   - Prices aligned with real eBay data.

4. **Salvage Auctions**: Generate 80–120 upcoming auctions.
   - Mix of "high potential" (strong part-out profiles) and "marginal" ones.
   - Include some vehicles that match our current inventory gaps for realistic decision-making.

5. **Supporting Data**:
   - Generate realistic `acquired_date` distribution (most within last 18 months, long tail for slow movers).
   - Create cached valuation data so "part-out value" queries are fast and realistic.

#### Phase 3: Validation for User Stories
This regenerated data will fully support:
- **Auction Valuation**: Strong linkage between upcoming auctions and real eBay comps + our inventory.
- **Inventory Queries**: "Do we have X?" and "Where is it?" will return believable results.
- **Aging Reports**: Natural distribution of slow-movers (some parts >1 year old).
- **Profitability**: Clear margin calculations based on real market data.
- **Feels Real**: A yard operator would see familiar vehicles (F-150s, Suburbans), realistic part mix, believable pricing, and logical aging patterns.

**Recommended Next Step**: Run a Python script (or SQL generation) that:
1. Identifies the 99 "golden" vehicle profiles from `ebay_sold_listings`.
2. Generates vehicles and parts weighted by real sales frequency.
3. Creates consistent temporal and location data.
4. Backfills `yard_sales` to match new inventory patterns.

This approach maximizes the value of our paid eBay data while creating a convincing, story-supporting dataset that feels like a real mid-sized salvage yard (roughly $1.2M–$2M in inventory value).

**Questions for you:**
1. What is the target scale for the yard (small, medium, large)? This affects total record counts.
2. Should we create a `parts` table (renaming from `inventories`) as proposed earlier, or keep the current name during regeneration?
3. Do you want me to write the regeneration script now?

**End of updated analysis.**
