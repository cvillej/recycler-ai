# Overview of Hybrid Prompt Router

The Hybrid Prompt Router is a core component of the Recycler AI architecture, enabling decision-making through multiple routing phases.

- **Deterministic Hard Rules**: Initial gates that lead to predictable responses.
- **State-Based Decisions**: Dynamic routing based on the agent's current state.
- **LLM Fallback**: Uses language models for ambiguity resolution.

This document accompanies the [Hybrid Router Extensions](../Extensibility/Hybrid Router Extensions.md) guide where further custom rule extensions are documented.