import { LangfuseAPIClient } from "@langfuse/core";
import { LangfuseClient } from "@langfuse/client";
import { observeOpenAI } from "@langfuse/openai";
import OpenAI from "openai";
import {
  LANGFUSE_BASE_URL,
  LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY,
  OPENROUTER_API_KEY,
} from "~/env.server";
import type { SimplifiedChatMessage } from "./services/document-processor.server";

export function getLangfuseSDK() {
  return new LangfuseClient({
    baseUrl: LANGFUSE_BASE_URL,
    publicKey: LANGFUSE_PUBLIC_KEY,
    secretKey: LANGFUSE_SECRET_KEY,
  });
}

export function getOpenAI({
  sessionId,
  generationName,
}: {
  sessionId: string;
  generationName: string;
}) {
  const openai = observeOpenAI(
    new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: OPENROUTER_API_KEY,
    }),
    {
      generationName,
      sessionId,
    },
  );
  return openai;
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

export function compileChatPrompt(
  prompt: any,
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
