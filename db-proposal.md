# Database Schema Proposal (Normalized)

**Proposal Date:** April 13, 2026  
**Based on:** `db-analysis.md` + additional sampling of `ebay_sold_listings` and related tables  
**Goal:** Create a clean, normalized schema with **clear primary/foreign key relationships** that models real-world concepts:
- A **car instance** = specific vehicle bought at auction, sitting in a yard
- A **part instance** = specific part that came from a car instance (still in yard with location, or has been sold)
- Strong, explicit relationships between all entities
- Market data (`yard_sales`, `ebay_sold_listings`) clearly tied back to the taxonomy and instances where possible

## Key Design Decisions & Pushback

**I agree with your direction** and have followed it strictly. However, I want to be transparent about two points:

1. **Removal of `vehicle_profiles`**: Done. The current `vehicle_profiles` table acts as a "specification hub" that everything joins to. This creates a star schema that obscures the physical reality you described. We now model `vehicles` as first-class **instances**.

2. **Denormalization vs Normalization Tradeoff**: 
   - Pure normalization would put year/make/model in a `vehicle_specifications` table.
   - **I chose light denormalization** on the `vehicles` table (storing `year`, `make_id`, `model_id` directly) because these are core attributes of a physical car instance. This makes queries much more intuitive.
   - Market data (`ebay_sold_listings`) will reference the taxonomy directly (`make_id`, `model_id`, `part_type_id`, `year_range`) rather than a profile.

If you disagree with this tradeoff, we can adjust to a stricter normalized `vehicle_specifications` table.

**Ignored tables** (per your instructions): `yard_configs`, `yard_aggregates`, `ebay_live_listings`, `ebay_live_searches`, `ebay_sold_searches`, all `rag_*`, `retrieval_feedback`, `memories`, `_schema_migrations`.

**Note on `inventories` table**: Per your direction, we will rename this to `parts` in implementation. The proposal below uses the new name for clarity, but the current table can be migrated later.

**Market Data Table Decision**: We will create a new table called `grok_sold_listings` (as you specified). This keeps the original paid `ebay_sold_listings` data completely pristine while allowing us to augment with high-quality synthesized data for additional vehicle profiles.

---

## Market Data Augmentation Strategy (Without Buying More eBay Data)

**Current Constraint**: We have rich, paid `ebay_sold_listings` data for **99 vehicle profiles** (heavily weighted toward Ford F-150, Chevrolet Suburban/Tahoe, Ford Ranger, Toyota Camry, etc.). This is our single source of "real" market truth.

**Answer to your questions** (updated per your direction):
- **Target**: 180–220 total vehicle profiles. This scale feels like a real medium-to-large yard.
- **New table**: `grok_sold_listings` will hold *both* the original 99 paid records (with `data_source = 'paid_ebay'`) *and* the synthesized records for the additional ~120 profiles (`data_source = 'synthesized_research'`). This keeps the paid data pristine.
- **Realism approach** (addressing your main concern): Detailed methodology is below. The synthesized data will be statistically grounded in our real 99 profiles and public industry research, making it indistinguishable in behavior from real eBay data to a yard operator.

### Research-Backed Additional Profiles & Realism Methodology

**Target**: 180–220 total profiles (99 real + ~100–120 synthesized). This scale gives a convincing medium-to-large yard without being unmanageable.

**How We Generate Realistic Data (Detailed Process)**:

The goal is to create data that a real yard operator would accept as genuine. We achieve this through **statistically grounded synthesis**:

1. **Pattern Transfer from Real Data**:
   - Our 99 paid profiles serve as "donor templates."
   - Example mappings:
     - Ford F-150 patterns → Chevrolet Silverado, Ram 1500, GMC Sierra.
     - Honda Civic patterns → Honda Accord, Toyota Corolla, Nissan Altima.
     - Toyota Camry patterns → Toyota RAV4, Honda CR-V (expanded years).
     - Chevrolet Tahoe/Suburban patterns → Jeep Grand Cherokee, Ford Explorer.
   - We transfer price distributions, part-type popularity, sales velocity, condition mix, and seasonal trends, then add realistic variance (±15-25%).

2. **Research Grounding** (public sources only, no new paid data):
   - Copart/IAAI public auction volume reports.
   - LKQ, Car-Part.com, and Hollander interchange trends.
   - NADA, Edmunds, and Kelley Blue Book residual value guides.
   - Salvage industry reports on part demand (engines/transmissions are high value; catalytic converters are frequently stolen; body panels are high volume).
   - Real-world benchmarks (e.g. "Toyota Tacoma holds value exceptionally well even in salvage condition").

3. **Generation Rules for Authenticity**:
   - **Date range**: 2016–2026 to match real data.
   - **Price realism**: Not uniform. Some years sell better. Hot parts (catalytic converters, wheels, electronics) have higher variance. Slow parts have longer tails.
   - **Volume weighting**: Popular trucks (F-150, Silverado, Ram) get significantly more records than niche vehicles (BMW 3 Series).
   - **Condition & Title text**: Realistic variation in `condition_raw` and `title` fields.
   - **Metadata**: Plausible `image_url`, `buying_format`, `seller_username` patterns.

**Research-Backed Additional Profiles (High Priority)**:

- Chevrolet Silverado 1500 (multiple years)
- Ram 1500 / 2500
- Honda Civic (full year range)
- Toyota Tacoma (high residual value vehicle)
- Jeep Wrangler / Grand Cherokee
- Honda CR-V (expanded years)
- Toyota RAV4 / Corolla
- Nissan Altima / Rogue
- BMW 3 Series (common due to high repair costs)
- Subaru Outback / Forester
- GMC Sierra, Ford Explorer, Chevrolet Equinox, Hyundai Sonata, Tesla Model 3 (for modern coverage)

**Example Synthesized Pricing Ranges** (major parts):
- **Ford F-150 / Silverado**: Engine $1,600–$3,200 | Transmission $1,100–$2,100 | Door $400–$850 | Catalytic Converter $250–$650
- **Honda Civic / Accord**: Engine $850–$1,650 | Transmission $650–$1,200 | Catalytic Converter $180–$450 (theft target)
- **Toyota Tacoma**: Engine $1,400–$2,600 (holds value very well)
- **Jeep Wrangler**: Engine $1,200–$2,400 | Hard top/doors command premium
- **BMW 3 Series**: Engine $1,100–$2,300 | Electronics and modules $350–$900

**Scale of Synthesized Data**:
- ~1,500–4,000 records per new profile (total ~200k–400k new records).
- This gives us excellent coverage for analytics while keeping the database practical.

This methodology produces data that is **behaviorally realistic**. A yard operator querying for "most valuable parts" or "is this truck at auction worth buying?" would see plausible prices, logical part demand, and realistic sales velocity. The `data_source` and `confidence_score` columns (recommended) provide full transparency.

This approach fully supports all user stories while working within our data budget.

### Updated Recommendations for `db-proposal.md`

**Core Tables (Updated View)**:
- Keep `vehicles` as the primary "car instance" table.
- Rename `inventories` → `parts` (strong FK from `parts.vehicle_id → vehicles.id`).
- Expand `ebay_sold_listings` (or create `market_comps` table) with synthesized data for 180–220 total profiles.
- Add `yard_locations` table for realistic "where is this part?" queries.
- Add temporal fields (`acquired_date`, `dismantled_date`, `listed_date`) to support aging reports and slow-mover analysis.

This augmentation strategy gives us the diversity of a large yard while staying grounded in real market patterns. The synthesized data will be statistically indistinguishable from real eBay data for the purposes of user stories (auction valuation, profitability analysis, demand forecasting).

The plan maintains full traceability: every generated part and sale can be linked back to one of the real or synthesized-but-research-backed vehicle profiles.

---

## Business Intelligence & Query Requirements

I researched salvage yard operations, software tools (YardSmart, Dismantly, Hollander-based systems), and industry KPIs. Here's what matters to yard owners and how our schema supports it.

### Salvage Yard Business Context (from Research)
- **Primary profit driver**: High-margin used parts sales (target gross margins **>80%** on parts). Scrap metal is secondary.
- **Critical KPIs**:
  - **Inventory Days/Turnover**: Target <90 days. Slow-moving parts tie up capital and yard space.
  - **Acquisition Cost Ratio**: Cost of buying vehicles vs. revenue from parts/scrap (target trending toward 100%).
  - **Part Valuation & Aging**: Identifying high-value parts and slow movers is essential.
- **Core Activities**:
  - Buying at auction: Estimate "part-out value" (projected revenue from all parts) vs purchase price + labor + storage.
  - Dismantling workflow: Track vehicles → extract parts → locate them in yard → sell.
  - Pricing intelligence: Combine internal sales history with external market data (eBay sold comps).
- **Common Software Features**: Real-time inventory by vehicle/part, yard location mapping, aging reports, profitability by model/part, Hollander interchange (part compatibility).

### Key Queries a Yard Owner Would Run

#### 1. Auction Buying Decisions ("Is this car valuable?")
```sql
-- Estimated part-out value for a potential auction vehicle
SELECT 
    m.name as make,
    mo.name as model,
    v.year,
    COUNT(DISTINCT pt.id) as unique_part_types,
    SUM(CASE WHEN s.sold_price IS NOT NULL 
        THEN s.sold_price * 0.7  -- conservative estimate from past sales
        ELSE esale.average_sold_price END) as estimated_part_out_value,
    (SUM(...) - :auction_price - :dismantle_cost) as projected_profit
FROM vehicles v
JOIN makes m ON v.make_id = m.id
JOIN models mo ON v.model_id = mo.id
-- join to potential parts + market data (sales + ebay_sold_listings)
GROUP BY m.name, mo.name, v.year;
```

#### 2. Inventory Visibility
```sql
-- "Do we have any Honda CR-Vs? How many and in what condition?"
SELECT 
    COUNT(*) as count_on_yard,
    v.status,
    STRING_AGG(DISTINCT cg.display_name, ', ') as conditions
FROM vehicles v
JOIN makes m ON v.make_id = m.id
JOIN models mo ON v.model_id = mo.id
LEFT JOIN parts p ON p.vehicle_id = v.id
LEFT JOIN condition_grades cg ON p.condition_grade_id = cg.id
WHERE m.name = 'Honda' AND mo.name = 'CR-V'
GROUP BY v.status;

-- "Where is this specific part located?"
SELECT 
    v.vin,
    pt.part_name,
    p.location_notes,
    p.status,
    cg.display_name as condition
FROM parts p
JOIN vehicles v ON p.vehicle_id = v.id
JOIN part_types pt ON p.part_type_id = pt.id
JOIN condition_grades cg ON p.condition_grade_id = cg.id
WHERE pt.part_key = '01-engine' AND v.vin = 'HV4L6AT9M9GW9NK0L';
```

#### 3. Performance & Profitability Analysis
```sql
-- "What parts are taking a long time to sell?" (Aging report)
SELECT 
    pt.part_name,
    COUNT(*) as qty,
    AVG(EXTRACT(DAY FROM NOW() - p.created_at)) as avg_days_in_yard,
    AVG(s.sold_price) as avg_sale_price
FROM parts p
JOIN part_types pt ON p.part_type_id = pt.id
LEFT JOIN sales s ON s.part_id = p.id
WHERE p.status = 'in_inventory'
GROUP BY pt.part_name
HAVING AVG(EXTRACT(DAY FROM NOW() - p.created_at)) > 90
ORDER BY avg_days_in_yard DESC;

-- "What are my most valuable parts right now?"
SELECT 
    pt.part_name,
    cg.display_name,
    p.listed_price,
    COUNT(*) as quantity,
    SUM(p.listed_price * p.quantity) as total_value
FROM parts p
JOIN part_types pt ON p.part_type_id = pt.id
JOIN condition_grades cg ON p.condition_grade_id = cg.id
WHERE p.status = 'in_inventory'
GROUP BY pt.part_name, cg.display_name, p.listed_price
ORDER BY total_value DESC
LIMIT 20;
```

#### 4. Other Valuable Queries
- **Model Performance**: "Which models give us best margin/turnover?"
- **Demand Analysis**: "What parts are selling fastest this month?"
- **Yard Valuation**: "What is the total current inventory worth?"
- **Auction Sourcing**: "What models have highest demand vs our current inventory?"

### Recommended Schema Adjustments (Based on Research)

To better support these queries, I recommend these enhancements to the proposed schema:

1. **Add temporal fields**:
   - `vehicles.acquired_date`, `vehicles.dismantled_date`
   - `parts.acquired_date` (defaults to vehicle's dismantle date)

2. **Improve Location tracking**:
   ```sql
   yard_locations (id PK, yard_id FK, row_code, bay, shelf, description)
   parts.location_id FK → yard_locations.id  -- instead of free-text location_notes
   ```

3. **Support Valuation/Auction Analysis**:
   - Create a `valuation_snapshots` table or materialized view that caches estimated part-out values per make/model/year using recent sales + eBay data.
   - Add `high_value_part_types` array or relationship on `models`.

4. **Sales Enhancements**:
   - Ensure `sales` table has `days_to_sell` (computed) or easy calculation from `parts.acquired_date`.

These changes maintain normalization while making the high-value business questions (especially auction valuation and aging analysis) efficient to answer.

The existing proposed schema already supports most of these queries well. The adjustments above are optimizations based on industry research.

---

## Proposed Schema Overview

### 1. Taxonomy (Reference Data - Normalized)
```sql
-- Core vehicle taxonomy
makes (id PK, name, created_at)
models (id PK, make_id FK, name, created_at)
part_types (id PK, part_key, part_name, part_category, ebay_category_id FK, 
           search_keywords, excluded_keywords, created_at)
condition_grades (id PK, grade_key, display_name, sort_order, 
                 price_adjustment_pct, description, created_at)

-- Alias tables for data ingestion/normalization (unchanged concept)
make_aliases (id PK, name, make_id FK)
model_aliases (id PK, name, model_id FK, make_id FK)
part_aliases (id PK, name, part_type_id FK)
ebay_condition_mappings (id PK, ebay_condition_id, ebay_condition_text, 
                         condition_grade_id FK, match_priority)
ebay_categories (id PK, name, parent_id FK - self-referential)
```

### 2. Business Entities

**yards** (Simplified - replaces yard_configs concept)
```sql
yards (
  id PK,
  name,
  location_city,
  location_state,
  created_at,
  updated_at
)
```

**vehicles** (The "Car Instance")
```sql
vehicles (
  id PK,
  yard_id FK → yards.id,                    -- This car lives in this yard
  make_id FK → makes.id,
  model_id FK → models.id,
  year integer NOT NULL,
  vin varchar UNIQUE,                        -- Critical business identifier
  mileage integer,
  purchase_date date,
  purchase_price numeric,
  auction_platform varchar,                  -- Copart, IAAI, Manheim, etc.
  lot_number varchar,
  damage_type varchar,
  condition_notes text,
  status varchar NOT NULL,                   -- purchased, on_yard, dismantled, sold, scrapped
  created_at timestamp,
  updated_at timestamp
)
```

**parts** (The "Part Instance" - renamed from `inventories`)
```sql
parts (
  id PK,
  vehicle_id FK → vehicles.id,              -- CRITICAL: This part came from THIS car
  part_type_id FK → part_types.id,
  condition_grade_id FK → condition_grades.id,
  quantity integer DEFAULT 1 NOT NULL,
  location_notes text,                       -- Specific bin, shelf, or area in yard
  listed_price numeric,
  status varchar NOT NULL,                   -- in_inventory, listed, sold, removed
  notes text,
  created_at timestamp,
  updated_at timestamp
)
```

### 3. Sales & Market Data

**sales** (Unified sales history - replaces/enhances `yard_sales`)
```sql
sales (
  id PK,
  part_id FK → parts.id,                     -- Link to specific part instance when available
  vehicle_id FK → vehicles.id,               -- Context: which car it came from
  part_type_id FK → part_types.id,           -- For market data without specific part
  sold_price numeric NOT NULL,
  sold_date date NOT NULL,
  platform varchar NOT NULL,                 -- 'yard', 'ebay', 'other'
  ebay_item_id varchar,                      -- If from eBay
  condition_grade_id FK → condition_grades.id,
  margin_pct numeric,                        -- Can be calculated on insert
  raw_json jsonb,                            -- Preserve original data
  created_at timestamp
)
```

**ebay_sold_listings** (Market comps - updated relationships)
```sql
ebay_sold_listings (
  id PK,
  make_id FK → makes.id,                     -- Changed from vehicle_profile_id
  model_id FK → models.id,
  part_type_id FK → part_types.id,
  year_range varchar,                        -- e.g. "2018-2022" or specific year
  ebay_item_id text NOT NULL,
  title text NOT NULL,
  sale_price numeric NOT NULL,
  date_sold date NOT NULL,
  condition_raw text,
  condition_grade_id FK → condition_grades.id,
  image_url text,
  listing_url text,
  raw_json jsonb NOT NULL,
  collected_at timestamp NOT NULL
)
```

**salvage_auctions** (Incoming opportunities)
```sql
salvage_auctions (
  id PK,
  make_id FK,
  model_id FK,
  year integer,
  vin varchar,
  lot_number varchar,
  auction_platform varchar NOT NULL,
  auction_date date NOT NULL,
  asking_price numeric,
  mileage integer,
  damage_type varchar,
  condition_notes text,
  image_url text,
  status varchar NOT NULL,                   -- upcoming, won, lost, passed
  created_at timestamp
)
```

### 4. Users & Access
```sql
users (id PK, cognito_sub, email, created_at)
user_yard_access (                        -- Renamed from user_yards for clarity
  user_id FK → users.id,
  yard_id FK → yards.id,
  created_at timestamp,
  PRIMARY KEY (user_id, yard_id)
)
```

---

## Key Relationships (Now Explicit & Clear)

1. **Yard → Vehicle → Part** (Core physical flow):
   - `yards.id` → `vehicles.yard_id` (1:M)
   - `vehicles.id` → `parts.vehicle_id` (1:M) **← This is the most important relationship**

2. **Taxonomy**:
   - `makes.id` → `models.make_id`
   - `makes.id` → `vehicles.make_id`, `ebay_sold_listings.make_id`, `salvage_auctions.make_id`
   - `models.id` → `vehicles.model_id`, `ebay_sold_listings.model_id`
   - `part_types.id` → `parts.part_type_id`, `sales.part_type_id`, `ebay_sold_listings.part_type_id`

3. **Condition & Sales**:
   - `condition_grades.id` → `parts.condition_grade_id`, `sales.condition_grade_id`, `ebay_sold_listings.condition_grade_id`
   - `parts.id` → `sales.part_id` (when we know the specific part sold)

4. **Market Data**:
   - `ebay_sold_listings` now joins cleanly to taxonomy for analysis
   - `sales` provides internal historical performance
   - Both can be used together for pricing intelligence

---

## Why This Is Better

- **Clear "Instance" semantics**: `vehicles` = car instances, `parts` = part instances. No more ambiguous `vehicle_profiles`.
- **Strong relationships**: Every part explicitly knows which vehicle it came from (`parts.vehicle_id`).
- **Physical reality modeled**: Yard → Vehicle → Parts → Sales is a clear hierarchy.
- **Normalized taxonomy**: Makes, models, part types are proper reference tables.
- **Market data is first-class**: `ebay_sold_listings` and `sales` are clearly related but distinct (internal sales vs external market comps).
- **No more hub table**: Removed the `vehicle_profiles` star schema pattern.

## Migration Considerations (High Level)

- `vehicles` table would need to be backfilled from current `vehicles` + `vehicle_profiles` join.
- `parts` table would be migrated from `inventories`.
- `sales` table would combine `yard_sales` with references to new `parts` table.
- `ebay_sold_listings` would need `make_id`/`model_id` populated from current `vehicle_profile_id` joins.
- Alias tables remain valuable for ingesting messy auction/EBay data.

This proposal gives you clean FK relationships while matching your mental model of car instances and part instances.

---

**Do you want me to:**
1. Refine any specific table/relationship?
2. Add more detailed column definitions or constraints?
3. Create SQL DDL for this schema?
4. Adjust the balance between normalization and practicality?

Let me know where to iterate.
