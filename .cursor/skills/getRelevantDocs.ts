/**
 * getRelevantDocs Skill
 * 
 * Given a task description, returns the most relevant architecture documents
 * with short summaries. Keeps token usage low by not loading full content.
 */

export interface GetRelevantDocsInput {
  taskDescription: string;
}

export interface RelevantDoc {
  file: string;
  path: string;
  summary: string;
  relevance: "high" | "medium" | "low";
}

export interface GetRelevantDocsOutput {
  docs: RelevantDoc[];
  recommendation: string;
}

const DOC_INDEX = [
  {
    file: "request-flow.md",
    path: "@../../docs/request-flow.md",
    keywords: ["chat", "request", "llm", "prompt", "memory", "inngest"],
    summary: "Core request lifecycle, Context Enricher, Post-Response Handler, Inngest integration"
  },
  {
    file: "tool-layer.md",
    path: "@../../docs/tool-layer.md",
    keywords: ["tool", "skill", "entity", "resolution", "langgraph"],
    summary: "Tool definitions, entity resolution, Skills (LangGraph)"
  },
  {
    file: "memory-management.md",
    path: "@../../docs/memory-management.md",
    keywords: ["memory", "mem0", "focus", "workflow"],
    summary: "Mem0-powered memory, 3-level focus, workflow-specific state, early summarization"
  },
  {
    file: "external-event-controller.md",
    path: "@../../docs/external-event-controller.md",
    keywords: ["event", "background", "inngest", "context", "enricher"],
    summary: "Event Worker, Context Enricher, cache invalidation, proactive behavior"
  },
  {
    file: "notification-strategy.md",
    path: "@../../docs/notification-strategy.md",
    keywords: ["notification", "knock", "ably", "hitl", "alert"],
    summary: "Knock + Ably hybrid routing, HITL flows, user preferences"
  },
  {
    file: "failure-mode-and-hitl.md",
    path: "@../../docs/failure-mode-and-hitl.md",
    keywords: ["error", "failure", "hitl", "clarification", "gate"],
    summary: "Error handling, clarification gates, Knock + Inngest HITL"
  },
  {
    file: "observability.md",
    path: "@../../docs/observability.md",
    keywords: ["trace", "langfuse", "metric", "log", "debug"],
    summary: "Langfuse tracing, decision traceability, metrics, dashboards"
  },
  {
    file: "permissions.md",
    path: "@../../docs/permissions.md",
    keywords: ["permission", "feature", "gating", "plan", "quota", "subscription"],
    summary: "Feature gating, subscription tiers, usage quotas, trials, upgrade paths"
  }
];

export async function getRelevantDocs(input: GetRelevantDocsInput): Promise<GetRelevantDocsOutput> {
  const { taskDescription } = input;
  const desc = taskDescription.toLowerCase();
  
  const relevantDocs: RelevantDoc[] = [];

  for (const doc of DOC_INDEX) {
    const matchCount = doc.keywords.filter(kw => desc.includes(kw)).length;
    
    if (matchCount > 0) {
      relevantDocs.push({
        file: doc.file,
        path: doc.path,
        summary: doc.summary,
        relevance: matchCount >= 2 ? "high" : "medium"
      });
    }
  }

  // Sort by relevance
  relevantDocs.sort((a, b) => {
    if (a.relevance === "high" && b.relevance !== "high") return -1;
    if (b.relevance === "high" && a.relevance !== "high") return 1;
    return 0;
  });

  let recommendation = "No highly relevant documents found.";
  
  if (relevantDocs.length > 0) {
    recommendation = `Found ${relevantDocs.length} relevant document(s). Start with: ${relevantDocs[0].file}`;
  }

  return {
    docs: relevantDocs,
    recommendation
  };
}