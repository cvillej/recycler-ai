# failure-mode-and-hitl.md
**Version:** April 26, 2026  
**Status:** Updated (Zoom Level 2) — Knock + Inngest + Ably HITL + Post-Purchase Workflows

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
- Multi-step post-purchase workflows (e.g., eBay listing with photo uploads and approvals)

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

## Asynchronous Communication & Notifications (Knock + Inngest + Ably)

Not all important information requires immediate user attention. The system must support **asynchronous, non-blocking communication** for scenarios where the user needs to be informed but does not need to respond right away.

### HITL Categorization

We explicitly categorize HITL interactions into four types:

| Type                              | Blocking? | Primary Delivery                  | Example |
|-----------------------------------|-----------|-----------------------------------|---------|
| **Synchronous Blocking**          | Yes       | In-chat (immediate)               | "Should I bid $1,240 now?" |
| **Asynchronous Blocking**         | Yes       | Knock (deep link + webhook)       | Manager approval for large bid |
| **Asynchronous Non-blocking**     | No        | Knock or Ably                     | "Auction for 2019 CR-V starts in 2 hours" |
| **Long-running Job Completion**   | No        | Knock                             | "Your 90-day profitability report is ready" |

**Implementation:**
- Rich, actionable, or multi-channel HITL → **Knock** (with deep links and webhooks)
- Simple in-app state updates → **Ably**
- All complex or durable HITL workflows are orchestrated via **Inngest** (durable execution, "wait for event" steps, retries)

### External System Injections

When an external system (Copart, IAAI, inventory scanner, Stripe, eBay, etc.) injects important information:

- If the user is in an active relevant session → inject as a system message immediately.
- If the user is not active or the information is not urgent → queue as an **Asynchronous Non-blocking Notification** via Knock or Ably.
- Use `importance_score` and `labels` to determine urgency and delivery channel.

### Budget and Quota Warnings

When a user approaches or hits a budget/quota limit:

- Show warning in current chat if active.
- Send **Asynchronous Non-blocking Notification** via Knock or Ably if user is offline.
- Optionally pause proactive features until budget is increased.
- Store warning in `structured_memory`.

### Long-Running Job Notifications

For operations that take time (report generation, bulk valuation, large data export):

1. Acknowledge immediately in-chat.
2. Kick off background job as an **Inngest** workflow.
3. When complete → send **Long-running Job Completion** notification via Knock.
4. Store the result in `structured_memory` or as a retrievable artifact.

### User Notification Preferences

Users can configure how they receive different types of notifications (in-app, email, SMS, push). These preferences are respected by the **NotificationService** when deciding routing.

## Failure Handling Philosophy: Hard vs Soft Failures

Not all failures are equal. The system distinguishes between two fundamental types of failures and handles them differently.

### Hard Failures

**Definition:** A failure where resolution is **not possible** in the current context — the system is down, unavailable, or the error is outside our control.

**Characteristics:**
- External system outage (Copart API down, Stripe unavailable, eBay rate limit exceeded)
- Database or cache unavailability
- Authentication / permission system failure
- Model provider outage
- Network partition between services

**Handling Strategy:**
- **Do not retry endlessly** — implement circuit breaker pattern.
- **Graceful degradation** — switch to read-only mode or cached data where possible.
- **Clear user communication**
- **Asynchronous notification** to operations team (if critical).
- **Log as hard failure** with full context for post-mortem.

**Goal:** Protect the user from bad data or actions while the system is impaired.

### Soft Failures

**Definition:** A failure where resolution **is possible** because we know how to recover — usually through HITL, retry, fallback, or clarification.

**Characteristics:**
- Entity resolution ambiguity
- Tool input validation error
- Low confidence model output
- Stale but usable data
- Partial tool results

**Handling Strategy:**
- **Attempt recovery automatically** when safe.
- **Use HITL** when user input is required.
- **Be transparent**
- **Log as soft failure**

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

## Quota & Budget Exhaustion — Special Handling

Running out of tokens or hitting a bidding budget is **not** treated as a failure (hard or soft). It is a **Quota Exhausted** state — a predictable business limit that has been reached.

**Handling Strategy:**

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

## Observability & Learning from Failures

Every failure (hard or soft) and every HITL interaction is fully observable and used to improve the system over time.

**What Gets Logged:**
- `failure_category`, `failure_type` (hard / soft / quota_exhausted)
- `confidence_score`, `contextId`, `user_id`, `yard_id`, `focus_state`
- Full error details or user response
- Resolution outcome
- Linked Inngest trace ID and Knock delivery status
- Ably connection and message events

All events are sent to Langfuse with `contextId` for full traceability.

**Metrics We Track:**
- Soft Failure Resolution Rate
- Hard Failure Frequency
- HITL Acceptance Rate
- Quota Exhaustion Conversion Rate
- Time to Resolution

## Extensibility

The failure handling and HITL system is designed to evolve with the product and support future multi-agent decomposition.

**Adding New Failure Types:**
- Add to the Comprehensive Failure Mode Catalog
- Define Hard or Soft
- Specify handling strategy
- Update logging and metrics

**Adding New HITL Triggers:**
- Define the condition
- Assign to one of the four categories
- Configure delivery channel (primarily Knock + Ably)
- Update prompt guidance

**Future Evolution:**
- Agent-specific failure profiles
- Cross-agent HITL
- Predictive HITL
- Self-healing failures

The foundation built in this document supports all of these future capabilities without requiring a redesign.