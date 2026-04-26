# ui-layer.md
**Version:** April 25, 2026  
**Status:** Updated (Zoom Level 2) — Ably + Knock

This document defines the UI Layer architecture for the AI Yard Assistant. It supports a unified, high-quality experience across **Web, Mobile, and Tablet** while enabling rich composability, real-time updates, and modern user interface patterns.

## Purpose of the UI Layer

The UI Layer is responsible for delivering a consistent, responsive, and highly interactive experience across all platforms. It must:

- Provide a unified experience on **Web, iOS, Android, and Tablet**
- Support **rich, composable widgets** inside and around the chat interface
- Enable real-time, event-driven UI updates powered by **Ably**
- Deliver native-quality performance and features (push notifications via Knock, offline support, gestures, AR)
- Maintain clean separation between presentation and business logic
- Adapt dynamically to the user's current `focus_state` and available `effective_features`
- Scale gracefully as new features and SME agents are added

The UI is not just a chat interface — it is a **composable, widget-driven application** that feels alive and intelligent.

## High-Level Architecture

We use a **monorepo** approach with shared code to achieve "write once, deploy everywhere" while maximizing quality on each platform.

### Technology Stack

| Platform            | Technology                              | Purpose |
|---------------------|-----------------------------------------|---------|
| **Web**             | Next.js 16 (App Router)                 | Best-in-class web experience |
| **Mobile + Tablet** | Expo (React Native) + EAS Build         | Native iOS + Android + Tablet apps |
| **Shared UI**       | `packages/ui` + NativeWind              | Consistent design system |
| **Widgets**         | `packages/widgets`                      | Self-contained, event-driven components |
| **Shared Logic**    | `packages/shared`                       | API client, types, realtime hooks, auth |
| **Realtime**        | **Ably**                                | Low-latency widget subscriptions |
| **Notifications**   | **Knock**                               | Rich push + in-app notifications |
| **State Management**| Zustand + Ably subscriptions            | Reactive, real-time state |
| **Auth**            | Supabase Auth (with DevAuthService abstraction) | Cross-platform auth + MFA |
| **Push Notifications** | Expo Notifications + Knock            | Best-in-class push for iOS + Android |

### Repository Structure

```bash
monorepo/
├── apps/
│   ├── web/                    # Next.js 16 web application
│   └── mobile/                 # Expo application (iOS + Android + Tablet)
├── packages/
│   ├── ui/                     # Shared UI components
│   ├── widgets/                # Composable widgets
│   ├── shared/                 # Types, API client, realtime hooks, auth
│   └── config/                 # Shared configuration and feature flags
```

This structure allows most UI code to be shared, while platform-specific code lives in `apps/web` and `apps/mobile`.

## Core UI Philosophy: Composable Widgets + Real-time

The UI is built around a **widget system** rather than traditional pages. Widgets are the primary way users interact with the system.

### What Are Widgets?

Widgets are **self-contained, reusable React components** that can:

- Subscribe to real-time events via **Ably** (notifications, `focus_state` changes, external events)
- Render rich, interactive content (maps, charts, forms, status indicators, AR views)
- Be dynamically shown, hidden, or reconfigured based on `focus_state` and `effective_features`
- Live **inside the chat** or as **persistent UI elements** (top bar, floating panel, side drawer, bottom sheet)
- Trigger actions that flow back through the normal Request Flow or Inngest

### Example Widgets (Phase 0)

- `NotificationWidget` — Pending notifications + quick actions
- `ActiveBiddingWidget` — Current auction status, time remaining, budget, quick bid adjustments
- `InventoryLocationWidget` — Interactive map/AR view with location updates
- `ValuationSummaryWidget` — Live market comps + margin projection
- `AgingInventoryWidget` — Prioritized list of aging parts with recommended actions
- `ProfitabilityWidget` — High-level profitability dashboard

### Widget Subscription Model (Ably-Powered)

Widgets subscribe to Ably channels using a consistent naming convention:

- `context:{contextId}` — Conversation-specific updates
- `user:{userId}` — User-level updates (badges, preferences)
- `focus:{focus_state}` — Focus-state specific updates

This allows:
- A notification widget to instantly react when new events arrive
- A bidding widget to update in real time when auction status changes
- Multiple widgets to stay in sync without polling

## Dynamic UI Based on Context

The UI adapts intelligently using two key pieces of state from `ThreadContext`:

### 1. focus_state

Determines which widgets are most relevant right now:
- `inventory_management`
- `active_bidding`
- `valuation_review`
- `general_chat`
- `report_review`

Widgets can register themselves as relevant to specific `focus_state` values and appear/disappear automatically.

### 2. effective_features

Controls which capabilities are visible and enabled:
- Feature-gated widgets (e.g., "Advanced Bidding" widget only appears for Pro users)
- Permission-based actions inside widgets
- Progressive disclosure of advanced functionality

## Integration with Backend Systems

### With Request Flow
- Widgets can trigger messages that go through the normal Request Flow (e.g., "Increase max bid by $50")
- Responses from the agent can update widget state via Ably

### With NotificationService (Knock + Ably)
- Rich notifications from Knock can deep-link directly into specific widgets
- Simple realtime updates arrive via Ably and update widgets instantly
- User responses to HITL notifications flow back through Inngest → Request Flow

### With Memory & Context
- Widgets can read from and contribute to `structured_memory` and `pinnedFacts`
- Long-running job results (e.g., reports) can be surfaced in dedicated widgets

## Push Notifications

Push notifications are handled via **Knock** + **Expo Notifications**:

- Knock manages delivery, templates, and user preferences
- Expo handles the native push infrastructure for iOS and Android
- Deep links from push notifications open the app directly to the relevant widget or conversation

## Dev-Mode Annotations (UI Feature)

In development mode only (`NODE_ENV === 'development'`), the UI provides a built-in ability to add annotations directly to the chat interface.

- Each message shows a small **"Annotate"** icon
- Developers can add free-text notes or tags (e.g., "This response hallucinated the part ID")
- Annotations are sent as metadata and attached to the Langfuse trace
- When a trace is pulled, the JSON includes the `annotations` array
- Annotations are **never stored or sent** in production

This feature makes debugging and trace analysis significantly more powerful when working with the LLM coding agent.

## Performance & Offline Considerations

- **Aggressive caching** of `ThreadContext` and user plans in memory + local storage
- **Optimistic UI updates** for low-risk actions (with rollback on failure)
- **Offline support** for read-only views and queued actions (via React Native offline capabilities)
- **Smart reconnection** logic for Ably when network is restored
- **Widget-level lazy loading** — only load widgets relevant to current `focus_state`

## Security & Permissions

- All widget actions are gated by `effective_features` before being sent to the backend
- Sensitive actions (bidding, pricing changes, inventory modifications) require explicit confirmation
- Deep links from notifications are signed and validated
- MFA support is available for high-privilege accounts

## Future Evolution

The UI architecture is designed to support future growth:

- **AR Experiences** — Inventory location, part identification, damage assessment
- **Multi-Agent UI** — Side-by-side agent conversations with clear ownership
- **Advanced Visualization** — 3D inventory views, profitability heatmaps, trend analysis
- **Team / Multi-Yard Support** — Role-based views and collaborative widgets
- **Voice-First Interface** — Deeper integration with voice commands and audio feedback

The widget system + Ably realtime foundation makes these additions low-risk and composable.

## Summary

The UI Layer is a **composable, widget-driven, real-time application** built on:

- **Next.js + Expo** monorepo for maximum code sharing
- **Ably** for low-latency, reliable realtime updates
- **Knock** for rich, actionable notifications and push
- **Dynamic adaptation** via `focus_state` and `effective_features`
- **Clean separation** between presentation and business logic
- **Full integration** with Request Flow, Inngest, Memory, and Observability

This design delivers a modern, responsive, and intelligent user experience while remaining maintainable and scalable as the system evolves.