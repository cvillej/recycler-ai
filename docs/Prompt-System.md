---
title: Prompt System Documentation
tags: [obsidian, recycle-ai, prompt-system]
published: true
---

# Prompt System Overview

Modular, contract-driven prompts with registry. Combines hard rules, state-based, LLM fallback.

## Purpose
Modular prompting and hybrid routing. Each prompt is versioned, contract-governed.

## Key Features
- Modular design.
- Versioned.
- Contract enforcement (input/output Zod).
- Registry structure.

## Prompt Registry Structure
```
prompts/
  v1/
    classify-intent.prompt.md
    classify-intent.contract.ts
    ...
```

## Core Prompts
- classify_intent
- detect_pivot
- update_focus
- plan_next_step
- execute_tool_reasoning
- analyze_results
- respond

## Implementation Requirements
1. Prompt module conventions (text, schemas, version, tests).
2. Input/Output contracts.
3. Test vectors.

## Related Topics
- [[LangGraph Orchestration]]
- [[Hybrid Prompt Router]]
- [[Agent State]]