# Findings & Decisions
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

## Requirements
<!-- 
  WHAT: What the user asked for, broken down into specific requirements.
  WHY: Keeps requirements visible so you don't forget what you're building.
  WHEN: Fill this in during Phase 1 (Requirements & Discovery).
  EXAMPLE:
    - Command-line interface
    - Add tasks
    - List all tasks
    - Delete tasks
    - Python implementation
-->
<!-- Captured from user request -->
1. Build a cutting edge clean React-style chat application
2. Use tech stack defined in tech-stack-and-approach.md:
   - Next.js + TypeScript on Vercel for app shell
   - Vercel AI SDK for chat/UI layer
   - LangGraph JS for backend agent runtime
   - 4-layer architecture: chat transport, agent runtime, tool execution, async job
3. Use tracing approach defined in tracing-approach.md:
   - OpenTelemetry everywhere as canonical instrumentation
   - LangSmith for AI-specific trace view
   - Run LangSmith using Docker locally
4. **CRITICAL: Implement sophisticated prompt system from prompting.md and prompt-selection-lqyer.md:**
   - Modular prompting / composable prompts / prompt routing
   - Small prompts that outperform "god prompts"
   - Hybrid prompt selection: hard rules → state-based → LLM fallback
   - Prompt registry with versioning and contracts
   - Prompts as pure functions, system as state machine
5. Store all sensitive API keys/configs in .env file in root
6. No hardcoding of environment-dependent values
7. Build and deploy locally first, later deploy to internet-accessible app
8. Use Taskfile for build, deploy, and development tasks
9. This is the foundation - must take time and get it right
10. Must ask for guidance on important decisions

## Research Findings
<!-- 
  WHAT: Key discoveries from web searches, documentation reading, or exploration.
  WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately.
  WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule).
  EXAMPLE:
    - Python's argparse module supports subcommands for clean CLI design
    - JSON module handles file persistence easily
    - Standard pattern: python script.py <command> [args]
-->
<!-- Key discoveries during exploration -->
### From tech-stack-and-approach.md:
- Frontend/UI: Next.js App Router, React + TypeScript, Vercel AI SDK UI hooks/components
- Backend runtime: Vercel Functions, Fluid Compute, Vercel Queues
- Model/runtime: Vercel AI SDK, OpenAI Responses API or other providers
- Agent orchestration: LangGraph JS (not plain LangChain)
- 4-layer architecture: chat transport, agent runtime, tool execution, async job
- Architecture emphasizes explicit state outside LLM, schema-driven widgets, three memory tiers
- Critical to avoid: plain LangChain-only orchestration, letting tools decide terminal vs non-terminal, putting all memory into prompts

### From tracing-approach.md:
- Layer 1: OpenTelemetry everywhere as canonical instrumentation
- Layer 2: LangSmith for AI-specific trace view plus one place to read it for humans
- Use @vercel/otel for Next.js/Vercel OpenTelemetry initialization

### **CRITICAL: From prompting.md & prompt-selection-lqyer.md:**
1. **Modular Prompting Philosophy:**
   - Small prompts outperform "god prompts" (easier to debug, trace, evolve)
   - Prompts should be pure functions that read state and propose updates
   - Orchestrator (not prompts) owns truth and decides what becomes truth
   - System is a state machine, prompts are deterministic-ish transforms

2. **Hybrid Prompt Selection (3-layer routing):**
   - **Layer 1: Hard rules** - Deterministic guards (approval required, safety stop, retry limits)
   - **Layer 2: State-based routing** - Workflow decisions based on explicit state (focus, active task, tool results)
   - **Layer 3: LLM routing** - Semantic fallback for ambiguity only
   - Priority: hard rules → state → LLM fallback

3. **Prompt Registry & Contracts:**
   - Prompts should be versioned, testable, traceable in LangSmith
   - Each prompt needs clear input/output schemas (prompt contracts)
   - Registry should contain interpretation, workflow, and response prompts

4. **Core System Design:**
   - Your system is a state machine. Prompts are pure functions.
   - LangGraph = execution engine
   - Prompts = deterministic-ish transforms
   - State = source of truth
   - Tools = side effects
   - UI = projection of state

5. **Key Implementation Patterns:**
   - Router chooses next cognitive function, not final answer
   - LLM router should be narrow and constrained
   - All routing decisions must be logged with reasons for LangSmith
   - State must be explicit for hybrid routing to work

## Technical Decisions
<!-- 
  WHAT: Architecture and implementation choices you've made, with reasoning.
  WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge.
  WHEN: Update whenever you make a significant technical choice.
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
    | argparse with subcommands | Clean CLI: python todo.py add "task" |
-->
<!-- Decisions made with rationale -->
| Decision | Rationale |
|----------|-----------|
| Use Next.js App Router | Recommended in tech stack docs, modern React applications |
| TypeScript throughout | Complex AI/agent code benefits from type safety |
| pnpm as package manager | Fast, disk-efficient, good monorepo support |
| Clear layer separation | Follows 4-layer architecture from docs: chat transport, agent runtime, tool execution, async job |
| **Implement hybrid prompt selection first** | **CRITICAL: Prompt system is core intelligence of app per docs** |
| **Prompt registry with contracts** | **Ensures testable, versionable, debuggable prompts** |
| **State-first architecture** | **Prompts read state, propose updates; orchestrator decides truth** |
| Docker Compose for LangSmith | Simplifies local development with LangSmith service |
| Modular Taskfile structure | Makes common tasks reusable and consistent |
| Environment variables in .env.local (not .env) | Next.js convention, prevents accidental commits |
| Structured logging with Pino | Better performance and structure than console.log |
| Zod for validation | Type-safe schema validation for API inputs and tool calls |
| **Explicit agent state schema** | **Required for hybrid routing to work correctly** |
| **LangGraph with conditional edges** | **Implements hybrid routing: hard rules → state → LLM fallback** |

## Issues Encountered
<!-- 
  WHAT: Problems you ran into and how you solved them.
  WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors).
  WHEN: Document when you encounter blockers or unexpected challenges.
  EXAMPLE:
    | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() |
-->
<!-- Errors and how they were resolved -->
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
<!-- 
  WHAT: URLs, file paths, API references, documentation links you've found useful.
  WHY: Easy reference for later. Don't lose important links in context.
  WHEN: Add as you discover useful resources.
  EXAMPLE:
    - Python argparse docs: https://docs.python.org/3/library/argparse.html
    - Project structure: src/main.py, src/utils.py
-->
<!-- URLs, file paths, API references -->
- Vercel AI SDK: https://sdk.vercel.ai/docs
- LangGraph JS: https://langchain-ai.github.io/langgraphjs/
- OpenTelemetry: https://opentelemetry.io/
- LangSmith: https://docs.smith.langchain.com/
- Taskfile: https://taskfile.dev/
- Next.js: https://nextjs.org/docs
- Docker Compose: https://docs.docker.com/compose/
- pnpm: https://pnpm.io/

## Visual/Browser Findings
<!-- 
  WHAT: Information you learned from viewing images, PDFs, or browser results.
  WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text.
  WHEN: IMMEDIATELY after viewing images or browser results. Don't wait!
  EXAMPLE:
    - Screenshot shows login form has email and password fields
    - Browser shows API returns JSON with "status" and "data" keys
-->
<!-- CRITICAL: Update after every 2 view/browser operations -->
<!-- Multimodal content must be captured as text immediately -->

---

<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*