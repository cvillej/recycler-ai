# Database Migration & Enhancement Todo

**Last Updated:** April 13, 2026  
**Objective:** Create new normalized schema in `recycleai` schema, migrate from current `salvage` schema, augment with realistic synthesized data to reach exactly **200 vehicle profiles**, support all user stories from `user-stories.md`, and ensure the data feels authentic to a real yard operator (based on research into typical US salvage yard composition, part mix, aging distribution, and inventory depth).

**Key Decisions (from `db-analysis.md`, `db-proposal.md`, and your answers)**:
- New schema name: `recycleai` (completely separate from old `salvage`).
- Target: Exactly **200 vehicle profiles** (99 real paid + ~101 synthesized using research-based statistical pattern transfer).
- Rename `inventories` → `parts` (strong `parts.vehicle_id → vehicles.id` relationship — this is a core "part came from this specific car" link).
- Create new table `grok_sold_listings` (will contain both the 99 real paid records with `data_source = 'paid_ebay'` and synthesized records with `data_source = 'synthesized_research'`).
- Add `yard_locations` table for structured bin/shelf tracking (critical for "where is this part?" queries).
- Add temporal fields (`acquired_date`, `dismantled_date`, `listed_date`) to support aging reports and slow-mover analysis.
- Create supporting objects (views for valuation, functions for common queries, indexes for performance).
- Ensure data supports key user stories: auction valuation ("is this car worth buying?"), inventory visibility, location lookup, aging reports (PDF), profitability analysis, proactive alerts.
- Scope limited to **planning/migration level only** (no script writing or execution yet).
- Realism research incorporated: Typical yards are heavy on trucks (F-150, Silverado, Ram), Hondas, Toyotas, Jeeps. Expect 8–15 major sellable parts per vehicle. Most inventory turns in 65–91 days with a realistic long tail of slow movers. Part mix should favor mechanicals, body panels, wheels/tires, and high-theft items like catalytic converters.

**Order is critical**: Planning → new schema creation → migration of real data → realistic augmentation/synthesis → validation. Dependencies are strict (cannot synthesize new profiles until real 99 are loaded as templates).

## Todo List

### Phase 0: Final Planning & Design (COMPLETED)

**All Phase 0 tasks have been completed.** Detailed deliverables are below and have been added to this file for reference.

**1. Complete Schema Design for `recycleai` Schema**

**Core Principles**:
- Normalized with strong, explicit FK relationships.
- `vehicles` = car instances (bought at auction, lives in yard).
- `parts` = part instances (came from a specific `vehicle`, has location, can be sold).
- `grok_sold_listings` = unified market data (paid real records + synthesized research records).
- All tables have `created_at`, `updated_at`, `data_source`, `confidence_score` (for synthesized data), and audit fields where appropriate.
- Indexes on high-query fields (profile lookups, aging, valuation, location).

**Main Tables** (with columns, types, constraints):

**`recycleai.makes`**
- `id` (SERIAL PRIMARY KEY)
- `name` (TEXT NOT NULL)
- `created_at` (TIMESTAMPTZ DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ DEFAULT NOW())

**`recycleai.models`**
- `id` (SERIAL PRIMARY KEY)
- `make_id` (INT NOT NULL REFERENCES makes(id))
- `name` (TEXT NOT NULL)
- `created_at`, `updated_at`

**`recycleai.part_types`**
- `id` (SERIAL PRIMARY KEY)
- `part_key` (TEXT NOT NULL UNIQUE)
- `part_name` (TEXT NOT NULL)
- `part_category` (TEXT NOT NULL)
- `ebay_category_id` (TEXT REFERENCES ebay_categories(id))
- `search_keywords`, `excluded_keywords` (TEXT)
- `created_at`, `updated_at`

**`recycleai.condition_grades`**
- `id` (SERIAL PRIMARY KEY)
- `grade_key` (TEXT NOT NULL UNIQUE)
- `display_name` (TEXT NOT NULL)
- `sort_order` (INT NOT NULL)
- `price_adjustment_pct` (NUMERIC)
- `description` (TEXT)
- `created_at`, `updated_at`

**`recycleai.vehicles`** (Car Instance)
- `id` (SERIAL PRIMARY KEY)
- `yard_id` (INT NOT NULL)
- `make_id` (INT NOT NULL REFERENCES makes(id))
- `model_id` (INT NOT NULL REFERENCES models(id))
- `year` (INT NOT NULL)
- `vin` (VARCHAR(17) UNIQUE)
- `mileage` (INT)
- `purchase_date` (DATE)
- `purchase_price` (NUMERIC)
- `auction_platform` (TEXT)
- `lot_number` (TEXT)
- `damage_type` (TEXT)
- `condition_notes` (TEXT)
- `status` (TEXT NOT NULL) — e.g. 'purchased', 'on_yard', 'dismantled', 'sold'
- `acquired_date` (TIMESTAMPTZ)
- `dismantled_date` (TIMESTAMPTZ)
- `estimated_part_out_value` (NUMERIC) — cached for fast queries
- `created_at`, `updated_at`, `data_source` (TEXT DEFAULT 'migrated')

**`recycleai.parts`** (Part Instance — renamed from inventories)
- `id` (SERIAL PRIMARY KEY)
- `vehicle_id` (INT NOT NULL REFERENCES vehicles(id)) — **critical FK**
- `part_type_id` (INT NOT NULL REFERENCES part_types(id))
- `condition_grade_id` (INT REFERENCES condition_grades(id))
- `quantity` (INT DEFAULT 1 NOT NULL)
- `location_id` (INT REFERENCES yard_locations(id))
- `listed_price` (NUMERIC)
- `status` (TEXT NOT NULL) — 'in_inventory', 'listed', 'sold', 'removed'
- `acquired_date` (TIMESTAMPTZ)
- `listed_date` (TIMESTAMPTZ)
- `notes` (TEXT)
- `created_at`, `updated_at`, `data_source` (TEXT DEFAULT 'migrated')

**`recycleai.grok_sold_listings`** (Unified market data)
- `id` (SERIAL PRIMARY KEY)
- `make_id` (INT REFERENCES makes(id))
- `model_id` (INT REFERENCES models(id))
- `part_type_id` (INT REFERENCES part_types(id))
- `year_range` (TEXT)
- `ebay_item_id` (TEXT)
- `title` (TEXT NOT NULL)
- `sold_price` (NUMERIC NOT NULL)
- `date_sold` (DATE NOT NULL)
- `condition_raw` (TEXT)
- `condition_grade_id` (INT REFERENCES condition_grades(id))
- `image_url`, `listing_url` (TEXT)
- `raw_json` (JSONB)
- `collected_at` (TIMESTAMPTZ)
- `data_source` (TEXT NOT NULL) — 'paid_ebay' or 'synthesized_research'
- `confidence_score` (NUMERIC CHECK (confidence_score BETWEEN 0 AND 1)) — for synthesized data
- `created_at`

**`recycleai.yard_locations`**
- `id` (SERIAL PRIMARY KEY)
- `yard_id` (INT NOT NULL)
- `row_code` (TEXT NOT NULL)
- `bay` (INT)
- `shelf` (INT)
- `bin` (TEXT)
- `description` (TEXT)
- `capacity` (INT DEFAULT 10)
- `created_at`, `updated_at`

**`recycleai.sales`** (Unified sales history)
- `id` (SERIAL PRIMARY KEY)
- `part_id` (INT REFERENCES parts(id))
- `vehicle_id` (INT REFERENCES vehicles(id))
- `part_type_id` (INT REFERENCES part_types(id))
- `sold_price` (NUMERIC NOT NULL)
- `sold_date` (DATE NOT NULL)
- `platform` (TEXT NOT NULL) — 'yard', 'ebay'
- `ebay_item_id` (TEXT)
- `condition_grade_id` (INT REFERENCES condition_grades(id))
- `margin_pct` (NUMERIC)
- `days_to_sell` (INT)
- `raw_json` (JSONB)
- `created_at`, `data_source`

(Additional tables like `salvage_auctions`, `users`, `user_yard_access`, alias tables, `ebay_categories`, `ebay_condition_mappings` follow similar normalized patterns with appropriate FKs and indexes.)

**Indexes** (key ones): `vehicles(make_id, model_id, year, status)`, `parts(vehicle_id, part_type_id, location_id, status, acquired_date)`, `grok_sold_listings(make_id, model_id, part_type_id, date_sold, data_source)`, `parts(location_id)`.

---

**2. Detailed Synthesis Rules for Additional ~101 Profiles (to reach 200 total)**

**Methodology**:
- **Pattern Transfer**: Use the 99 real paid profiles as statistical templates. Map similar vehicles (F-150 → Silverado/Ram, Civic → Corolla/Altima).
- **Research Grounding**: Use public Copart/IAAI summaries, LKQ trends, NADA residual values, and industry reports for pricing and demand.
- **Rules for Realism**:
  - Date range: Match real data (2016–2026), with higher volume in recent years.
  - Price variance: Not uniform. Hot parts (catalytic converters, wheels) have higher variance. Slow parts have longer tails.
  - Volume weighting: Popular trucks get 3–5x more records than niche vehicles.
  - Condition mix: Mirror real data (mostly Good/Fair, realistic % Damaged/For Parts).
  - Part popularity: Favor mechanicals, body panels, wheels/tires, electronics based on real sales frequency.
  - Aging: Most sales within 65–91 days, with realistic long tail (>90/180 days).

**Additional Profiles** (high priority, research-based):
- Chevrolet Silverado 1500 (multiple years)
- Ram 1500/2500
- Honda Civic (full year range)
- Toyota Tacoma (high residual value)
- Jeep Wrangler / Grand Cherokee
- Honda CR-V (expanded years)
- Toyota RAV4 / Corolla
- Nissan Altima / Rogue
- BMW 3 Series
- Subaru Outback / Forester
- GMC Sierra, Ford Explorer, Chevrolet Equinox, Hyundai Sonata, Tesla Model 3 (for modern coverage)

**Example Synthesized Pricing** (major parts):
- Ford F-150/Silverado: Engine $1,600–$3,200 | Transmission $1,100–$2,100 | Door $400–$850
- Honda Civic: Engine $850–$1,650 | Transmission $650–$1,200 | Catalytic Converter $180–$450
- Toyota Tacoma: Engine $1,400–$2,600 (holds value very well)

Scale: ~1,500–4,000 records per new profile (total ~200k–400k new records in `grok_sold_listings`).

---

**3. Realism Validation Criteria & Yard Composition Research**

**Typical Real Yard Composition** (from research):
- **Scale**: Medium-large yard = hundreds to low thousands of vehicles.
- **Common Vehicles**: Heavy on trucks (F-150, Silverado, Ram), Hondas (Civic, Accord, CR-V), Toyotas (Camry, Tacoma, RAV4), Jeeps, Nissan Altima/Rogue, BMW 3 Series.
- **Parts per Vehicle**: 8–15 major sellable parts (engines, transmissions, body panels, doors, wheels/tires, electronics, catalytic converters).
- **Aging**: Average turnover 65–91 days; significant long tail (>90/180 days) of slow movers.
- **Part Mix**: High-value mechanicals and body parts dominate; catalytic converters frequently stolen.

**Validation Criteria** (queries that must feel real):
- Auction valuation: "Part-out value" estimates should be believable vs purchase price.
- Inventory: "Do we have [model]?" returns reasonable counts with varied conditions.
- Location: "Where is this part?" returns specific, structured locations.
- Aging: Reports show realistic distribution (most <90 days, clear slow-mover tail).
- Profitability: Pricing aligns with real comps; margins make sense for high-volume parts.
- Overall: Data should not look artificially uniform; should have logical variance.

---

**4. Detailed Migration Plan & Dependencies**

**Ordered Steps**:
1. Create `recycleai` schema + all tables/indexes/views (Phase 1).
2. Migrate taxonomy, users, and the 99 real `ebay_sold_listings` records into `grok_sold_listings` (Phase 2).
3. Migrate `vehicles`, rename/migrate `inventories` → `parts`, migrate `yard_sales`/`salvage_auctions` with new FKs and fields.
4. Synthesize additional 101 profiles + data in `grok_sold_listings`, `vehicles`, `parts`, `yard_sales`, `salvage_auctions`, `yard_locations` (Phase 3).
5. Validate realism and create supporting documentation (Phase 4–5).

**Critical Dependencies**:
- Schema must exist before migration.
- Real 99 profiles must be in `grok_sold_listings` before synthesis (used as templates).
- Temporal and location data must be populated before aging and location queries can be validated.

**Phase 0 is now complete.** All detailed design, rules, criteria, and the migration plan are documented above and in this file.

### Phase 1: Create New Schema (`recycleai`)
- [ ] Create the new `recycleai` schema (completely separate from old `salvage`)
- [ ] Create all new tables with proper constraints, PKs, FKs (`vehicles`, `parts`, `grok_sold_listings`, `yard_locations`, `sales`, `makes`, `models`, `part_types`, `condition_grades`, updated `yard_sales`, `salvage_auctions`, taxonomy/alias tables, supporting tables)
- [ ] Define and create indexes optimized for key user story queries (auction valuation/part-out calculations, aging/slow-mover reports, location lookup, profitability by model/part)
- [ ] Define views, functions, or materialized views for common operations (estimated part-out value, aging calculations, top valuable parts, inventory visibility, slow movers)
- [ ] Add all foreign key constraints, check constraints, and any triggers needed for data integrity

### Phase 2: Migrate Existing Real Data (from `salvage` to `recycleai`)
- [ ] Migrate core taxonomy tables (`makes`, `models`, `part_types`, `condition_grades`, `ebay_categories`, `ebay_condition_mappings`, alias tables)
- [ ] Migrate `users`, `user_yard_access` (or equivalent), and any yard-related configuration data
- [ ] Migrate/copy the 99 real paid records from `ebay_sold_listings` into the new `grok_sold_listings` table with `data_source = 'paid_ebay'`
- [ ] Migrate existing `vehicles` data into new schema (populate new temporal fields with reasonable values based on research)
- [ ] Migrate/rename data from `inventories` to new `parts` table (map all columns, generate realistic `acquired_date`, `location_id`, and other new fields)
- [ ] Migrate existing `yard_sales` and `salvage_auctions` with updated foreign keys and relationships to the new schema

### Phase 3: Augment with Realistic Synthesized Data (to reach exactly 200 profiles)
- [ ] Research and finalize list of additional ~101 profiles to reach exactly 200 total (heavy on trucks like Silverado/Ram, Hondas, Toyotas, Jeeps, with realistic part mix and aging distribution based on industry data)
- [ ] Synthesize records in `grok_sold_listings` for the new profiles using statistical pattern transfer from the real 99 + public research (target ~200k–400k new records with realistic price distributions, velocity, and condition mix)
- [ ] Generate realistic `vehicles` records at the scale needed for 200 profiles (varied status, mileage 20k–250k, damage types, purchase/auction details)
- [ ] Generate `parts` records (target 8–15 major sellable parts per vehicle on average, realistic condition distribution, structured `yard_locations`, pricing aligned with market comps)
- [ ] Generate/expand `yard_sales` with realistic sales velocity (fast movers vs slow movers to create believable aging patterns)
- [ ] Generate realistic upcoming `salvage_auctions` that map to both real and synthesized profiles (mix of high-potential and marginal vehicles)
- [ ] Populate `yard_locations` table with realistic yard layout and link all `parts` records to specific locations
- [ ] Backfill all temporal fields (`acquired_date`, `dismantled_date`, `listed_date`) with realistic distributions (most recent, with long tail for slow movers)
- [ ] Generate any cached valuation data, supporting analytical records, or materialized views needed for user stories

### Phase 4: Validation, Polish & Optimization (Planning Level)
- [ ] Define and document key user story validation queries (from `user-stories.md`) that must return realistic results in the new `recycleai` schema (auction valuation/part-out estimates, inventory visibility by model, location lookup, aging/slow-mover reports with realistic long tail, profitability analysis, most valuable parts)
- [ ] Define realism acceptance criteria for a yard operator (part mix, pricing alignment with real comps, logical aging distribution with 65–91 day average turnover and long tail, inventory depth per profile, believable auction opportunities)
- [ ] Plan PDF report templates, alert/notification prototypes, dashboard views, and KPI monitoring queries needed for the top user stories
- [ ] Plan performance optimizations (indexes, materialized views or functions for valuation, aging, and high-frequency queries)
- [ ] Plan data lineage documentation (clear separation between the original 99 paid records and the ~101 synthesized research-based records in `grok_sold_listings`)
- [ ] Create high-level migration/regeneration plan document (still at planning level only)

### Phase 5: Documentation & Future-Proofing (Planning Level)
- [ ] Update `db-analysis.md`, `db-proposal.md`, `user-stories.md`, `Home.md`, and any other related docs with final decisions (`recycleai` schema, exactly 200 profiles, `grok_sold_listings` approach, realism methodology, research-based profile list)
- [ ] Document how future data refreshes would work (adding new auction data, new sales comps, expanding beyond 200 profiles)
- [ ] Define monitoring queries for key industry KPIs (inventory turnover target <90 days, acquisition cost ratio, aging inventory value, margin by model/part type)
- [ ] Outline future integration points at planning level (real auction APIs, SMS/email alerting system, PDF generation service, Hollander interchange if desired)

**Total estimated effort**: Significant but broken into clear, ordered phases with strict dependencies. The critical path is:

**Planning → Create `recycleai` schema → Migrate real data from `salvage` → Synthesize additional data to reach exactly 200 profiles → Validation of realism against user stories**.

This `db-todo.md` serves as our master checklist while remaining strictly at the **planning/migration level only** (no script writing or execution).
