import { env } from "../config/env";

import type { LLMProvider } from "./LLMProvider";

import { GeminiProvider } from "./GeminiProvider";
import { MockLLMProvider } from "./MockLLMProvider";

export function createLLMProvider(): LLMProvider {
  if (env.MOCK_LLM) {
    return new MockLLMProvider();
  }

  return new GeminiProvider();
}

export type { LLMProvider, RepairContext } from "./LLMProvider";

export { MockLLMProvider } from "./MockLLMProvider";
export { GeminiProvider } from "./GeminiProvider";