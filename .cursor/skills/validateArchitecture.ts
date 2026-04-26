/**
 * validateArchitecture Skill
 * 
 * Checks if a proposed change follows our core architecture rules.
 * Uses lightweight rule checking to keep token usage low.
 */

export interface ValidateArchitectureInput {
  changeDescription: string;
  filesAffected: string[];
  proposedCode?: string;
}

export interface ValidateArchitectureOutput {
  isValid: boolean;
  violations: string[];
  recommendations: string[];
  shouldLoadFullDocs: boolean;
}

export async function validateArchitecture(input: ValidateArchitectureInput): Promise<ValidateArchitectureOutput> {
  const violations: string[] = [];
  const recommendations: string[] = [];
  let shouldLoadFullDocs = false;

  const desc = input.changeDescription.toLowerCase();

  // Core Architecture Rules (lightweight - no full doc loading)
  const rules = [
    {
      name: "Hard Enforcement Before LLM",
      check: () => desc.includes("llm") && !desc.includes("before") && !desc.includes("enforce"),
      message: "Hard enforcement (features, quotas, canonical IDs) must happen before any LLM call"
    },
    {
      name: "Use Supabase Realtime for updates",
      check: () => desc.includes("realtime") && !desc.includes("supabase"),
      message: "All realtime updates should use Supabase Realtime"
    },
    {
      name: "Use Knock for Rich Notifications",
      check: () => desc.includes("notification") && desc.includes("rich") && !desc.includes("knock"),
      message: "Rich, actionable, or multi-channel notifications should use Knock"
    },
    {
      name: "Use Inngest for Background",
      check: () => desc.includes("background") && !desc.includes("inngest"),
      message: "Background jobs and HITL workflows should use Inngest"
    },
    {
      name: "LangGraph for Skills Only",
      check: () => desc.includes("skill") && desc.includes("langgraph") && desc.includes("main"),
      message: "LangGraph should only be used for Skills, not the main agent loop"
    },
    {
      name: "contextId as Primary Key",
      check: () => desc.includes("thread") && !desc.includes("contextid"),
      message: "Use contextId as the primary identifier, not thread_id"
    }
  ];

  for (const rule of rules) {
    if (rule.check()) {
      violations.push(rule.message);
    }
  }

  // Determine if full docs should be loaded
  if (violations.length > 0 || desc.includes("complex") || desc.includes("hitl") || desc.includes("workflow")) {
    shouldLoadFullDocs = true;
    recommendations.push("Consider loading relevant architecture documents for deeper validation");
  }

  if (violations.length === 0) {
    recommendations.push("Change appears to follow core architecture principles");
  }

  return {
    isValid: violations.length === 0,
    violations,
    recommendations,
    shouldLoadFullDocs
  };
}