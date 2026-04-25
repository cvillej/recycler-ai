# ui-layer.md
**Version:** April 25, 2026  
**Status:** Updated (Zoom Level 2) — Ably + Knock

This document defines the UI Layer architecture for the AI Yard Assistant. It supports a unified, high-quality experience across **Web, Mobile, and Tablet** while enabling rich composability and modern user interface patterns.

## Purpose of the UI Layer

The UI Layer is responsible for delivering a consistent, responsive, and highly interactive experience across all platforms. It must:

- Provide a unified experience on **Web, iOS, Android, and Tablet**
- Support **rich, composable widgets** inside and around the chat interface
- Enable real-time, event-driven UI updates (especially for notifications and contextual widgets)
- Deliver native-quality performance and features (push notifications, offline support, gestures, AR)
- Maintain clean separation between presentation and business logic
- Scale gracefully as new features and SME agents are added

The UI is not just a chat interface — it is a **composable, widget-driven application** that adapts to the user's current `focus_state` and available `effective_features`.

## High-Level Architecture

We use a **monorepo** approach with shared code to achieve "write once, deploy everywhere" while maximizing quality on each platform.

### Technology Stack

| Platform          | Technology                              | Purpose |
|-------------------|-----------------------------------------|--------|
| **Web**           | Next.js 16 (App Router)                 | Best-in-class web experience |
| **Mobile + Tablet** | Expo (React Native) + EAS Build        | Native iOS + Android + Tablet apps |
| **Shared UI**     | `packages/ui` + NativeWind              | Consistent design system across platforms |
| **Widgets**       | `packages/widgets`                      | Self-contained, event-driven UI components |
| **Shared Logic**  | `packages/shared`                       | API client, types, auth, utilities |
| **Styling**       | NativeWind (Tailwind for React Native)  | Consistent look and feel |
| **State**         | Zustand + Ably                          | Real-time widget subscriptions |
| **Auth + MFA**    | Supabase Auth (with clean abstraction)  | Cross-platform authentication with optional MFA |
| **Push Notifications** | Expo Notifications + Knock            | Best-in-class push for iOS + Android |

### Repository Structure

```bash
monorepo/
├── apps/
│   ├── web/                    # Next.js 16 web application
│   └── mobile/                 # Expo application (iOS + Android + Tablet)
├── packages/
│   ├── ui/                     # Shared UI components
│   ├── widgets/                # Composable widgets (NotificationWidget, BiddingWidget, etc.)
│   ├── shared/                 # Types, API client, realtime hooks
│   └── config/                 # Shared configuration and feature flags
```

This structure allows most UI code (components, widgets, logic) to be shared, while platform-specific code lives in `apps/web` and `apps/mobile`.

## Core UI Philosophy: Composable Widgets

The UI is built around a **widget system** rather than a traditional page-based structure.

### What Are Widgets?

Widgets are **self-contained, reusable React components** that can:

- Subscribe to real-time events (notifications, focus_state changes, external events)
- Render rich, interactive content (maps, charts, forms, status indicators, AR views)
- Be dynamically shown, hidden, or reconfigured based on `focus_state` and `effective_features`
- Live **inside the chat** or as **persistent UI elements** (top bar, floating panel, side drawer)

### Example Widgets

- `NotificationWidget` — Displays pending notifications and allows quick actions
- `ActiveBiddingWidget` — Shows current auction, time remaining, budget status, quick bid adjustments
- `InventoryLocationWidget` — Interactive map/AR view with location update capability
- `ValuationSummaryWidget` — Live market comps + margin projection
- `PhotoIntakeWidget` — Camera + AI preview + quick part creation

### Widget Subscription Model

Widgets subscribe to a central event bus (powered by **Ably**). This allows:

- A notification widget at the top of the screen to react instantly when new events arrive
- A bidding widget to update in real time when auction status changes
- The chat itself to dynamically inject contextual widgets based on the current conversation

This creates a **highly composable, event-driven UI** that feels alive and contextual.

## Push Notifications

Push notifications are a critical part of delivering timely, contextual information to users, especially when they are not actively using the app.

### Requirements

- Support for **Web, iOS, and Android**
- Rich payloads (including `contextId`, action buttons, deep links)
- Ability to target specific users, yards, or `focus_state`
- Configurable per-user notification preferences
- High reliability and delivery tracking

### Technology

- **Mobile (iOS + Android):** Expo Notifications (best-in-class support in 2026)
- **Web:** Web Push API via a service like OneSignal or Expo Notifications web SDK
- **Backend:** Knock is the primary notification service for rich, actionable, and multi-channel delivery. Simple realtime updates use Ably.

### Notification Types

We support several categories of notifications:

| Type                        | Priority | Example |
|-----------------------------|----------|---------|
| **High-Impact Alerts**      | High     | "You were outbid on Lot #C-48219" |