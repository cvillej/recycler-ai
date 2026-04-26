# notification-strategy.md
**Version:** April 25, 2026  
**Status:** Complete (Zoom Level 2)

This document defines the complete notification strategy for the AI Yard Assistant. It covers how we deliver proactive alerts, rich Human-In-The-Loop (HITL) interactions, real-time UI updates, and background job completions across multiple channels while maintaining cost efficiency, excellent user experience, and full observability.

## Purpose

Notifications are a **first-class architectural capability**. They enable the system to be proactive rather than purely reactive, support complex closed-loop workflows (especially HITL), and keep users informed without forcing them to stay inside the chat interface.

The notification system must support:
- Multiple urgency levels and delivery channels (in-app, push, email, SMS)
- Actionable, deep-linked interactions with signed webhooks
- Strong user preference control and quiet hours
- Clean, observable integration with Inngest, Ably, Request Flow, and the core agent loop
- Predictable cost at scale

## Notification Categories

We explicitly categorize all notifications into four types. This classification drives routing, urgency, and delivery channel decisions.

| Type                              | Blocking? | User Action Required? | Primary Channel     | Example |
|-----------------------------------|-----------|-----------------------|---------------------|---------|
| **Synchronous Blocking**          | Yes       | Immediate             | In-chat + Knock     | "Approve $1,240 bid now?" |
| **Asynchronous Blocking**         | Yes       | Yes (not immediate)   | Knock (deep link)   | Manager approval for large pricing change |
| **Asynchronous Non-blocking**     | No        | No                    | Knock or Ably       | "You were outbid on 2019 CR-V", "Aging inventory alert" |
| **Long-running Job Completion**   | No        | No                    | Knock               | "Your 90-day profitability report is ready — view now" |

This categorization is enforced in the `NotificationService` and respected by Inngest workflows and the Post-Response Handler.

## Chosen Platforms

We use a **hybrid platform strategy**:

- **Knock** — Primary platform for rich, actionable, multi-channel, and HITL notifications
- **Ably** — Dedicated realtime platform for simple, low-latency in-app state updates (widget refreshes, badge counts, basic `ThreadContext` changes)

### Why Knock?

- Best-in-class support for complex HITL workflows and closed-loop interactions
- Excellent user preference engine (channels, quiet hours, importance thresholds, digests)
- First-class deep link + signed webhook support
- High-quality in-app notification components and templates
- Strong TypeScript SDK that integrates cleanly with Inngest and our architecture
- Delivery tracking and analytics built-in

### Why Ably (instead of Supabase Realtime)?

- Superior global performance and reliability
- Better presence and message history features
- Self-hosting option available (lower long-term lock-in risk)
- Excellent developer experience and SDKs
- More cost-effective at moderate scale

## Hybrid Routing Strategy

The `NotificationService` (in `packages/shared/notifications/`) makes the routing decision centrally. This is the single source of truth for all notification decisions.

### Routing Decision Logic

```typescript
function decideRouting(notification: NotificationRequest): 'knock' | 'ably' {
  if (notification.requiresUserAction || notification.importanceScore >= 0.8) {
    return 'knock';
  }
  if (notification.channels && notification.channels.length > 1) {
    return 'knock';
  }
  if (notification.type === 'realtime_state_update' || notification.type === 'badge_count') {
    return 'ably';
  }
  return 'knock'; // Default to Knock for most business notifications
}
```

**Practical Rules:**
- Any notification that requires user action or approval → **Knock**
- Any notification that needs push, email, or SMS → **Knock**
- Purely visual/UI state updates (badge counts, widget refreshes) → **Ably**
- High `importance_score` or user has rich delivery preference → **Knock**
- Simple informational updates when user is online → **Ably** (faster, cheaper)

This hybrid approach keeps costs predictable while delivering the best possible experience.

## Integration Architecture

### Core Abstraction: NotificationService

All notifications in the system go through a single abstraction:

```typescript
interface NotificationService {
  sendInteractive(params: InteractiveNotificationParams): Promise<NotificationResult>;
  sendInformational(params: InformationalNotificationParams): Promise<NotificationResult>;
  sendJobComplete(params: JobCompleteParams): Promise<NotificationResult>;
}
```

This abstraction hides the complexity of Knock + Ably routing from the rest of the system.

### Typical Flows

#### 1. HITL Flow (Most Complex)

1. Inngest workflow reaches a HITL step (e.g., "Approve bid")
2. Calls `notificationService.sendInteractive({ contextId, type: "approve_bid", ... })`
3. `NotificationService` routes to **Knock**
4. Knock generates rich notification with signed deep link + webhook
5. User clicks deep link → App opens with structured response form
6. User submits decision → Webhook or direct callback sent to Inngest
7. Inngest resumes the workflow
8. Result is injected into the conversation via normal Request Flow
9. Full trace is recorded in Langfuse (including Knock delivery status)

#### 2. Simple Realtime Update Flow

1. `ThreadContext` changes (e.g., new aging inventory count)
2. Post-Response Handler or Event Worker calls `notificationService.sendInformational(...)`
3. `NotificationService` routes to **Ably**
4. Ably pushes low-latency update to connected clients
5. UI widgets refresh automatically
6. Logged in Langfuse as a lightweight realtime event

#### 3. Long-Running Job Completion Flow

1. Inngest workflow completes a heavy job (e.g., 90-day report)
2. Calls `notificationService.sendJobComplete(...)`
3. Routes to **Knock**
4. User receives rich notification with deep link to view the report
5. Logged with full context in Langfuse

## Observability & Debugging

Every notification is fully observable:

- All Knock deliveries are logged with `contextId`, delivery status (sent, delivered, clicked, responded), and error details
- Ably connection and message events are captured
- Linked to the corresponding Langfuse trace
- Decision Traceability fields (`decision`, `reason`, `input`, `output`) are recorded when the `NotificationService` makes a routing decision

This makes it possible to debug end-to-end flows such as:
> "Why didn't the user receive the bid approval notification?"

## User Configuration & Preferences

Users have a comprehensive **Notification Settings** page that allows them to configure:

- Preferences per notification category (e.g., "Aging Inventory", "Auction Alerts", "HITL Requests")
- Preferred channels per category (in-app, push, email, SMS)
- Quiet hours / Do Not Disturb windows
- Digest settings (daily/weekly summaries)
- Minimum importance threshold for different channels

These preferences are stored in the `user_preferences` table and respected by the `NotificationService` at decision time.

## Security & Compliance

- All deep links are **signed and time-limited**
- Sensitive business data is redacted or summarized in notifications
- All business-critical actions (bids, pricing changes, approvals) are fully audited via Langfuse
- PII handling follows our privacy policies
- Webhook signatures are validated on the Inngest side when users respond via deep links

## Cost Considerations

The hybrid approach is deliberately designed to control costs:

- **Ably** is used for high-volume, low-value updates (badge counts, widget refreshes) — these are very cheap
- **Knock** is used for high-value, lower-volume interactions (HITL, job completions, important alerts) — these justify the higher cost per message
- User preference controls and importance scoring help avoid unnecessary rich notifications

In practice, we expect the majority of notification volume to go through Ably, keeping overall costs manageable even as the user base grows.

## Implementation Notes

- The `NotificationService` lives in `packages/shared/notifications/`
- It is initialized with both Knock and Ably clients
- All notification templates and workflows are managed in the Knock dashboard (not in code)
- Ably channels follow a consistent naming convention: `context:{contextId}` and `user:{userId}`

## Future Evolution

As the product grows, we can:

- Add new notification channels (e.g., WhatsApp, Slack for team accounts) by extending the `NotificationService`
- Introduce more sophisticated routing logic (e.g., machine learning on user engagement)
- Add support for notification digests and smart batching
- Integrate with future multi-agent systems so agents can send notifications on behalf of the user

The current abstraction layer makes these changes low-risk.

## Summary

The notification strategy is built on a **hybrid Knock + Ably** foundation with a strong central `NotificationService` abstraction. This gives us:

- Excellent support for complex HITL and closed-loop workflows via Knock
- Fast, cheap, low-latency realtime updates via Ably
- Full observability and debuggability
- Strong user control and preference management
- Predictable cost scaling
- Clean integration with Inngest, Request Flow, and the rest of the architecture

This design supports both Phase 0 needs and long-term product evolution.