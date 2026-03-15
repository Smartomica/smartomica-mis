import { ChatPromptClient, LangfuseClient } from "@langfuse/client";
import { LangfuseAPIClient } from "@langfuse/core";
import { observeOpenAI } from "@langfuse/openai";
import OpenAI from "openai";
import {
  LANGFUSE_BASE_URL,
  LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY,
} from "~/env.server";
import {
  BASE_URL,
  LLM_API_KEY,
  LOCAL_LLM_MODE,
} from "~/lib/openAi/config.server";
import type { SimplifiedChatMessage } from "~/lib/services/document-processor.server/const";

export function getOpenAI({
  sessionId,
  generationName,
}: {
  sessionId: string;
  generationName: string;
}) {
  const openai = observeOpenAI(
    new OpenAI({
      baseURL: BASE_URL,
      apiKey: LLM_API_KEY,
      timeout: LOCAL_LLM_MODE ? 60 * 60 * 1e3 : undefined,
      maxRetries: LOCAL_LLM_MODE ? 1 : undefined,
    }),
    {
      generationName,
      sessionId,
    },
  );
  return openai;
}

export function compileChatPrompt(
  prompt: ChatPromptClient,
  variables: Record<string, string>,
) {
  if (prompt?.type !== "chat" || !Array.isArray(prompt.prompt)) {
    console.error("Prompt is not an array. Chat prompt expected");
    console.error("Invalid prompt configuration", prompt, variables);
    throw new Error("Invalid prompt configuration");
  }

  const compiledPrompt = prompt.compile(
    variables,
  ) as unknown as SimplifiedChatMessage[];

  return compiledPrompt;
}

export function getLangfuseSDK() {
  return new LangfuseClient({
    baseUrl: LANGFUSE_BASE_URL,
    publicKey: LANGFUSE_PUBLIC_KEY,
    secretKey: LANGFUSE_SECRET_KEY,
  });
}

function getLangfuseAPI() {
  return new LangfuseAPIClient({
    environment: "production",
    baseUrl: LANGFUSE_BASE_URL,
    username: LANGFUSE_PUBLIC_KEY,
    password: LANGFUSE_SECRET_KEY,
  });
}

export const listPrompts = (() => {
  const api = getLangfuseAPI();
  return api.prompts.list.bind(api.prompts);
})();
