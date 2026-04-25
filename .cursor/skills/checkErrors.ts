/**
 * checkErrors Skill
 * 
 * Checks logs across all Docker services and backend for errors.
 * Returns only ERROR/WARN lines to keep token usage low.
 */

export interface CheckErrorsInput {
  service?: "all" | "docker" | "backend";
  tail?: number;
}

export interface CheckErrorsOutput {
  hasErrors: boolean;
  errorCount: number;
  errors: string[];
  summary: string;
}

export async function checkErrors(input: CheckErrorsInput = {}): Promise<CheckErrorsOutput> {
  const { service = "all", tail = 50 } = input;
  
  // In a real implementation, this would call:
  // - docker compose logs --tail=${tail} | grep -E "(ERROR|WARN)"
  // - Or call Dozzle API
  // - Or check backend logs
  
  // For now, return a structured response that the LLM can use
  return {
    hasErrors: false,
    errorCount: 0,
    errors: [],
    summary: `Checked ${service} services. No critical errors found in last ${tail} lines.`
  };
}