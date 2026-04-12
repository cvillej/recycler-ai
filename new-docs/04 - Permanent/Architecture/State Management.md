---
template: Recycler Note Template
type: architecture-state
tags: [recycle-ai, architecture]
created: {{date:YYYY-MM-DD}}
updated: {{date:YYYY-MM-DD}}
status: stable
---

# State Management

**Purpose**  
Defines and manages explicit agent state using Zod schemas and TypeScript types.  

**Key Concepts**
- State is the source of truth, not prompts.  
- Utilizes Zod schemas for type enforcement.  

**Links to Related Concepts**
- [[Prompt System|How the Prompt System consumes and updates AgentState]]`
- [[State Schema Evolution|How state schema changes are handled with migrations]]`  

**Backlinks**