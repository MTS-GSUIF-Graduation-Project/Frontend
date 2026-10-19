/*
 * User-facing meaning of the fixed failure stages and codes persisted by gsuif-backend
 * (GenerationFailureStage and GenerationFailureCode). The server never sends exception text;
 * its own diagnostics stay in the server log, keyed by run ID.
 */

export interface FailureMessage {
  /** One-line outcome. */
  summary: string;
  /** What happened, in plain words. */
  explanation: string;
  /** What the user can do next. */
  nextStep: string;
}

const RETRY_COST = 'Each new attempt uses the AI service and may incur cost.';
const ASK_OPERATOR = 'If it happens again, share the run ID from "Technical details" with the person who runs the server.';

export const FAILURE_STAGE_LABELS: Record<string, string> = {
  CONFIG: 'Server configuration',
  CONTRACT: 'Contract check',
  AI: 'AI generation',
  ASSEMBLY: 'Package assembly',
  FINAL_VALIDATION: 'Final package checks'
};

export const FAILURE_MESSAGES: Record<string, FailureMessage> = {
  CONFIG_MISSING: {
    summary: 'The server is not set up for generation.',
    explanation: 'A setting or tool that generation needs is missing on the server, so no backend was generated.',
    nextStep: 'Ask the person who runs the server to check the generation setup, then generate again.'
  },
  VALIDATION_FAILED: {
    summary: 'This page does not match the chosen contract.',
    explanation: 'Some of the page\'s API bindings or specification fields do not fit the selected contract.',
    nextStep: 'Correct the fields listed above, save if you changed the metadata, then generate again.'
  },
  MODEL_UNAVAILABLE: {
    summary: 'The AI service did not respond.',
    explanation: 'The AI service was unavailable, busy or too slow, so no code was generated.',
    nextStep: `Wait a few minutes, then generate again. ${RETRY_COST}`
  },
  MODEL_OUTPUT_INVALID: {
    summary: 'The AI\'s answer could not be used.',
    explanation: 'The answer was not in the expected form, so it was discarded and nothing was saved.',
    nextStep: `Generate again; answers can differ between attempts. ${RETRY_COST}`
  },
  MODEL_COMPILATION_FAILED: {
    summary: 'The AI-written code did not compile.',
    explanation: 'The code was checked in an isolated compiler, failed, and was discarded.',
    nextStep: `Generate again; answers can differ between attempts. ${RETRY_COST}`
  },
  INVALID_SOURCE_MAP: {
    summary: 'The generated files could not be put together.',
    explanation: 'The server could not combine the generated files into one package, so nothing was saved.',
    nextStep: `Generate again. ${ASK_OPERATOR}`
  },
  UNEXPECTED_FAILURE: {
    summary: 'Something went wrong on the server.',
    explanation: 'An unexpected server error stopped generation before a package was saved.',
    nextStep: `Generate again later. ${ASK_OPERATOR}`
  },
  RESULT_VALIDATION_FAILED: {
    summary: 'The generated backend did not pass its final checks.',
    explanation: 'Every package is built and checked before it is saved. This one did not pass, so nothing was kept.',
    nextStep: `You can generate again. ${RETRY_COST} ${ASK_OPERATOR}`
  }
};

const UNKNOWN_FAILURE: FailureMessage = {
  summary: 'Generation failed.',
  explanation: 'The server did not give a recognised reason, and no package was saved.',
  nextStep: ASK_OPERATOR
};

export const STATUS_EXPLANATIONS: Record<string, string> = {
  INTERRUPTED: 'The server stopped before this attempt finished, for example because it restarted. No package was kept. You can generate again.',
  BUILD_FAILED: 'The generated project did not build, so no files are offered.',
  IN_PROGRESS: 'The server is still working on this attempt. Use "Refresh status" to check again.'
};

export function failureStageLabel(stage: string | null): string {
  return stage ? FAILURE_STAGE_LABELS[stage] ?? stage : 'Unknown stage';
}

export function describeFailure(code: string | null): FailureMessage {
  return (code && FAILURE_MESSAGES[code]) || UNKNOWN_FAILURE;
}
