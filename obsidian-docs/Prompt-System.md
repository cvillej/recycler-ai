---

title: Prompt System Documentation
tags: [obsidian, recycle-ai, prompt-system]
published: true
---

# Prompt System Overview

The Prompt System is a crucial aspect of the Recycle AI architecture, defining how cognitive functions are executed through modular prompts. Each prompt serves as a distinct, versioned, and contract-governed component within the agent's workflow.

## Purpose
Each prompt is designed to facilitate specific tasks such as intent classification, focus detection, planning, and responding.

## Key Features
- **Modular Design**: Each prompt is treated as a first-class module.
- **Versioned**: Prompts are versioned to maintain clarity and allow upgrades as needed.
- **Contract Enforcement**: Ensure that each prompt adheres to clearly defined input and output schemas.

## Prompt Registry Structure
- Each prompt is represented as an individual module, with a dedicated contract defining its capabilities and requirements. 

### Example Structure
```
prompts/
  v1/
    classify-intent.prompt.md
    classify-intent.contract.ts
    detect-pivot.prompt.md
    detect-pivot.contract.ts
    ...
```

## Explicit Implementation Requirements
### 1. Prompt Module File Conventions
- Each tool is to be defined in its module structured as follows:
  - Prompt text (in Markdown or string format)
  - Input schema (using Zod or JSON-schema)
  - Output schema
  - Version string and description
  - Test vectors as needed.

### 2. Core Prompt Definitions
- A minimal set for a robust agent includes:
  - `classify_intent`
  - `detect_pivot`
  - `update_focus`
  - `plan_next_step`
  - `execute_tool_reasoning`
  - `analyze_results`
  - `respond`

### 3. Input/Output Contracts
- Input and output schemas must be clearly defined and enforced.

### 4. Test Vectors
- Each prompt should include predefined valid and invalid test cases.

## Related Topics
- For information on how prompts fit into the overall workflow, see [[LangGraph Orchestration]].
- Details on the control flow of prompts can be found in [[Hybrid Prompt Router]].
- For the UI interactions prompted by these modules, check [[UI Layer]].

---
