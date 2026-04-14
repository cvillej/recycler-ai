# User Stories & Feature Requirements

**Last Updated:** April 13, 2026  
**Research Sources:** Industry reports (Financial Models Lab, Auto Salvage Consultants), salvage yard software analysis (YardSmart, Dismantly, Hollander), owner feedback, KPI research, and competitive gap analysis.

This document captures **what salvage yard owners, dismantlers, and sales staff actually need**. It ranks features by business value (revenue impact > operational efficiency > risk reduction > nice-to-have). 

It is informed by:
- **Core Business Reality**: 80%+ gross margins come from fast-moving, high-value used parts. Slow inventory kills profitability. Auction buying decisions are make-or-break.
- **Pain Points** of existing tools: Poor real-time visibility, manual processes, disconnected systems, weak analytics, complex UIs for non-technical staff.
- **Opportunities**: Modern AI, mobile-first design, proactive intelligence, and beautiful reporting can create a significant competitive advantage.

**Link back to [[Home]]** (added to overview).

---

## Ranked User Stories & Features

### Priority 1: Auction Intelligence (Highest Value)
**As a yard owner**, I want intelligent auction recommendations so I only buy vehicles with strong part-out margins.

**Key Questions**:
- "Is this specific car (VIN/make/model/year) at auction valuable to us?"
- "What is the estimated part-out value vs purchase price + costs?"
- "Which high-demand parts would this vehicle yield?"

**Desired Output**:
- Mobile push + SMS/email alert: "Copart Lot #C-48219 (2021 Honda CR-V) — **Projected Margin: 68%** (High confidence). Top parts: Engine, Transmission."
- One-tap "Set Watch" that monitors the auction and notifies if price drops into profitable range.
- Visual dashboard showing breakdown by part type with market comps (our sales + eBay sold data).

**Differentiator**: AI-powered "Part-Out Value Estimator" using computer vision on auction photos + predictive demand modeling. Existing tools are mostly manual.

---

### Priority 2: Real-Time Inventory Visibility & Location
**As a sales person/dismantler**, I want to know instantly what we have and exactly where it is.

**Key Questions**:
- "Do we have any [Model X] on the yard? How many? What condition?"
- "Where is the transmission from VIN [ABC123]?"
- "What parts do we have from this specific vehicle?"

**Desired Output**:
- Mobile-first search with voice input ("Hey Recycler, where's the engine from that blue CR-V?").
- AR overlay (phone camera points at yard row → highlights exact bin/shelf).
- Digital "yard map" with heat maps showing inventory density and aging.

**Must-Have**: Structured `yard_locations` (row/bay/shelf) with barcode/QR support. Real-time sync between dismantlers and sales staff.

**Differentiator**: Voice + AR features. Most current software is desktop-only or clunky mobile.

---

### Priority 3: Aging & Slow-Mover Intelligence
**As a yard owner**, I want to know what inventory is killing my cash flow so I can take action (discount, bundle, scrap).

**Key Questions**:
- "What are our slowest moving parts/vehicles?"
- "What has been sitting >90/180 days? By value?"
- "Which models have the worst turnover?"

**Desired Output**:
- **PDF Report** (downloadable, printable, shareable with accountant): "Aging Inventory Report — Q2 2026" with charts, top 20 offenders, recommended actions (discount 30%, bundle with fast-movers, scrap).
- Proactive weekly email digest: "Warning: 47 parts aged >120 days tying up $18.4k."
- One-click "Create Bundle Sale" or "List on eBay" from the report.

**Differentiator**: Predictive "risk of becoming dead stock" score using ML on historical sales velocity, seasonality, and regional demand.

---

### Priority 4: Pricing & Profitability Intelligence
**As a yard owner/sales manager**, I want data-driven pricing and profitability insights.

**Key Questions**:
- "What are our most valuable parts right now?"
- "How does our pricing compare to eBay sold comps?"
- "Which models/parts give us the best margins?"

**Desired Output**:
- Real-time "Top 50 Most Valuable Parts" dashboard with current listed price vs recent sale comps.
- Dynamic pricing suggestions ("Raise price on these 12 transmissions by 18% based on demand").
- Monthly PDF "Profitability Report" by make/model/part category.

**Differentiator**: AI dynamic pricing engine that learns from our sales + external market data. Integration with eBay/Facebook Marketplace for automated listing optimization.

---

### Priority 5: Proactive Alerts & Notifications
**As a yard owner**, I want the system to tell me what I need to know without constant checking.

**Examples**:
- Auction alerts (as described in Priority 1).
- "Low stock on high-demand part: 2018-2022 Honda CR-V transmissions (only 2 left, selling 3/month)."
- "Slow mover alert: 14 engines aged >150 days — recommended action: 40% discount bundle."
- End-of-day summary SMS: "Today: 7 sales ($4,280), 3 new vehicles acquired."

**Desired Output**: Configurable notification preferences (SMS for urgent, email digest for reports, in-app for everything else). Avoid notification fatigue with smart batching.

**Differentiator**: Context-aware "AI Yard Assistant" that learns owner preferences over time.

---

### Priority 6: Workflow Automation & Mobile-First Operations
**As a dismantler**, I want fast, mobile tools that reduce paperwork.

**Features**:
- Photo → AI part identification and condition grading on intake.
- Voice logging while working ("Engine from VIN 1234, excellent condition, bin A-12").
- Digital dismantle checklists with Hollander-style interchange suggestions.
- One-tap "Mark as Sold" with automatic inventory update and sales record creation.

**Must-Have**: Fully functional offline mobile app that syncs when back in coverage.

---

### Additional High-Value Differentiators (Outside the Box)

**7. Predictive Sourcing Recommendations**
- "Based on current inventory gaps and market trends, you should target these 5 vehicles at auction this week."

**8. Competitive Intelligence**
- Monitor what similar parts are selling for on eBay/Facebook Marketplace in your region.

**9. Sustainability & Compliance Dashboard**
- Automatic carbon impact reporting ("Your yard diverted X tons from landfill this month").
- One-click regulatory report generation (VIN compliance, scrap reporting).

**10. Customer-Facing Features**
- Public "Live Yard Inventory" microsite showing what’s available (drives foot traffic).
- Customer portal for reservations or "notify me when available."

**11. Smart Bundling Engine**
- AI suggests profitable part bundles ("Customer buying transmission? Offer matching torque converter at 15% discount — we have 4 aging in inventory").

**12. Financial Integration**
- Automatic export to QuickBooks with proper COGS allocation per vehicle.
- "Vehicle ROI Report" showing profit per car dismantled.

---

## Must-Haves vs True Differentiators

**Must-Haves** (Table Stakes):
- Real-time inventory with location tracking
- Strong auction valuation tools
- Aging/slow-mover reports (PDF + alerts)
- Mobile-first design with offline support
- Clean integration between vehicles → parts → sales
- Basic compliance reporting

**True Differentiators** (What makes this app superior):
- Proactive AI intelligence (doesn't just answer questions — anticipates them)
- Beautiful, actionable reporting (PDFs that look professional)
- Smart notification system that respects user attention
- Computer vision + voice interfaces for yard workers
- Predictive analytics for buying and pricing
- Seamless auction monitoring + alerting
- Sustainability angle (increasingly important)

---

## Next Steps Recommendations

1. Implement core schema from `db-proposal.md` with the enhancements noted there (temporal fields, structured locations, valuation support).
2. Prioritize mobile app experience (this is a major gap in many existing tools).
3. Build the "AI Yard Assistant" as the unifying interface.
4. Start with auction intelligence and aging reports — these have the highest ROI.

**Links**:
- [[Home]] (Overview)
- [[db-proposal]]
- [[business-model]]
- [[DevOps-Deployment]]

This document should evolve as we validate with real yard owners.
