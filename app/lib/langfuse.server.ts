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

export function compileChatPrompt(
  prompt: any,
  variables: Record<string, string>,
) {
  if (prompt.type !== "chat" || !Array.isArray(prompt.prompt)) {
    console.error("Prompt is not an array. Chat prompt expected");
    throw new Error("Invalid prompt configuration");
  }

  const compiledPrompt = prompt.compile(variables) as unknown as {
    role: "system" | "user" | "assistant";
    content: string;
  }[];

  return compiledPrompt;
}