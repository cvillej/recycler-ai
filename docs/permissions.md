# permissions.md

**Version:** April 26, 2026  
**Status:** New (Zoom Level 2)

This document defines the feature gating, subscription, and usage quota system for the AI Yard Assistant. It is designed to support flexible go-to-market strategies, including per-yard access, per-user overrides, monthly subscriptions, token quotas, free trials, and smooth upgrade paths.

## Purpose

Permissions and gating are a **core business capability**, not just a technical detail. The system must support:

- Different feature sets for different customers
- Per-yard and per-user control
- Monthly subscription tiers with usage limits
- Free trial periods
- Easy on-ramping from free to paid, and upgrades between tiers

## Core Model

### 1. Yard-Level Access (Primary Unit)
Most features and quotas are evaluated at the **yard** level.

- `yards.effective_features` — Array of enabled capabilities for the yard
- `yards.plan` — Current subscription tier (e.g., `trial`, `basic`, `pro`)
- `yards.usage_quotas` — Token limits and current usage

### 2. User-Level Overrides
Individual users can have additional or restricted access.

- `users.feature_overrides` — Per-user additions or restrictions
- `users.role` — `owner`, `manager`, `worker` (affects some permissions)

### 3. Subscription & Trial State
- `subscriptions.status` — `trial`, `active`, `past_due`, `canceled`
- `subscriptions.trial_ends_at`
- `subscriptions.current_period_end`

### 4. Effective Features Resolution
All of the above is resolved early into a single `effective_features` list + `usage_state` object that is available in `ThreadContext`.

## Integration with Architecture

- **Context Enricher** resolves `effective_features` and `usage_state` at the start of every request.
- **prompt_resolution** uses `effective_features` to filter available tools and Skills.
- **UI Layer** uses `effective_features` to show/hide widgets and features.
- **Background Jobs** can check quotas before executing expensive operations.
- **NotificationService** can trigger upgrade nudges when limits are approached or exceeded.

## Phase 0 Scope

**Implemented:**
- Yard-level `effective_features`
- Basic per-user overrides
- Subscription tier awareness (`plan`)
- Token usage tracking and basic quota enforcement
- Trial period support
- Upgrade prompt injection points (via notifications and in-conversation nudges)

**Deferred:**
- Advanced time-based or usage-based feature bundles
- Granular per-feature pricing
- Self-service upgrade flows in UI (Phase 1+)

## Future Evolution

As the business grows, we can extend the system to support:

- Feature bundles and add-ons
- Usage-based billing
- Advanced trial rules (e.g., limited features during trial)
- Multi-yard enterprise plans
- Integration with external billing systems (Stripe, etc.)

The core `effective_features` + `usage_state` model is designed to support these extensions without major refactoring.

## Upgrade & Onboarding Nudges

When users approach limits or could benefit from additional features, the system should nudge them toward upgrades using a hybrid approach:

- **Knock + Deep Link (HITL)**: Best for high-intent moments (e.g., "You've reached your monthly token limit").
- **In-Conversation Nudges**: Used during active chat or phone sessions when it feels natural.
- **UI Banners / Widgets**: Persistent but non-intrusive awareness in the dashboard or settings.

This combination provides good conversion rates without being overly interruptive.

## Summary

Permissions and gating are treated as a first-class subsystem. The design prioritizes **business flexibility** (per-yard, per-user, subscription tiers, trials, upgrades) while remaining simple and maintainable in Phase 0. All feature decisions flow through a single, well-defined resolution path early in the request lifecycle.