# Task Plan: Setup Cutting Edge React-Style Chat Application Foundation
<!-- 
  WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk."
  WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh.
  WHEN: Create this FIRST, before starting any work. Update after each phase completes.
-->

## Goal
Setup the right directory and build structure for a cutting-edge clean React-style chat application using the tech stack defined in docs/initial-setup/tech-stack-and-approach.md, including:
1. Proper tracing with LangSmith via Docker locally
2. Sophisticated prompt routing system with hybrid selection (hard rules → state-based → LLM fallback)
3. Modular prompting architecture with prompt registry and contracts
4. Taskfile for build/deploy
5. All sensitive configs in .env file
6. Following modern best practices for agent systems

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
<!-- 
  WHAT: Understand what needs to be done and gather initial information.
  WHY: Starting without understanding leads to wasted effort. This phase prevents that.
-->
- [x] Read and understand tech-stack-and-approach.md
- [x] Read and understand tracing-approach.md  
- [x] **CRITICAL: Read and understand prompting.md and prompt-selection-lqyer.md**
- [x] Understand constraints: .env for configs, local deployment first, Taskfile for builds
- [x] Document findings in findings.md
- **Status:** complete
<!-- 
  STATUS VALUES:
  - pending: Not started yet
  - in_progress: Currently working on this
  - complete: Finished this phase
-->

### Phase 2: Planning & Structure
<!-- 
  WHAT: Decide how you'll approach the problem and what structure you'll use.
  WHY: Good planning prevents rework. Document decisions so you remember why you chose them.
-->
- [ ] Define project architecture based on tech stack docs
- [ ] **CRITICAL: Design prompt system architecture (registry, contracts, routing)**
- [ ] Create directory structure blueprint that accommodates prompt system
- [ ] Choose tooling versions and dependencies
- [ ] Plan LangSmith Docker setup
- [ ] Plan Taskfile structure
- [ ] Document decisions with rationale
- **Status:** in_progress

### Phase 3: Implementation - Project Setup
<!-- 
  WHAT: Actually build/create/write the solution.
  WHY: This is where the work happens. Break into smaller sub-tasks if needed.
-->
- [ ] Initialize Next.js project with TypeScript
- [ ] Install core dependencies (Vercel AI SDK, LangGraph JS, etc.)
- [ ] Setup OpenTelemetry instrumentation
- [ ] Configure environment variables structure
- [ ] Create Taskfile.yml
- [ ] Setup Docker for LangSmith
- [ ] Create basic project structure
- **Status:** pending

### Phase 4: Implementation - Prompt System Foundation
<!-- 
  WHAT: Build the sophisticated prompt routing and modular prompt system
  WHY: This is the core intelligence of our application - critical from docs
-->
- [ ] Create prompt registry structure with versioning
- [ ] Implement hybrid prompt selection layer (hard rules → state-based → LLM fallback)
- [ ] Define prompt contracts with clear input/output schemas
- [ ] Create core prompt set (classify_intent, detect_pivot, update_focus, etc.)
- [ ] Setup prompt routing logging for LangSmith
- **Status:** pending

### Phase 5: Implementation - Core Features
<!-- 
  WHAT: Build core application components
  WHY: Implement the key architectural layers
-->
- [ ] Create chat transport layer (Next.js API route)
- [ ] Setup agent runtime layer (LangGraph JS) with prompt routing integration
- [ ] Create tool execution layer foundation
- [ ] Setup async job layer structure
- [ ] Create widget protocol implementation
- [ ] Implement memory tiers structure
- **Status:** pending

### Phase 5: Testing & Verification
<!-- 
  WHAT: Verify everything works and meets requirements.
  WHY: Catching issues early saves time. Document test results in progress.md.
-->
- [ ] Verify build system works
- [ ] Test OpenTelemetry setup
- [ ] Verify LangSmith Docker setup
- [ ] Test Taskfile commands
- [ ] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** pending

### Phase 6: Delivery
<!-- 
  WHAT: Final review and handoff to user.
  WHY: Ensures nothing is forgotten and deliverables are complete.
-->
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Create final README with setup instructions
- [ ] Deliver to user
- **Status:** pending

## Key Questions
<!-- 
  WHAT: Important questions you need to answer during the task.
  WHY: These guide your research and decision-making. Answer them as you go.
  EXAMPLE: 
    1. Should tasks persist between sessions? (Yes - need file storage)
    2. What format for storing tasks? (JSON file)
-->
1. Should we use Next.js App Router or Pages Router? (Based on docs: App Router)
2. Which specific versions of dependencies should we use? (Latest stable)
3. How to structure the LangSmith Docker setup? (Use official LangSmith Docker image)
4. Should we use pnpm, npm, or yarn? (pnpm for speed and disk efficiency)
5. How to structure Taskfile for maximum utility? (Modular with common tasks)

## Decisions Made
<!-- 
  WHAT: Technical and design decisions you've made, with the reasoning behind them.
  WHY: You'll forget why you made choices. This table helps you remember and justify decisions.
  WHEN: Update whenever you make a significant choice (technology, approach, structure).
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
-->
| Decision | Rationale |
|----------|-----------|
| We'll use Next.js App Router | Recommended in tech stack docs for modern React applications |
| We'll use TypeScript throughout | Provides type safety for complex AI/agent code |
| We'll use pnpm as package manager | Fast, disk-efficient, good monorepo support for future scaling |
| We'll structure project with clear layer separation | Follows the 4-layer architecture from tech stack docs |
| We'll use Docker Compose for LangSmith | Simplifies local development with multiple services |

## Errors Encountered
<!-- 
  WHAT: Every error you encounter, what attempt number it was, and how you resolved it.
  WHY: Logging errors prevents repeating the same mistakes. This is critical for learning.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | FileNotFoundError | 1 | Check if file exists, create empty list if not |
    | JSONDecodeError | 2 | Handle empty file case explicitly |
-->
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
<!-- 
  REMINDERS:
  - Update phase status as you progress: pending → in_progress → complete
  - Re-read this plan before major decisions (attention manipulation)
  - Log ALL errors - they help avoid repetition
  - Never repeat a failed action - mutate your approach instead
-->
- This is the foundation of our software - must take time and get it right
- All sensitive API keys/configs go in .env file in root
- We'll be building and deploying locally first, then later to internet-accessible app
- We MUST ask for guidance if we have important decisions
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition