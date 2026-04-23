# ui-layer.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

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
| **State**         | Zustand + WebSocket / Realtime          | Real-time widget subscriptions |
| **Auth + MFA**    | Clerk or Auth0                          | Cross-platform authentication with optional MFA |
| **Push Notifications** | Expo Notifications                   | Best-in-class push for iOS + Android |

### Repository Structure

```bash
monorepo/
├── apps/
│   ├── web/                    # Next.js 16 web application
│   └── mobile/                 # Expo application (iOS + Android + Tablet)
├── packages/
│   ├── ui/                     # Shared component library
│   ├── widgets/                # Composable widgets (NotificationWidget, BiddingWidget, etc.)
│   ├── shared/                 # API client, types, auth helpers, utils
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

Widgets subscribe to a central event bus (powered by WebSocket or Supabase Realtime). This allows:

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
- **Backend:** Event Worker publishes to Expo / OneSignal when a notification should be sent

### Notification Types

We support several categories of notifications:

| Type                        | Priority | Example |
|-----------------------------|----------|---------|
| **High-Impact Alerts**      | High     | "You were outbid on Lot #C-48219" |
| **Actionable Notifications**| Medium   | "Auction for 2019 CR-V starts in 2 hours" |
| **Informational**           | Low      | "New 2020 Honda arrived in your yard" |
| **Background Job Complete** | Medium   | "Your 90-day profitability report is ready" |

### Deep Linking

All notifications should support deep linking into the app:

- Open a specific `contextId`
- Open a particular widget (e.g. `ActiveBiddingWidget`)
- Navigate directly to a focused view (e.g. `focus_state = "auction_bidding_session"`)

This is handled by passing structured data in the notification payload and using Expo's deep linking + Next.js dynamic routes.

### User Preferences

Users can configure notification preferences per category:

- In-app only
- Push + in-app
- Email digest (daily/weekly)
- SMS (high-priority only)
- Mute entirely

Preferences are stored in `user_plans` or `structured_memory` and respected by the notification service.

## Security & MFA

Security is a first-class concern in the UI Layer. We must protect user data, prevent unauthorized actions, and provide flexible authentication options while maintaining a smooth user experience.

### Security Philosophy

- **Defense in Depth** — Multiple layers of protection (authentication, authorization, feature gating, rate limiting, and client-side validation)
- **Least Privilege** — Users only have access to the features and data allowed by their `effective_features` and `user_yard_access`
- **Transparent but Secure** — Users should understand security requirements without unnecessary friction
- **Configurable per Plan** — Advanced security features (MFA, SSO, audit logs) can be enabled via `effective_features`

### Authentication Providers

We support multiple authentication methods to balance security and user experience:

**Recommended Providers (2026):**

| Provider       | Recommended? | Use Case                              | Notes |
|----------------|--------------|---------------------------------------|-------|
| **Email + Password** | Yes (base)  | All users                             | Always available |
| **Google**     | Yes          | Consumer + Business users             | Very high adoption |
| **Apple**      | Yes          | iOS users (almost mandatory)          | Required for good App Store experience |
| **Microsoft**  | Yes          | Enterprise / business users           | Good for corporate environments |
| **Passkeys**   | Yes (future) | Modern passwordless experience        | Growing rapidly in 2026 |

**Recommendation:** 
- Support **Google, Apple, and Microsoft** login in addition to email/password.
- Make social login **configurable per plan** via `effective_features` (e.g. some plans may want to restrict to corporate SSO only).
- Always offer email + password + MFA as a fallback.

### Multi-Factor Authentication (MFA)

MFA is **optional but recommended** for higher-tier plans.

**Supported MFA Methods:**
- TOTP (Google Authenticator, Authy, etc.)
- SMS (as fallback)
- Passkeys / WebAuthn (preferred modern method)

**Configuration:**
- Controlled via `effective_features` (e.g. `mfa_required` or `mfa_optional`)
- Users on higher plans can be forced to enable MFA
- Lower plans can offer MFA as an opt-in security upgrade

### Session Management

- **Web:** HTTP-only secure cookies + short-lived JWTs
- **Mobile:** Secure token storage (Expo SecureStore) + refresh token rotation
- **Session Timeout:** Configurable per plan (default 30 days for "Remember Me", 8 hours for sensitive actions)
- **Concurrent Sessions:** Allowed by default, with option to force single-session mode on higher plans

### Integration with Backend

Authentication is tightly integrated with the rest of the system:

- Successful login creates or updates the `user` record and `user_yard_access`
- The authenticated `user_id` is passed to every request and included in `ThreadContext`
- `effective_features` and `user_plan` are resolved after authentication
- All actions (including widget interactions and tool calls) are authorized against the current user's permissions

## Integration with Backend

The UI Layer is tightly integrated with the backend to deliver a responsive, contextual, and secure experience.

### ThreadContext & Real-time State

Every active session maintains a connection to the backend to receive the latest `ThreadContext`. This includes:

- Current `focus_state` and `pivot_detected`
- Resolved `effective_features`
- `memory_summary` and key `structured_memory` entries
- Recent external events
- Pending notifications and approvals

**Web:** Uses WebSocket or Supabase Realtime to subscribe to `context:{contextId}`  
**Mobile:** Uses Expo Realtime or a shared WebSocket client

When `ThreadContext` changes, relevant widgets automatically re-render with the latest data.

### Feature Gating in the UI

The UI respects `effective_features` at multiple levels:

- **Component Level** — Widgets and UI elements are conditionally rendered based on enabled features
- **Action Level** — Buttons and actions are disabled or hidden if the user lacks the required feature
- **Navigation Level** — Menu items and routes are filtered based on the user's plan

Example:
```tsx
{hasFeature('proactive_bidding') && (
  <BiddingWidget />
)}
```

### Real-time Notifications & Widget Subscriptions

Widgets subscribe to relevant realtime channels:

- `notifications:{user_id}` — For personal notifications
- `context:{contextId}` — For session-specific updates
- `focus:{focus_state}` — For context-aware widgets

This allows a notification widget at the top of the screen to update instantly when new events arrive, without requiring a full page refresh or manual polling.

### API Communication

All API calls go through a shared client in `packages/shared` that:

- Automatically attaches the current auth token
- Includes `contextId` on relevant requests
- Handles token refresh and retry logic
- Provides typed responses and error handling

### Offline Support

Mobile and tablet users (especially yard workers) often operate in areas with poor or intermittent connectivity. The UI Layer must support graceful offline behavior.

**Supported Offline Features:**
- View cached `ThreadContext` and recent conversation history
- Browse previously loaded inventory, vehicles, and auction data
- View cached valuation summaries and reports
- Queue actions for later sync (photo uploads, form submissions, location updates)
- Basic widget functionality (read-only mode for most widgets)

**Not Supported Offline:**
- New LLM calls or tool executions
- Real-time notifications
- Background job status updates
- External system integrations

**Technical Implementation:**
- **Mobile:** Uses Expo's offline storage (SQLite + SecureStore) + React Query / SWR with stale-while-revalidate strategy
- **Web:** Uses IndexedDB + service worker for caching critical assets and data
- **Sync Strategy:** When connectivity returns, the app automatically syncs queued actions and refreshes stale data

**User Experience:**
- Clear offline indicator (banner or icon)
- "Queued for sync" status on pending actions
- Graceful degradation (widgets show last known good state)
- Automatic retry with exponential backoff when back online

## State Management & Real-time

The UI Layer uses a clean, scalable state management approach that supports both local state and real-time synchronization across web and mobile.

### State Management Strategy

We use a **layered state architecture**:

| Layer                    | Technology          | Purpose |
|--------------------------|---------------------|---------|
| **Global App State**     | Zustand             | User session, theme, navigation, feature flags |
| **Server State**         | React Query / SWR   | API data, caching, background refetching |
| **Real-time State**      | Realtime hooks      | Live updates from backend (ThreadContext, notifications, widgets) |
| **Local Component State**| React useState      | Form inputs, UI toggles, temporary state |

**Why Zustand + React Query?**
- Lightweight and performant
- Excellent TypeScript support
- Works identically on web and React Native
- Easy to test and debug

### Real-time Subscription Model

Widgets and components subscribe to realtime channels using a shared `useRealtime` hook:

```tsx
const { data, isConnected } = useRealtime('context:abc123');

useEffect(() => {
  if (data?.type === 'notification') {
    // Update NotificationWidget
  }
}, [data]);
```

**Supported Channels:**
- `context:{contextId}` — Session-specific updates (ThreadContext, new messages, widget injections)
- `user:{user_id}` — Personal notifications and preference changes
- `focus:{focus_state}` — Context-aware updates (e.g. auction price changes)

### Optimistic Updates

For better perceived performance, the UI uses optimistic updates for non-critical actions:

- User updates inventory location → UI updates immediately, then syncs with backend
- If sync fails → UI reverts with clear error message

This pattern is especially useful on mobile where network latency can be high.

## Routing, Navigation & Deep Linking

The UI Layer uses a unified routing system that works consistently across web and mobile while supporting deep linking from notifications and external sources.

### Routing Strategy

| Platform | Routing Library          | Approach |
|----------|--------------------------|----------|
| **Web**  | Next.js App Router       | File-based + dynamic routes |
| **Mobile + Tablet** | Expo Router (file-based) | Same file structure as web where possible |

We maintain a **shared route configuration** in `packages/shared/routes.ts` so both platforms use consistent paths and parameters.

### Deep Linking

Deep linking is essential for notifications, widgets, and external integrations.

**Supported Deep Link Patterns:**

- `/chat/{contextId}` — Open a specific conversation
- `/chat/{contextId}?widget=active_bidding` — Open conversation with specific widget expanded
- `/focus/auction_bidding_session` — Jump to auction mode
- `/notifications` — Open notification center
- `/inventory/{canonical_id}` — Open specific inventory item

**Implementation:**
- Web: Uses Next.js `Link` and `useSearchParams`
- Mobile: Uses Expo Linking + `useURL()` hook
- Shared logic in `packages/shared/deepLinks.ts`

### Navigation Patterns

- **Bottom Tab Navigation** (Mobile): Chat, Inventory, Auctions, Profile
- **Top Navigation + Sidebar** (Web + Tablet): More desktop-like experience
- **Contextual Navigation**: Widgets can trigger navigation (e.g. "View full report" opens a new screen or expands inline)

The system supports both **in-chat navigation** (staying inside the chat view) and **full-screen navigation** when appropriate.

## Performance & Optimization

Performance is critical for both web and mobile experiences, especially when dealing with rich widgets, real-time updates, and large datasets (inventory, auctions, reports).

### Key Performance Strategies

**1. Code Splitting & Lazy Loading**
- Widgets are lazy-loaded on demand (only loaded when needed)
- Heavy components (maps, charts, AR views) are dynamically imported
- Route-based code splitting (Next.js + Expo Router)

**2. Data Fetching & Caching**
- React Query with smart stale-while-revalidate strategy
- Background refetching for critical data (active auctions, user plan)
- Optimistic updates for non-critical actions

**3. Bundle Size Optimization**
- Tree-shaking and dead code elimination
- Shared `packages/ui` components are optimized for both web and native
- NativeWind purging for unused styles

**4. Rendering Performance**
- React.memo and useMemo for expensive widgets
- Virtualized lists for large inventory/auction views (FlashList on mobile, react-window on web)
- Reanimated for smooth 60fps animations on mobile

**5. Network Optimization**
- Request deduplication
- Compression and caching headers
- Prefetching of likely-next data (e.g. prefetch inventory when user opens auction screen)

### Performance Budgets (Targets)

| Metric                    | Web Target     | Mobile Target   |
|---------------------------|----------------|-----------------|
| Time to Interactive       | < 2.5s         | < 3.0s          |
| First Contentful Paint    | < 1.5s         | < 2.0s          |
| Interaction to Next Paint | < 200ms        | < 300ms         |
| Bundle Size (initial)     | < 250KB        | < 4MB (native)  |

These targets are monitored via Lighthouse (web) and Expo Performance tools (mobile).

## Theming & Branding

The UI Layer supports flexible theming and strong branding capabilities to serve different users and business needs.

### Theming System

We use a **design token-based theming system** powered by NativeWind + CSS variables.

**Supported Themes:**
- **Light / Dark mode** (system preference + manual toggle)
- **Yard-specific branding** (custom primary color, logo, and accent colors per yard)
- **Plan-based themes** (higher-tier plans get enhanced visual options)

Theme configuration is stored in `user_plans` and applied globally via CSS variables and React context.

### Branding

- Each yard can upload a logo and set brand colors
- The UI dynamically applies these via CSS custom properties
- Email and notification templates also respect yard branding

## Error Handling & User Feedback

Clear, consistent, and actionable error handling is essential for building user trust, especially when dealing with AI systems and external integrations.

### Error Categories

We classify errors into three levels:

| Level     | User Visibility | Example |
|-----------|------------------|---------|
| **Critical** | Blocking modal or full-screen message | Network failure, authentication error, quota exceeded |
| **Warning**  | Toast or inline message | Tool temporarily unavailable, partial data loaded |
| **Info**     | Subtle indicator | Background sync in progress, cached data shown |

### Error Handling Principles

1. **Never show raw technical errors** to users
2. **Always provide a clear next action** (Retry, Contact support, Upgrade, etc.)
3. **Log everything** for debugging (with full context)
4. **Graceful degradation** — the app should continue working even if one widget or feature fails

### User Feedback Patterns

**Success:**
- Subtle checkmark + message (e.g. "Location updated")
- Auto-dismiss after 2–3 seconds

**Loading:**
- Skeleton loaders for content
- Progress indicators for long-running actions
- "Thinking..." indicators for LLM responses

**Failure:**
- Clear explanation of what went wrong
- Suggested next step
- Option to report the issue (with context pre-filled)

### Implementation

We use a centralized error boundary and toast system (`useToast` hook) that works consistently across web and mobile. All API errors are normalized in `packages/shared/apiClient.ts` before reaching the UI.

## Async Task Handling & Safe Message Injection

Modern AI applications frequently need to perform long-running operations (report generation, bulk analysis, external data processing) without blocking the user. The UI Layer must support **asynchronous task handling** with safe, reliable result injection back into the conversation.

### The Pattern

When a user triggers a long-running task:

1. **Immediate Acknowledgment** — The UI shows a clear message: *"Generating report... You can keep working — I'll notify you when it's ready."*
2. **Background Job Creation** — A job is created in the `background_jobs` table with `job_id`, `contextId`, `user_id`, and `status`.
3. **User Continues Normally** — The user can switch `focus_state`, use other widgets, or start new conversations.
4. **Completion Notification** — When the job finishes, the backend publishes a completion event to the realtime channel (`context:{contextId}`).
5. **Safe Injection** — The result is injected into the chat as a properly typed message with rich metadata.

### Safe Message Injection Strategy

To prevent corruption of normal chat flow and memory handling, we use **explicit message typing** and **rich metadata**.

#### Message Types

We define the following `message_type` values in `conversation_messages`:

| `message_type`              | Source                  | Description |
|-----------------------------|-------------------------|-----------|
| `user`                      | Human                   | Normal user input |
| `assistant`                 | LLM                     | Normal agent response |
| `system`                    | System                  | Normal system messages |
| `system_async_result`       | Background Job          | Result of a long-running async task |
| `system_notification`       | External Event Worker   | Notification injected from external systems |
| `tool_result`               | Tool execution          | Output from tool calls |
| `widget_injection`          | Widget system           | Rich widget rendered in chat |

#### Required Metadata on Injected Messages

Every injected message must include:

```json
{
  "message_type": "system_async_result",
  "source": "background_job",
  "job_id": "job_xyz789",
  "context": "profitability_report_90d",
  "labels": ["async_result", "report"],
  "importance_score": 0.85,
  "created_by": "async_worker"
}
```

This metadata enables:
- Intelligent handling by the Memory Management system (summarization, compaction, decay)
- Proper rendering by widgets
- Full traceability in observability
- Filtering and prioritization

### Integration with Memory Management

Injected messages (`system_async_result`, `system_notification`) are treated as first-class citizens in memory:

- They go through the normal summarization and compaction pipelines
- They can be tagged with `labels` so the summarizer knows how to handle them (e.g. keep high-importance async results longer)
- They are included in `memory_summary` when relevant to the current `focus_state`

### Integration with Observability

Every async task and injected message is fully traced:

- Job creation, progress, and completion are logged with `contextId`
- Message injection events are logged with `source`, `job_id`, and `message_type`
- Full decision traceability is maintained (`decision`, `reason`, `input`, `output`)

### Example Use Cases

**1. Long-Running Report Generation**
- User: "Generate full 90-day profitability report for all Hondas"
- UI: *"Generating report... I'll notify you when it's ready."*
- Background job runs
- On completion: A `system_async_result` message with a rich `ValuationReportWidget` is injected into the chat

**2. External System Notification**
- Copart sends a high-value auction update via webhook
- Event Worker processes it and decides it should appear in the user's current chat
- A `system_notification` message is injected with auction details and quick actions

This pattern keeps the chat coherent while allowing powerful asynchronous capabilities.

## Extensibility

The UI Layer is designed to evolve gracefully as the product grows — from new widgets to new platforms and future SME agents.

### Adding New Widgets

New widgets can be added with minimal friction:

1. Create a new component in `packages/widgets/`
2. Define its input schema, subscription channels, and rendering logic
3. Register it in the central Widget Registry (with metadata like `compatible_focus_states` and `required_features`)
4. The widget becomes automatically available when conditions are met

No changes to the core chat or navigation system are required.

### Dynamic Widget Discovery

Widgets are **not hardcoded**. They are discovered and rendered based on:

- Current `focus_state`
- User’s `effective_features`
- Active `contextId` signals

Example: When `focus_state` changes to `"auction_bidding_session"`, the system automatically loads and displays the `ActiveBiddingWidget` and `AuctionTimerWidget`.

This makes the UI highly contextual and reduces development effort when adding new focus areas.

### Supporting New Platforms

The architecture supports future platforms with minimal changes:

- **Desktop** — Can be added later using Tauri or Electron with the same shared `packages/ui` and `packages/widgets`
- **Voice / Smart Speakers** — Future voice interface can reuse the same widget logic and backend subscriptions
- **Wearables** — Smartwatch companions can subscribe to a subset of realtime channels

The monorepo structure and shared component system make cross-platform expansion much easier.

### Third-Party & Internal Plugins

In the future, we may want to allow:
- Internal teams to build custom widgets for specific yards
- External partners to develop specialized widgets (e.g. fleet management, compliance reporting)

The Widget Registry and subscription model are designed to support this plugin-style extensibility while maintaining security and performance guardrails.

### Versioning & Backward Compatibility

As the widget system evolves, we will maintain backward compatibility:

- Widget API versioning (e.g. `v1`, `v2`)
- Graceful fallback for older widgets
- Migration tools and documentation for widget developers

This ensures we can improve the system over time without forcing constant updates to existing widgets.

### Integration with Future SME Agents

When we introduce specialized SME agents (e.g. Auction Intelligence Agent, Valuation Agent, Inventory Agent), the UI Layer will:

- Automatically surface agent-specific widgets based on the active agent
- Support multi-agent views (e.g. side-by-side widgets from different agents)
- Allow agents to inject their own contextual widgets into the chat

The extensible widget system is a key enabler for the multi-agent future described in `future-evolution.md`.

## Dev-Mode Annotations (UI Feature)

In development mode only (`NODE_ENV === 'development'`), the UI provides a built-in ability to add annotations directly to the chat interface. This is a developer productivity feature that allows you to mark, comment on, or flag specific messages or portions of the conversation. These annotations are saved and included in the Langfuse trace.

### How It Works

- When running in dev mode, each message in the chat shows a small **"Annotate"** icon or context menu option.
- You can select one message or a range of messages and add a free-text annotation (e.g. "This response hallucinated the part ID", "Good bidding suggestion", "Entity resolution failed here").
- You can also add tags or severity levels (info, warning, error).
- The annotation is sent to the backend as metadata attached to the message.
- The backend stores it only in development mode and attaches it to the corresponding Langfuse trace/observation as custom metadata.
- When you pull a trace (`task trace:pull <traceId>`), the exported JSON includes an `annotations` array for each relevant message.

### User Experience

- Annotations appear inline in the chat (lightly highlighted or with a small note icon).
- They are visible only in dev mode — completely hidden in production builds.
- Annotations can be edited or deleted during the session.
- They persist in the trace even if the chat is closed and reopened.

This feature makes debugging and trace analysis significantly faster because your own observations travel with the trace data.

### Technical Implementation

- The UI only shows the annotation UI when `process.env.NODE_ENV === 'development'`.
- Annotations are sent via the same message endpoint used for programmatic injection (see request-flow.md).
- The backend safely strips annotations in production and only processes them in dev mode.
- Annotations are stored as structured metadata in Langfuse (not in the main conversation history table) to keep production clean.

This is one of the most valuable developer tools in the system for rapid iteration and debugging.

## Summary

The UI Layer of the AI Yard Assistant is designed as a modern, composable, and future-proof interface that delivers a consistent experience across **Web, Mobile, and Tablet**.

Key highlights of this architecture include:

- **Composable Widget System** — Rich, self-contained, event-driven widgets that can be dynamically loaded based on `focus_state` and `effective_features`.
- **Write Once, Deploy Everywhere** — A React Native + Next.js monorepo with shared UI components and logic, enabling high-quality experiences on all platforms.
- **Real-time & Asynchronous Support** — Widgets can subscribe to live updates, and long-running tasks can safely inject results back into the chat without disrupting normal flow.
- **Push Notifications** — First-class support across web and mobile with deep linking and user-configurable preferences.
- **Security & Flexibility** — Optional MFA, support for Google/Apple/Microsoft login, and feature-gated capabilities via `effective_features`.
- **Extensibility** — Designed to easily accommodate new widgets, new platforms, third-party plugins, and future SME agents.

This UI Layer works in tight integration with the rest of the architecture — consuming `ThreadContext`, respecting `effective_features`, participating in observability, and supporting both synchronous and asynchronous workflows.

The result is a responsive, contextual, and highly interactive interface that feels alive and intelligent while remaining maintainable and scalable as the system evolves.
