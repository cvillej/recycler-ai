# external-system-integration.md
**Version:** April 20, 2026  
**Status:** Draft (Zoom Level 2)

This document defines the architecture for how the AI Yard Assistant interacts with external systems. It covers ingress (data coming in), egress (data going out), event processing, and the decision framework for when to persist data versus stream it in real time.

## Purpose of External System Integration

The AI Yard Assistant must reliably exchange data with many external systems, including:

- Auction platforms (Copart, IAAI)
- Inventory scanners and location systems
- Market data providers (eBay, pricing APIs)
- Billing systems (Stripe)
- Notification channels (email, SMS, push)
- Future SME agents and partner systems

This document establishes a clean, scalable, and observable architecture that supports multiple ingress patterns (REST, streaming, queuing) while maintaining control, auditability, and performance.

## Core Principles

1. **Single Event Bus** — All external events eventually flow through a central event processing layer.
2. **Decoupled Ingress & Egress** — External systems should not need to know about internal widgets, real-time channels, or business logic.
3. **Intelligent Routing** — The system decides whether to save to the database, push to real-time widgets, trigger notifications, or call other external systems.
4. **Full Observability** — Every ingress and egress event is traced with `contextId` and rich metadata.
5. **Security & Governance** — All external interactions are gated by `effective_features` and properly authenticated.
6. **Extensibility** — New external systems and integration patterns can be added without major architectural changes.

## Architecture Overview

We use a layered, event-driven architecture:
