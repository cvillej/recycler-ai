---
title: Business Model
tags: [obsidian, recycle-ai, business-model]
aliases: [Profit Model]
status: stable
published: true
created: 2026-04-12
updated: 2026-04-12
---
# Business Model

## Overview
Chat app for salvage yard owners to maximize profit from auction cars, part sales, inventory.

## Purpose
Benefit salvage yard owners by projecting/optimizing profit using AI (auctions, parts valuation, inventory).

## Key Concepts
- Profit equation: sales + scrap - costs (auction/transport/listing/shipping/storage/pulling).
- Car value: projected (auction decision), actual full/partial (post-sale).
- Part value: Past yard sales, eBay market data.
- Data: auction_history, parts (id/name/type/condition/location/sold), cars (make/model/year), market research.

## Implementation Details
Basic model:
```
profit = (total part sales + scrap value) - (auction price + transport + auction fees + listing/shipping/storage/pull costs)
```
Auction decision: Desirable cars (typical purchases, profitable projection).

Inventory: Auction-purchased cars + pulled parts tied to car.

## Related Topics
- [[Tool Layer]] (queryDb for inventory/auctions)
- [[Agent State]] (toolResults for market data)
- [[Prompt System]] (profit projection prompts)

## For Agents
Start at docs/Home.md, follow [[wikilinks]]. Use template exactly, <200 lines.

## Backlinks
Auto-generated.

## Missing Information and Analysis
- **Data Schema/ERD**: Full relations (auction_history.car_id → parts.car_id, parts.ebay_market_data).
- **Prompt Contracts**: classify_intent for auction queries, plan_query for profit projection, execute_tool_reasoning for eBay API.
- **App Monetization**: Freemium (basic projections free, advanced inventory AI paid)? Per-yard subscription?
- **Integrations**: eBay/Copart/IAAI APIs for market/auction data (Tool Layer).
- **User Stories**: "Project profit for VIN at auction?" "Value parts on this car?" "Track inventory sales vs projected?"
- **Scalability**: Multi-yard support, real-time alerts, damage image analysis (future tools).
- **Risks**: Equation assumes perfect pulling/sales (add labor time, unsold parts risk).
