
**Next.js + TypeScript on Vercel for the app shell, Vercel AI SDK for the chat/UI layer, and LangGraph JS for the backend agent runtime.** That gives you a React-native frontend experience, typed tool calling, streaming, durable state, checkpoints, and human-in-the-loop control without forcing your whole system into a heavyweight multi-service architecture. Vercel’s AI SDK is built for TypeScript apps and integrates with React/Next.js, while LangGraph JS is specifically designed for long-running, stateful, interruptible agent workflows with persistence and memory. ([Vercel][1])

My **ideal stack** for your use case would look like this:

**Frontend/UI**

* **Next.js App Router**
* **React + TypeScript**
* **Vercel AI SDK UI hooks/components** for streaming chat, tool state, structured messages, and widget rendering
* Optional: **AI Elements** for production-ready AI UI components if you want faster polish on chat/tool displays. Vercel positions AI Elements as React components integrated with AI SDK hooks such as `useChat`, including support for streaming and tool displays. ([Vercel][1])

**Backend runtime**

* **Vercel Functions** for your API routes and orchestrator endpoints
* **Fluid Compute** enabled for better concurrency/AI workloads
* **Vercel Queues** for durable async jobs, retries, and long-running tool tasks that should not block an interactive turn. Vercel documents Functions as well suited to AI workloads, Fluid Compute as its more flexible execution model, and Queues as durable async processing with retries and at-least-once delivery. ([Vercel][2])

**Model/runtime layer**

* **Vercel AI SDK** as the provider abstraction and streaming layer
* **OpenAI Responses API** or other providers behind that
* Use **function calling** for your custom tools
* Use **background mode** only for truly long-running model tasks, not as your main app control plane. OpenAI’s Responses API supports stateful interactions, built-in tools, and function calling, and background mode is intended for long-running jobs. ([OpenAI Developers][3])

**Agent orchestration**

* **LangGraph JS**, not plain LangChain, as the core state machine
* Model each run as a graph with explicit state
* Use **checkpoints/threads** for per-conversation persistence
* Use **interrupts** for review/approval/pause/resume flows
* Use **streaming** from the graph to the UI for intermediate state and tool progress. LangGraph’s JS docs explicitly call out persistence checkpoints, threads, interrupts, streaming, short-term memory, and durable execution as core features. ([LangChain Docs][4])

## Why this is the best fit

The main reason is that you want **more than just chat**. You want memory, state, focus, pivot detection, tool calling, and UI widgets that can be driven by model/tool output. That is really an **agent runtime problem plus a UI protocol problem**.

* **Vercel AI SDK** is excellent for the **UI protocol**: streaming tokens, structured outputs, tool calls, provider abstraction, and React integration. ([Vercel][1])
* **LangGraph** is excellent for the **runtime/orchestration**: state machine, checkpoints, interruptions, resumability, memory, and fault tolerance. ([LangChain Docs][5])

If you try to do everything with just “chat + tools” and no explicit graph/state model, the app gets messy fast. Focus management, pivot detection, pending actions, tool retries, and UI widget lifecycles all become ad hoc. LangGraph gives you a clean place for that logic. ([LangChain Docs][5])

## Recommended architecture

Think in **four layers**:

### 1. Chat transport layer

This is your Next.js route that streams events to the client.

Responsibilities:

* authenticate user/session
* load conversation/thread id
* send user input into the agent runtime
* stream back:

  * assistant text deltas
  * tool call started/completed events
  * widget payloads
  * state-change events
  * “needs user approval” interrupts

This is where **AI SDK + React** shines. ([Vercel][1])

### 2. Agent runtime layer

This should be **LangGraph JS**.

Your graph state might include:

* `messages`
* `threadId`
* `workingMemory`
* `userProfileMemory`
* `currentFocus`
* `activePlan`
* `pivotSignals`
* `pendingToolCalls`
* `uiArtifacts`
* `requiresApproval`
* `toolResults`
* `sessionContext`

Then define nodes like:

* `classify_intent`
* `update_focus`
* `detect_pivot`
* `retrieve_memory`
* `plan_next_step`
* `execute_tool`
* `summarize_tool_result`
* `emit_widget`
* `checkpoint`
* `await_user_input`

That maps directly onto LangGraph’s strengths: stateful threads, persistence, human-in-the-loop interrupts, and streaming. ([LangChain Docs][4])

### 3. Tool execution layer

Keep tools as **typed server-side functions** behind a strict registry.

For example:

* `queryDatabase`
* `searchDocs`
* `createTicket`
* `runSqlReport`
* `fetchUserWorkspace`
* `saveMemory`
* `renderWidgetData`

Every tool should have:

* Zod/JSON-schema input validation
* narrow output shape
* auth scope
* timeout budget
* idempotency key if it can be retried
* audit log entry

AI SDK has strong typed tooling support, and tool/function calling is also natively supported by the OpenAI Responses API. ([Vercel][6])

### 4. Async job layer

Anything slow or flaky goes to **Vercel Queues**:

* deep searches
* report generation
* expensive memory consolidation
* large data fetches
* multi-step workflows
* periodic summarization

Use Vercel Functions for the request path and Queues for background processing. For model-only long tasks, OpenAI background mode is also an option, but for app-owned workflows I would usually prefer your own queue-based control plane. ([Vercel][7])

## How I would handle your specific concerns

### Tool-calling VMs on the backend

I would **not** start with actual per-tool VMs unless you truly need hard isolation or custom runtimes. Start with:

* Vercel Functions for most tools
* separate worker endpoints/consumers for heavy tools
* optional dedicated containerized services only for special cases

Vercel Functions with Fluid Compute are already aimed at scalable server-side AI and I/O-heavy workloads. Actual “VM per tool” adds a lot of ops overhead early. ([Vercel][2])

### “Single React-style backend like Claude Code”

I’d interpret that as: the UI should feel live, stateful, and event-driven, with the backend acting like one continuous thinking loop.

Best implementation:

* one **thread-scoped graph run** per user turn
* stream intermediate events to the frontend
* persist graph state after each meaningful step
* resume from checkpoint on next turn or after approval

That is almost exactly the kind of pattern LangGraph’s persistence, threads, interrupts, and streaming are designed for. ([LangChain Docs][4])

### LLM-calling widgets in the UI

Do **not** let the model render arbitrary components directly.

Instead, use a **widget protocol**:

* model/tool returns a typed `widgetIntent`
* server validates it
* UI maps it to an approved component

Example:

```ts
type WidgetIntent =
  | { type: "table"; dataSource: "tool:queryDatabase"; columns: string[] }
  | { type: "chart"; title: string; series: Array<{x: string; y: number}> }
  | { type: "record_card"; recordId: string }
  | { type: "approval"; actionId: string; summary: string };
```

Then your React app renders only from this schema. That keeps the system safe, debuggable, and stable while still feeling dynamic. AI SDK’s UI stack is a good fit for structured tool/display flows. ([Vercel][1])

### Memory

Use **three memory tiers**:

1. **Thread memory**

   * current conversation
   * pending goals
   * active focus
   * unresolved references

2. **User memory**

   * stable preferences
   * recurring entities
   * app-specific settings

3. **Derived memory**

   * summaries
   * embeddings / retrieval docs
   * episodic “what happened recently”

LangGraph explicitly separates short-term memory in thread-scoped state and supports longer-term memory patterns across sessions. ([LangChain Docs][8])

### State

Keep **explicit application state** outside the LLM. The model can propose updates, but your runtime owns truth.

Good state buckets:

* conversation state
* focus state
* workflow state
* tool state
* UI state
* memory state

That is another reason I would choose LangGraph over “just a loop.” Its graph/state model makes this natural. ([LangChain Docs][9])

### Focus and pivot detection

Do not leave this purely implicit in the prompt.

Create a dedicated classifier node that outputs:

* `focus_topic`
* `focus_confidence`
* `pivot_detected`
* `pivot_type`
* `carry_forward_items`

For example:

* “same task, deeper”
* “same domain, different objective”
* “hard pivot”
* “returning to prior thread”

Then update graph state accordingly. That belongs in the orchestrator graph, not inside arbitrary tools. LangGraph’s explicit state/checkpoint model is what makes this maintainable over time. ([LangChain Docs][4])

## Concrete stack I would actually ship

If I were building this today, I’d use:

* **Next.js**
* **TypeScript**
* **Vercel**
* **Vercel AI SDK**
* **LangGraph JS**
* **Zod**
* **your existing database**
* **Vercel Functions**
* **Fluid Compute**
* **Vercel Queues**
* **OpenAI Responses API** plus whichever second provider you want for fallback

That is the “ideal default” for the shape of app you described. It stays mostly TypeScript, works naturally on Vercel, supports rich React chat UIs, and gives you a serious backend orchestration layer instead of a pile of prompt glue. ([Vercel][1])

## What I would avoid

I would avoid:

* **plain LangChain-only orchestration** as the main backbone if you know you need durable state, interrupts, and complex control flow; LangChain itself now points to LangGraph as the lower-level durable execution layer underneath agents. ([LangChain Docs][10])
* **letting tools decide terminal vs non-terminal on their own**; the orchestrator should decide that from user intent and current state
* **putting all memory into prompts**
* **letting the model emit arbitrary frontend code**
* **making everything synchronous**
* **using background model jobs as a substitute for your own workflow engine**

## My opinionated recommendation

If you want the cleanest path:

**Use Vercel AI SDK for the UI contract and provider abstraction. Use LangGraph JS as the brain. Use Vercel Functions + Queues as the execution substrate. Keep widgets schema-driven. Keep memory and pivot detection as first-class graph state.**

That is the stack I think best matches what you described in 2026. ([Vercel][1])

I can also sketch the exact folder structure and runtime flow I’d use for this stack in a Next.js/Vercel app.

[1]: https://vercel.com/docs/ai-sdk?utm_source=chatgpt.com "AI SDK"
[2]: https://vercel.com/docs/functions?utm_source=chatgpt.com "Vercel Functions"
[3]: https://developers.openai.com/api/reference/responses/overview/?utm_source=chatgpt.com "Responses Overview | OpenAI API Reference"
[4]: https://docs.langchain.com/oss/javascript/langgraph/persistence?utm_source=chatgpt.com "Persistence - Docs by LangChain"
[5]: https://docs.langchain.com/oss/javascript/langgraph/overview?utm_source=chatgpt.com "LangGraph overview - Docs by LangChain"
[6]: https://vercel.com/blog/ai-sdk-6?utm_source=chatgpt.com "AI SDK 6"
[7]: https://vercel.com/docs/queues?utm_source=chatgpt.com "Vercel Queues"
[8]: https://docs.langchain.com/oss/javascript/langgraph/memory?utm_source=chatgpt.com "Memory overview - Docs by LangChain"
[9]: https://docs.langchain.com/oss/python/langgraph/graph-api?utm_source=chatgpt.com "Graph API overview - Docs by LangChain"
[10]: https://docs.langchain.com/oss/javascript/langchain/overview?utm_source=chatgpt.com "LangChain overview"

