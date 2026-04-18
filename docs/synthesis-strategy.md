# Phase 3 Synthesis Strategy

**Based on analysis of the 99 real `paid_ebay` records in `grok_sold_listings`**

## Current Real Data Characteristics

### Limitations Identified:
- **Vehicle Make**: 100% Honda (limited diversity)
- **Sale Dates**: All 99 records sold on **2026-03-25** (no aging patterns)
- **Condition Data**: Missing (`condition_raw` is empty for all records)
- **Part Mix**: Heavily skewed toward fuel system components:
  - Fuel Injectors: 24 records
  - Fuel Pump: 23 records  
  - Headlights: 21 records
  - Fuel Tank: 14 records
- **Price Distribution**: Realistic range ($16–$700, average $169, median $142)
- **Part Types**: Only 8 distinct part types represented

### Positive Aspects:
- Reasonable price distribution with good variance (stddev: $151)
- Price quartiles look realistic (Q1: $42, Median: $142, Q3: $245, P90: $372)
- Part pricing varies appropriately by type (Headlights average $338, Fuel Pumps $97)

## Synthesis Strategy for 101 Additional Profiles

### 1. Vehicle Profile Distribution (Target: 200 Total)
**Current**: 99 Honda-focused profiles
**Target Mix**:
- **Trucks (40%)**: Silverado, Ram, F-150, Tacoma (heavy emphasis as per docs)
- **Hondas (20%)**: Civic, Accord, CR-V (build on existing real data)
- **Toyotas (20%)**: Camry, Corolla, RAV4, Tacoma
- **Jeeps (10%)**: Wrangler, Grand Cherokee
- **Other Popular (10%)**: Ford Mustang, BMW 3-series, Tesla Model 3

**Year Distribution**: 2016–2026 with higher concentration in recent years (2020-2026)

### 2. Part Type Strategy
**Expand beyond fuel system parts** to create realistic vehicle inventories:
- **High Frequency**: Headlights, Control Arms, Oxygen Sensors, Catalytic Converters, Bumpers
- **Medium Frequency**: Radiators, AC Compressors, Alternators, Starters, Brake Calipers
- **Specialized**: Transmission assemblies, Engine components, Body panels, Interior parts
- **Target**: 8–15 major sellable parts per vehicle profile

### 3. Pricing Strategy
- Use the real data quartiles as templates: 25th percentile ~$42, median ~$142, 75th ~$245
- Adjust by part type and vehicle popularity (trucks command premium pricing)
- Add realistic variance (stddev ~$150) to avoid artificial uniformity
- Seasonal pricing adjustments (higher in spring/summer for certain parts)

### 4. Temporal & Aging Strategy
- **Diverse sale dates**: Spread across 2024–2026 to create realistic aging patterns
- **Velocity patterns**: Mix of fast movers (<30 days) and slow movers (>90 days)
- **Acquisition dates**: Varied purchase/auction dates with logical relationship to sale dates
- **Long tail**: Some parts should show realistic slow-moving inventory (6+ months)

### 5. Condition & Status Strategy
- **Condition distribution**: Used (50%), Pre-Owned (25%), Parts Only (15%), Remanufactured (10%)
- **Vehicle status**: Mix of `dismantled`, `in_yard`, `scrapped`, `sold_whole`
- **Part status**: Primarily `in_inventory`, with some `listed` and `sold`

### 6. Location Strategy
- Generate realistic yard layout (Rows A-E, multiple shelves per row)
- Distribute parts logically (high-turnover parts in easily accessible locations)
- Maintain capacity constraints (10 parts per location)

### 7. Data Source & Confidence
- **Real records**: `data_source = 'paid_ebay'`, `confidence_score = 1.0`
- **Synthesized records**: `data_source = 'synthesized_research'`, `confidence_score = 0.7-0.9`

## Implementation Approach

1. **Profile Generation**: Create 101 distinct vehicle profiles with realistic specifications
2. **Statistical Templates**: Use real data patterns but expand diversity
3. **Batch Synthesis**: Generate data in logical batches (by vehicle profile, then parts, then sales)
4. **Validation**: Run realism checks against `docs/db-todo.md` criteria after synthesis
5. **Iteration**: Refine based on validation results

## Next Steps

- [ ] Define specific 101 vehicle profiles with characteristics
- [ ] Build synthesis functions that can generate realistic data at scale
- [ ] Implement temporal field generation with realistic distributions
- [ ] Create validation queries to ensure data quality
- [ ] Generate the full dataset while maintaining referential integrity

**This strategy ensures the synthesized data will be realistic, diverse, and useful for the Recycle AI system's user stories while building upon the real foundation established in Phase 2.**

*Document updated: 2026-04-14*