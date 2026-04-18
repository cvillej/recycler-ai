# Phase 3: 101 Additional Vehicle Profiles

**Target**: 200 total profiles (99 existing real Honda-focused + 101 new synthesized profiles)

**Distribution Strategy** (as defined in `docs/synthesis-strategy.md`):
- **40% Trucks** (40 profiles) - Heavy emphasis per documentation
- **20% Honda** (20 profiles) - Building on existing real data
- **20% Toyota** (20 profiles) - Popular imports
- **10% Jeep** (10 profiles) - Off-road/utility focus
- **10% Other** (11 profiles) - Mix of popular vehicles

---

## 1. Truck Profiles (40) - High Priority

### Full-Size Trucks (20):
**Ford F-150** (6 profiles):
- F-150 XLT (2018-2022)
- F-150 Lariat (2019-2023) 
- F-150 Raptor (2017-2021)
- F-150 Platinum (2020-2024)
- F-150 Lightning (2022-2024) - Electric
- F-150 Tremor (2021-2023)

**Chevrolet Silverado** (6 profiles):
- Silverado 1500 WT (2019-2023)
- Silverado 1500 LT (2018-2022)
- Silverado 1500 High Country (2020-2024)
- Silverado 2500 HD (2019-2023)
- Silverado 3500 HD (2020-2024)
- Silverado EV (2023-2024)

**Ram Trucks** (5 profiles):
- Ram 1500 Tradesman (2019-2023)
- Ram 1500 Laramie (2020-2024)
- Ram 2500 Big Horn (2019-2023)
- Ram 3500 Limited (2021-2024)
- Ram TRX (2021-2023)

**GMC Sierra** (3 profiles):
- Sierra 1500 SLE (2019-2023)
- Sierra 1500 Denali (2020-2024)
- Sierra 2500 AT4 (2022-2024)

### Midsize Trucks (10):
**Toyota Tacoma** (4 profiles):
- Tacoma SR (2018-2022)
- Tacoma TRD Off-Road (2019-2023)
- Tacoma TRD Sport (2020-2024)
- Tacoma Limited (2021-2023)

**Ford Ranger** (3 profiles):
- Ranger XL (2019-2023)
- Ranger Lariat (2020-2024)
- Ranger Raptor (2023-2024)

**Chevrolet Colorado** (3 profiles):
- Colorado WT (2018-2022)
- Colorado ZR2 (2019-2023)
- Colorado Trail Boss (2021-2024)

### Other Trucks (10):
**Jeep Gladiator** (3), **Nissan Frontier** (2), **Honda Ridgeline** (2), **Tesla Cybertruck** (2), **Rivian R1T** (1)

---

## 2. Honda Profiles (20) - Building on Real Data

**Civic** (6): LX, EX, Si, Type R, Hybrid, Touring (2016-2024)
**Accord** (5): LX, EX-L, Sport, Hybrid, Touring (2017-2024) 
**CR-V** (4): LX, EX, EX-L, Touring (2018-2024)
**Pilot** (3): LX, EX-L, Elite (2019-2024)
**Odyssey** (2): LX, EX-L (2018-2023)

---

## 3. Toyota Profiles (20)

**Camry** (5): LE, SE, XLE, TRD, Hybrid (2018-2024)
**Corolla** (4): LE, SE, XSE, Hybrid (2019-2024)
**RAV4** (4): LE, XLE, Adventure, Prime (2019-2024)
**Highlander** (3): LE, XLE, Limited (2020-2024)
**4Runner** (2): SR5, TRD Off-Road (2018-2023)
**Tundra** (2): SR, Limited (2022-2024)

---

## 4. Jeep Profiles (10)

**Wrangler** (4): Sport, Sahara, Rubicon, 4xe (2018-2024)
**Grand Cherokee** (3): Laredo, Limited, Summit (2019-2023)
**Wagoneer** (2): Series I, Series II (2022-2024)
**Gladiator** (1): Rubicon (2020-2023)

---

## 5. Other Popular Vehicles (11)

**Ford Mustang** (2), **BMW 3 Series** (2), **Mercedes C-Class** (1), 
**Tesla Model 3** (2), **Porsche 911** (1), **Subaru Outback** (1), 
**Mazda CX-5** (1), **Kia Telluride** (1)

---

## Profile Characteristics Template

Each profile should include:
- **Make/Model/Year Range**: Specific variants
- **Typical Parts**: 8-15 major sellable parts with realistic mix
- **Price Range**: Based on real data quartiles + vehicle type adjustment
- **Condition Mix**: Used (50%), Pre-Owned (25%), Parts Only (15%), Reman (10%)
- **Sales Velocity**: Mix of fast (<30 days) and slow (>90 days) movers
- **Part-out Potential**: Estimated value based on vehicle popularity
- **Yard Location Preferences**: High-turnover parts in accessible locations

## Next Steps for Synthesis

1. **Implement profile definitions** in code/synthesis logic
2. **Generate vehicle records** for each profile with realistic attributes
3. **Create corresponding parts inventory** (8-15 parts per vehicle)
4. **Generate sales history** with realistic aging patterns
5. **Create auction opportunities** that map to both real and synthetic profiles
6. **Validate statistical properties** against real data templates

**This profile list provides the foundation for realistic data synthesis while addressing the limitations identified in the real dataset analysis.**

*Document created: 2026-04-14 as part of Phase 3*