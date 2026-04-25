/**
 * runTask Skill
 * 
 * Executes common Taskfile commands in a structured way.
 */

export interface RunTaskInput {
  task: string;
  args?: string[];
}

export interface RunTaskOutput {
  success: boolean;
  output: string;
  command: string;
}

export async function runTask(input: RunTaskInput): Promise<RunTaskOutput> {
  const { task, args = [] } = input;
  
  const validTasks = [
    "dev:all",
    "dev:backend",
    "dev:docker",
    "dev:supabase",
    "logs:errors",
    "docker:up",
    "docker:down",
    "docker:logs:errors"
  ];

  if (!validTasks.includes(task)) {
    return {
      success: false,
      output: `Invalid task: ${task}. Valid tasks: ${validTasks.join(", ")}`,
      command: ""
    };
  }

  const command = `task ${task} ${args.join(" ")}`.trim();

  // In real implementation, this would execute the command
  // For now, return structured response
  return {
    success: true,
    output: `Would execute: ${command}`,
    command
  };
}