# notification-strategy.md
**Version:** April 25, 2026  
**Status:** Complete (Zoom Level 2)

This document defines the notification strategy for the AI Yard Assistant, including how we deliver proactive alerts, HITL interactions, and user-facing updates across channels.

## Purpose

Notifications are a first-class capability in the AI Yard Assistant. They enable proactive behavior, rich Human-In-The-Loop (HITL) workflows, and real-time visibility into important events without requiring the user to stay in the chat interface.

The notification system must support:
- Multiple urgency levels and delivery channels
- Actionable, deep-linked interactions
- Strong user preference control
- Clean integration with Inngest, Ably, and the core agent loop

## Core Notification Categories

We support four distinct notification types, as defined in the HITL and external event systems:

| Type                              | Blocking? | Purpose | Example |
|-----------------------------------|-----------|---------|---------|
| **Synchronous Blocking**          | Yes       | Immediate decision required | "Approve $1,240 bid now?" |
| **Asynchronous Blocking**         | Yes       | Needs response (not immediate) | Manager approval for large action |
| **Asynchronous Non-blocking**     | No        | Informational / alerts | "You were outbid", "Aging inventory alert" |
| **Long-running Job Completion**   | No        | Background task finished | "Your 90-day profitability report is ready" |

## Chosen Solution: Knock

We use **Knock** as our primary notification infrastructure platform.

**Why Knock:**
- Excellent support for complex HITL workflows and actionable notifications.
- Strong user preference engine and multi-channel routing.
- First-class deep link + webhook support for closed-loop interactions.
- High-quality in-app notification components and templates.
- Clean TypeScript SDK that integrates well with Inngest and our architecture.

## Hybrid Notification Routing

To optimize cost, latency, and user experience, we use a **hybrid routing strategy**:

- **Simple in-app state updates** (badge counts, widget refreshes, basic `ThreadContext` changes) → **Ably** only.
- **Rich, actionable, or multi-channel notifications** (HITL, user alerts, job completions) → **Knock**.

**Routing Decision Logic** (centralized in `NotificationService`):
- Does this require user action / approval? → Knock
- Does this need cross-channel delivery (push, email, SMS)? → Knock
- Is this purely visual/UI state? → Ably
- Is `importance_score` high or does the user prefer rich delivery? → Knock

This hybrid approach keeps costs predictable while delivering the best possible experience.

## Integration Architecture

### Core Abstraction

All notifications flow through `packages/shared/notifications/NotificationService`.

### Typical Flow (HITL Example)

1. Inngest workflow reaches a HITL step.
2. Calls `notificationService.sendInteractive({ contextId, type: "approve_bid", ... })`.
3. Knock generates rich notifications with signed deep links.
4. User interacts via deep link → App opens and sends structured response.
5. Webhook or direct app callback resumes the Inngest workflow.
6. Result is injected into the conversation via normal message flow.

### Observability

- All Knock deliveries are logged with `contextId`.
- Linked to Langfuse traces for full end-to-end visibility.
- Delivery status (sent, delivered, clicked, responded) is tracked.

## User Configuration & Preferences

Users have a comprehensive **Notification Settings** page that allows them to configure:

- Preferences per notification category
- Preferred channels per category
- Quiet hours / Do Not Disturb
- Digest settings
- Importance threshold for different channels

These preferences are stored in the database and respected by the `NotificationService` when deciding routing and delivery.

## Security & Compliance

- All deep links are signed and time-limited.
- Sensitive data is redacted or summarized in notifications.
- All business-critical actions (bids, pricing changes, approvals) are fully audited.
- PII handling follows our privacy policies.