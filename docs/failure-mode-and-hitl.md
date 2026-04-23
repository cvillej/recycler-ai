# failure-mode-and-hitl.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

This document defines how the AI Yard Assistant handles failures, partial information, and Human-In-The-Loop (HITL) scenarios. It ensures the system remains robust, transparent, and safe even when things go wrong.

## Purpose of Failure Mode and HITL Handling

The AI Yard Assistant operates in a complex, real-world environment with many potential points of failure:

- Entity resolution ambiguity
- Tool execution failures (rate limits, API errors, timeouts)
- Incomplete or stale external data
- Ambiguous user intent
- High-stakes decisions (bidding, pricing, inventory actions)

This document defines how the system detects, handles, and recovers from these situations while maintaining user trust and safety.

## Core Principles

1. **Graceful Degradation** — The system should never completely fail. It should always provide the best possible partial answer or action.
2. **Transparency** — The user should understand when the agent is uncertain or has encountered a problem.
3. **Safety First** — High-impact actions (bidding, pricing changes, inventory modifications) should require explicit user approval when confidence is low.
4. **Learn from Failures** — Every failure is logged and used to improve future behavior.
5. **Human-in-the-Loop as a Feature** — HITL is not a fallback — it is a deliberate design pattern for high-value decisions.

## Entity Resolution Failures

Entity resolution is one of the most common failure points.

**Failure Modes:**
- Multiple matching entities (e.g., "the Honda" could refer to several vehicles)
- No matching entities
- Ambiguous references ("that part", "the one from last week")
- Stale entity data

**Handling Strategy:**

1. **Confidence Scoring** — Every entity resolution includes a confidence score (0.0–1.0).
2. **Clarification Prompts** — If confidence < 0.7, the agent asks the user for clarification before proceeding.
3. **Partial Resolution** — If some entities are resolved but others are not, the agent proceeds with what it has and explicitly states assumptions.
4. **Fallback to Search** — If resolution fails completely, the agent offers to search or list options.

**Example Response:**
> "I found three Hondas in your inventory. Did you mean the 2019 CR-V (Stock #2847), the 2021 Civic (Stock #2912), or the 2018 Pilot (Stock #2671)?"

### Canonical ID Required Tools — Mandatory Clarification Gate

Some tools **require** a canonical ID and cannot safely operate on ambiguous or fuzzy references. These tools include (but are not limited to):

- `get_part_details`
- `update_inventory_location`
- `create_valuation`
- `place_bid`
- `mark_part_sold`
- `transfer_part`
- `create_work_order`

**Rule:** If the user requests an action that requires a canonical ID and entity resolution fails or returns low confidence (< 0.85), the system **must not** call the tool. Instead, it must enter a **Mandatory Clarification Gate**.

**Flow:**

1. Detect that the requested tool requires a canonical ID.
2. Entity Resolver returns no match, multiple matches, or low confidence.
3. System pauses execution (does not call the tool).
4. Agent presents the top matching candidates (maximum 3) with key details and confidence scores.
5. User must explicitly select one option (A, B, C, or "None of these / Create new").
6. Only after user selection is the canonical ID stored in `resolvedEntities` and the tool is called.

**Example Response:**

> "Before I can update the inventory location, I need to confirm which part you're referring to.  
> 
> I found these possible matches:  
> 
> A) 2019 Honda CR-V Transmission (Stock #2847-ENG-01) — 92% confidence  
> B) 2018 Honda CR-V Engine (Stock #2671-ENG-03) — 67% confidence  
> C) None of these / Create new part  
> 
> Please reply with A, B, or C."

This gate is **non-negotiable** for any tool that requires a canonical ID. It protects against incorrect actions on the wrong part or vehicle.

## Tool Execution Failures

Tools can fail for many reasons: rate limits, API errors, network issues, authentication problems, or invalid inputs.

**Handling Strategy:**

1. **Retry with Backoff** — Transient errors are retried automatically (exponential backoff).
2. **Graceful Degradation** — If a tool fails, the agent continues with the best available information and explicitly notes the limitation.
3. **Alternative Tools** — If the primary tool fails, the agent may fall back to a secondary tool or cached data.
4. **User Notification** — For persistent failures, the agent informs the user and offers alternatives.

**Example Response:**
> "I tried to fetch the latest Copart auction data but encountered a temporary API issue. I can use cached data from 15 minutes ago or wait and retry. Would you like me to proceed with the cached data?"

## Graceful Degradation Patterns

The system supports several graceful degradation patterns:

- **Partial Answers** — Provide the best available information even if incomplete.
- **Assumption-Based Responses** — State assumptions clearly and allow the user to correct them.
- **Deferred Actions** — For high-impact actions, defer execution until user confirmation.
- **Read-Only Mode** — When write operations fail, fall back to read-only analysis and recommendations.

## Human-In-The-Loop (HITL) Patterns

HITL is used strategically for high-stakes or ambiguous situations.

**HITL Triggers:**
- Low confidence entity resolution (< 0.7)
- High-impact actions (bidding above threshold, pricing changes, inventory modifications)
- Ambiguous user intent
- External system failures affecting critical data
- User explicitly requests confirmation

**HITL Flow:**

1. Agent proposes an action or answer with confidence level and reasoning.
2. Agent presents options or asks for explicit approval.
3. User confirms, corrects, or cancels.
4. Agent executes the approved action and logs the decision.

**Example HITL Prompt:**
> "I recommend bidding $1,240 on the 2019 Honda CR-V (Stock #2847) based on current market comps. This is within your budget and has a 78% estimated win probability.  
> 
> Do you want me to:
> A) Place the bid now
> B) Wait for a lower price
> C) Adjust the max bid
> D) Cancel"

## Asynchronous Communication & Notifications

Not all important information requires immediate user attention. The system must support **asynchronous, non-blocking communication** for scenarios where the user needs to be informed but does not need to respond right away.

### HITL Categorization

We explicitly categorize HITL interactions into four types:

| Type                              | Blocking? | Delivery Channel                  | Example |
|-----------------------------------|-----------|-----------------------------------|---------|
| **Synchronous Blocking**          | Yes       | In-chat (immediate)               | "Should I bid $1,240 now?" |
| **Asynchronous Blocking**         | Yes       | Notification + in-chat            | Manager approval for large bid |
| **Asynchronous Non-blocking (Notifications)** | No | Notification (in-app / email / SMS / push) | "Auction for 2019 CR-V starts in 2 hours" |
| **Long-running Job Completion**   | No        | Notification when ready           | "Your 90-day profitability report is ready" |

This categorization allows the system to choose the right delivery mechanism and urgency level.

### External System Injections

When an external system (Copart, IAAI, inventory scanner, Stripe, eBay, etc.) injects important information:

- If the user is in an active relevant session (e.g. `auction_bidding_session`) → inject as a system message immediately.
- If the user is not active or the information is not urgent → queue as an **Asynchronous Non-blocking Notification**.
- Use `importance_score` and `labels` to determine urgency and delivery channel.

Example: A sudden high-value auction loss is injected with high `importance_score` → user receives a priority notification even if they are not currently chatting.

### Budget and Quota Warnings

When a user approaches or hits a budget/quota limit (token quota, bidding budget, daily alert limit):

- Show warning in current chat if active.
- Send **Asynchronous Non-blocking Notification** if user is offline or in another session.
- Optionally pause proactive features (e.g. `proactive_bidding`, `auction_alerts`) until budget is increased.
- Store warning in `structured_memory` so it surfaces on next relevant interaction.

### Long-Running Job Notifications

For operations that take time (report generation, bulk valuation, large data export):

1. Acknowledge immediately in-chat: "I'll generate that report in the background. You can keep working — I'll notify you when it's ready."
2. Kick off background job (tracked in a `background_jobs` table).
3. When complete → send **Long-running Job Completion** notification.
4. Store the result in `structured_memory` or as a retrievable artifact.

This allows the user to continue working on other tasks while the system handles heavy computation.

### Informational / "News" Updates

Some information is useful but not urgent (e.g. "A new 2020 Honda CR-V just arrived in your yard", "Market price for transmissions dropped 8% today").

- Delivered as **Asynchronous Non-blocking Notifications**.
- User can configure notification preferences (in-app badge only, email summary, SMS for high-priority only, etc.).
- Stored in `structured_memory` with `labels: ["informational", "news"]` so it can be surfaced contextually later.

### User Notification Preferences

Users can configure how they receive different types of notifications:

- **In-app** (badge + notification center)
- **Email** (immediate or daily digest)
- **SMS** (high-priority only)
- **Push** (mobile app)

Preferences are stored in `user_plans` or `structured_memory` and respected by the notification system.

### Integration with the Rest of the System

- The **Event Worker** triggers notifications when external systems inject high-importance data.
- The **Post-Response Handler** can queue background jobs and schedule completion notifications.
- `ThreadContext` can include a `pending_notifications` array for the current session.
- All notifications are logged in Langfuse with `contextId` for full traceability.

This design ensures the agent can be proactive and helpful without interrupting the user's workflow unnecessarily.

## Failure Handling Philosophy: Hard vs Soft Failures

Not all failures are equal. The system distinguishes between two fundamental types of failures and handles them differently.

### Hard Failures

**Definition:** A failure where resolution is **not possible** in the current context — the system is down, unavailable, or the error is outside our control.

**Characteristics:**
- External system outage (Copart API down, Stripe unavailable, eBay rate limit exceeded)
- Database or cache unavailability
- Authentication / permission system failure
- Model provider outage (xAI / OpenAI / Anthropic unavailable)
- Network partition between services

**Handling Strategy:**
- **Do not retry endlessly** — implement circuit breaker pattern.
- **Graceful degradation** — switch to read-only mode or cached data where possible.
- **Clear user communication** — "Copart is currently experiencing issues. I can use cached auction data from 20 minutes ago or wait until the service recovers."
- **Asynchronous notification** to operations team (if critical).
- **Log as hard failure** with full context for post-mortem.

**Goal:** Protect the user from bad data or actions while the system is impaired.

### Soft Failures

**Definition:** A failure where resolution **is possible** because we know how to recover — usually through HITL, retry, fallback, or clarification.

**Characteristics:**
- Entity resolution ambiguity (name → canonical ID fails)
- Tool input validation error (user gave bad parameters)
- Low confidence model output
- Stale but usable data
- Partial tool results

**Handling Strategy:**
- **Attempt recovery automatically** when safe (retry, fallback to cache, use secondary tool).
- **Use HITL** when user input is required (clarification, approval, correction).
- **Be transparent** — explain what went wrong and what we're doing to fix it.
- **Log as soft failure** so we can measure and improve resolution success rate over time.

**Goal:** Resolve the issue with minimal user friction and continue the workflow.

### Comparison Table

| Aspect                    | Hard Failure                          | Soft Failure                              |
|---------------------------|---------------------------------------|-------------------------------------------|
| Resolution possible?      | No                                    | Yes                                       |
| Primary handling          | Graceful degradation + clear message  | Retry / HITL / Fallback                   |
| User involvement          | Informational only                    | Often required (clarification or approval)|
| Retry strategy            | Circuit breaker (limited retries)     | Aggressive retry + exponential backoff    |
| Example                   | Copart API completely down            | "Which Honda did you mean?"               |
| System state              | Impaired mode                         | Normal operation with extra step          |

### Why This Distinction Matters

- It prevents the system from wasting time retrying unrecoverable errors.
- It ensures we use HITL only when it adds value (soft failures), not for hard outages.
- It gives us clear metrics: "What % of failures are soft and resolvable?" vs "What % are hard and require infrastructure fixes?"
- It makes the agent feel intelligent — it knows when to ask for help vs when to simply inform the user.

This philosophy guides every failure handling decision in the system.

## Quota & Budget Exhaustion — Special Handling

Running out of tokens or hitting a bidding budget is **not** treated as a failure (hard or soft). It is a **Quota Exhausted** state — a predictable business limit that has been reached.

### Why This Is Different

- It is fully predictable (we know the exact threshold).
- It is immediately recoverable (purchase more, upgrade, or wait for reset).
- Framing it as a "failure" makes the agent sound broken. Instead, it should feel like a helpful business moment.

### Handling Strategy

1. **Pre-Call Enforcement** (in Request Flow)
   - Check `token_monthly_remaining` or bidding budget from `user_plan`.
   - If limit is reached → **do not** call the LLM or execute the action.
   - Return immediately with a clear, actionable message.

2. **User-Facing Response**
   - Explain the situation factually.
   - Show current usage.
   - Offer immediate options (buy more, upgrade, wait for reset).
   - Use positive, helpful language.

**Example Response:**

> You've reached your monthly token limit (1,000 / 1,000 used).
> 
> You can:
> A) Buy 500 additional tokens for $9.99
> B) Upgrade to Pro plan ($29/mo — 5,000 tokens)
> C) Wait until your limit resets on May 1st
> 
> What would you like to do?

### Integration Points

- **Request Flow** — Pre-call hook performs the check and short-circuits.
- **effective_features.md** — `usage_quotas` feature controls whether quotas are enforced.
- **user_plans** table — Stores `token_monthly_remaining`, bidding budget, etc.
- **Observability** — Log as "Quota Exceeded" (not a failure) for clean metrics.

This approach turns a potential point of friction into a clear, low-friction upgrade opportunity while keeping the agent feeling helpful and professional.

## Observability & Learning from Failures

Every failure (hard or soft) and every HITL interaction is fully observable and used to improve the system over time.

### What Gets Logged

For every failure or HITL event, we log:

- `failure_category` (Entity Resolution, Tool Execution, Quota Exceeded, etc.)
- `failure_type` (hard / soft / quota_exceeded)
- `confidence_score` (if applicable)
- `contextId`
- `user_id`
- `yard_id`
- `focus_state` at time of failure
- Full error details or user response
- Resolution outcome (resolved via HITL, auto-retried, escalated, etc.)
- Time to resolution

All events are sent to Langfuse with `contextId` as the session identifier for full traceability.

### Metrics We Track

- **Soft Failure Resolution Rate** — % of soft failures successfully resolved via HITL or retry
- **Hard Failure Frequency** — by category and external system
- **HITL Acceptance Rate** — how often users approve vs reject vs modify proposals
- **Quota Exhaustion Conversion Rate** — % of users who upgrade or buy more after hitting limit
- **Time to Resolution** — average time from failure to successful continuation
- **Clarification Success Rate** — % of entity resolution clarifications that lead to correct canonical ID

### Continuous Improvement Loop

1. **Weekly Review** — Operations team reviews top failure patterns.
2. **Model Improvement** — Low-confidence entity resolution cases are used to fine-tune the resolver.
3. **Prompt Tuning** — Recurring clarification patterns are turned into better prompt guidance.
4. **Feature Gating** — If a feature causes too many failures, it can be temporarily disabled via `effective_features`.
5. **SME Agent Training** — Future specialized agents inherit failure patterns and handling strategies from this system.

This turns every failure into a learning opportunity rather than just a support ticket.

## Extensibility

The failure handling and HITL system is designed to evolve with the product and support future multi-agent decomposition.

### Adding New Failure Types

To add a new failure type:

1. Add it to the **Comprehensive Failure Mode Catalog** with a clear definition.
2. Define whether it is **Hard** or **Soft**.
3. Specify the handling strategy (retry, HITL, graceful degradation, notification, etc.).
4. Add the new `failure_category` value to logging.
5. Update metrics dashboards.

No core code changes are required for most new failure types — the system is configuration-driven.

### Adding New HITL Triggers

New HITL triggers can be added by:

- Defining the condition (e.g. "bidding amount > $5,000" or "new high-value part detected").
- Assigning it to one of the four HITL categories (Synchronous Blocking, Asynchronous Blocking, Asynchronous Non-blocking, Long-running Job Completion).
- Configuring the delivery channel and user notification preferences.
- Updating the relevant prompt guidance.

### Future Evolution

As the system evolves toward SME agents and more autonomous behavior, the following extensions are planned:

- **Agent-specific failure profiles** — Each SME agent (Auction Intelligence, Inventory, Valuation) can have its own failure handling rules and HITL thresholds.
- **Cross-agent HITL** — One agent can escalate to another agent or to a human for complex decisions.
- **Predictive HITL** — Use historical patterns to proactively ask for clarification before a likely failure occurs.
- **Self-healing failures** — For certain soft failures, the system can automatically apply learned corrections without user intervention.

The foundation built in this document supports all of these future capabilities without requiring a redesign.
