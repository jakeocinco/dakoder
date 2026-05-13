export interface PromptInput {
  description: string;
  spec: string;
  iteration: number;
  buildLogs?: string;
  reviewComments?: string;
}

export function buildPrompt(input: PromptInput): string {
  const parts: string[] = [
    `## Task\n\n${input.description}`,
    `## Spec\n\n${input.spec}`,
  ];

  if (input.iteration > 0) {
    parts.push(`## Iteration ${input.iteration}`);
  }

  if (input.buildLogs) {
    parts.push(`## Build Failure\n\n${input.buildLogs}`);
  }

  if (input.reviewComments) {
    parts.push(`## Review Feedback\n\n${input.reviewComments}`);
  }

  return parts.join("\n\n");
}
