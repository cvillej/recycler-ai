Set it up as **two layers, not one**:

**Layer 1: OpenTelemetry everywhere** as the canonical instrumentation standard.
**Layer 2: one place to read it** for humans, plus one AI-specific trace view.

For your stack, I would make **OpenTelemetry the source of truth**, initialize it in Next.js/Vercel with `@vercel/otel`, and then export traces/logs to your observability backend through Vercel tracing and drains. Vercel supports OpenTelemetry instrumentation out of the box via `@vercel/otel`, and Pro/Enterprise plans can forward logs and traces through Drains, with traces using OTLP/HTTP. ([Vercel][1])

My opinionated setup would be:

1. **Infra/app observability:** one backend for logs, traces, dashboards, and alerts.
2. **LLM/agent observability:** LangSmith on top for agent runs, prompts, tool paths, and debugging LangGraph.
3. **Keep OTel IDs consistent across both** so one user turn can be followed end to end. LangGraph/LangSmith tracing is built for visualizing the execution steps of agent runs, and LangSmith integrates directly with LangGraph JS. ([LangChain Docs][2])

## What to trace

Make every chat turn a root trace. Under that, create child spans for:

* request received
* auth/session load
* memory retrieval
* focus/pivot classification
* planning step
* each LLM call
* each tool call
* each DB query group
* widget payload generation
* response stream completion
* persistence/checkpoint save

That structure is what will let you answer “why did this reply happen?” instead of just “what error occurred?”. OpenTelemetry is specifically meant to generate and export traces, metrics, and logs in a standard way, and the AI SDK telemetry also uses OpenTelemetry. ([OpenTelemetry][3])

## What to log

Use **structured JSON logs only**. No freeform console spam except during local dev.

Every log line should include at least:

* `trace_id`
* `span_id`
* `request_id`
* `thread_id`
* `conversation_id`
* `user_id_hash`
* `agent_run_id`
* `tool_call_id`
* `deployment_id`
* `environment`
* `route`
* `model`
* `tool_name`
* `duration_ms`
* `status`
* `error_code`

Vercel runtime logs already expose request-level data and a `RequestId`, and logs are grouped per request in the dashboard. That gives you a natural request boundary to join with your own application fields. ([Vercel][4])

## The key rule

**Every log must be correlated to a trace.**

If a log line does not have a `trace_id`, it is much less useful. OpenTelemetry’s logs spec is explicitly built around correlation across logs, traces, and metrics through shared context. ([OpenTelemetry][5])

## What to measure

In addition to traces and logs, emit metrics for:

* turn latency
* time to first token
* full response latency
* tool latency by tool
* DB query latency
* tool error rate
* model error rate
* retries
* token usage in/out
* cost per turn
* pivot rate
* memory retrieval hit rate
* widget render failure rate
* user abort rate
* stream disconnect rate

OpenTelemetry JS supports metrics as well as traces, and the GenAI semantic conventions include traces, metrics, and events for generative AI systems. ([OpenTelemetry][6])

## How I would wire it on Vercel

In Next.js, add an `instrumentation.ts` and register OTel with `@vercel/otel`. Vercel’s docs show `registerOTel({ serviceName: 'your-project-name' })` in `instrumentation.ts`, and the AI SDK telemetry docs say Next.js apps should enable OpenTelemetry first, then opt in on specific AI SDK calls with `experimental_telemetry`. ([Vercel][1])

At a minimum, I would:

* initialize OTel in `instrumentation.ts`
* enable AI SDK telemetry on every `generateText` / `streamText` / tool-driving model call
* add custom spans around LangGraph nodes and tool functions
* send traces out through a Vercel Trace Drain or your chosen OTel collector endpoint
* send logs out through a Vercel Log Drain if you need longer retention/search/alerting than the Vercel dashboard gives you

Vercel runtime logs are available in-dashboard on all plans, while Drains forward logs and traces externally on Pro/Enterprise. Vercel’s docs also note retention differences by plan. ([Vercel][4])

## The split I recommend

Use **three observability views**:

**A. Vercel dashboard**
Use it for fast production triage: function errors, request failures, quick live debugging. Runtime logs are available directly in the dashboard and grouped by request. ([Vercel][4])

**B. Your main OTel backend**
Use it for cross-service analysis, dashboards, alerts, retention, and joining app behavior with database/tool infrastructure. Vercel Drains can forward both logs and traces to external services or custom endpoints. ([Vercel][7])

**C. LangSmith**
Use it for agent reasoning-path visibility: graph steps, tool ordering, prompt debugging, run comparisons, and evals. LangSmith is specifically positioned for tracing, monitoring, and evaluating LangGraph applications. ([LangChain Docs][2])

## Practical tagging scheme

Add these tags/attributes to every span:

* `app.user_tier`
* `app.thread_id`
* `app.conversation_id`
* `app.agent_name`
* `app.focus_topic`
* `app.pivot_detected`
* `app.widget_type`
* `app.tool_name`
* `app.memory_hit`
* `app.checkpoint_version`

And use standard OTel semantic conventions where possible for HTTP, DB, and GenAI fields. OpenTelemetry’s GenAI semantic conventions are still in transition, with explicit guidance around experimental/stability opt-in, so build your custom app-level fields under your own namespace like `app.*` rather than overfitting to a moving convention. ([OpenTelemetry][8])

## Logging levels I would use

* `INFO`: turn lifecycle, tool started/completed, checkpoint saved
* `WARN`: retries, degraded fallbacks, partial tool failure, truncation, redaction applied
* `ERROR`: request failure, tool exception, model/provider failure, stream breakage
* `DEBUG`: only in dev or sampled sessions

Keep prod `INFO` logs sparse and structured. Remember Vercel runtime logs have per-request line and size limits, so giant prompt dumps in logs are a bad idea. Vercel documents a maximum of 256 log lines per request, 256 KB per line, and 1 MB total per request. ([Vercel][4])

## Redaction policy

Do **not** log raw prompts, raw tool payloads, or raw DB rows by default.

Instead:

* log hashes, IDs, counts, and schema shapes
* allow full prompt/tool payload capture only in sampled debug sessions
* separate “safe metadata” from “sensitive content”
* redact secrets, emails, phone numbers, access tokens, and auth headers before export

The AI SDK telemetry can record inputs and outputs, and the docs note those are enabled by default when telemetry is turned on unless you disable `recordInputs` and `recordOutputs`. For most production apps, I would not leave full input/output capture on globally. ([AI SDK][9])

## Sampling strategy

Do **not** sample everything equally.

I’d use:

* **100% sampling** for errors
* **100% sampling** for new deployments and preview environments for a short window
* **10–20% sampling** for healthy production traffic
* **100% sampling** for flagged users, canaries, and explicit debug sessions
* **100% sampling** for expensive tools and background workflows

Vercel Drains support configurable sampling rules by environment and optional request-path prefix, with rules evaluated top to bottom. ([Vercel][7])

## LangGraph / agent-specific advice

Inside LangGraph, make each node observable on purpose. Log:

* node start/end
* input summary
* output summary
* state diff summary
* elapsed time
* retries
* branch decision
* interrupt/human-in-the-loop event

Then send the whole run to LangSmith. LangSmith supports environment-variable-based tracing for LangGraph, and their docs specifically call out debugging, monitoring, and evaluating application performance. In serverless environments, LangChain recommends disabling background callbacks so tracing finishes before the function ends. ([LangChain Docs][2])

## Minimal implementation shape

Your stack should look like this conceptually:

```ts
// instrumentation.ts
import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({ serviceName: 'my-ai-chat-app' });
}
```

```ts
// inside a route / server action / worker
const result = await generateText({
  model,
  prompt,
  experimental_telemetry: {
    isEnabled: true,
    recordInputs: false,
    recordOutputs: false,
  },
});
```

And around that, wrap your own spans for:

* `chat.turn`
* `focus.detect`
* `memory.retrieve`
* `llm.generate`
* `tool.db.query`
* `widget.emit`

That matches the current Vercel and AI SDK telemetry setup model. ([Vercel][1])

## My strongest recommendation

If you want the cleanest production setup:

**Use OpenTelemetry as the backbone, Vercel for app-native logs/traces export, and LangSmith for agent debugging.**
Do not make logs your primary debugging interface for agent behavior. Use traces for flow, logs for evidence, metrics for trends, and LangSmith for reasoning/tool-path inspection. ([Vercel][1])

A good next step is for me to sketch the exact `instrumentation.ts`, logger wrapper, span helper, and LangGraph callback setup in TypeScript for a Next.js/Vercel app.

[1]: https://vercel.com/docs/tracing/instrumentation "Instrumentation"
[2]: https://docs.langchain.com/oss/javascript/langgraph/observability "LangSmith Observability - Docs by LangChain"
[3]: https://opentelemetry.io/docs/?utm_source=chatgpt.com "Documentation"
[4]: https://vercel.com/docs/logs/runtime "Runtime Logs"
[5]: https://opentelemetry.io/docs/specs/otel/logs/?utm_source=chatgpt.com "OpenTelemetry Logging"
[6]: https://opentelemetry.io/docs/languages/js/?utm_source=chatgpt.com "JavaScript"
[7]: https://vercel.com/docs/drains/using-drains "Using Drains"
[8]: https://opentelemetry.io/docs/specs/semconv/gen-ai/ "Semantic conventions for generative AI systems | OpenTelemetry"
[9]: https://sdk.vercel.ai/docs/ai-sdk-core/telemetry "AI SDK Core: Telemetry"

