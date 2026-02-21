import type { ChatPromptClient, TextPromptClient } from "@langfuse/client";
import { ProcessingMode } from "~/generated/client/enums";
import { NeverError } from "~/lib/error";
import {
  compileChatPrompt,
  getLangfuseSDK,
  listPrompts,
} from "~/lib/langfuse.server";
import type { Lang, SimplifiedChatMessage } from "./const";

export async function resolveMisPrompt(
  processingMode: ProcessingMode,
  sourceLanguage: Lang,
  targetLanguage: Lang,
): Promise<SimplifiedChatMessage[]> {
  const misPrompts = await listPrompts({ tag: "mis", limit: 100 });
  const sdk = getLangfuseSDK();

  switch (processingMode) {
    case ProcessingMode.OCR:
      const ocrChatPrompts = misPrompts.data.filter(
        (p) =>
          p.type === "chat" &&
          p.tags.includes("ocr") &&
          p.tags.includes("chat"),
      );

      const glossaryTextPrompts = misPrompts.data.filter(
        (p) =>
          p.type === "text" &&
          p.tags.includes("glossary") &&
          p.tags.includes(sourceLanguage),
      );

      let ocrChatPrompt = ocrChatPrompts[0]?.name
        ? await sdk.prompt.get(ocrChatPrompts[0]?.name, {
            type: "chat",
          })
        : null;

      let ocrTextPrompt = ocrChatPrompts[0]?.name
        ? await sdk.prompt.get(glossaryTextPrompts[0]?.name, {
            type: "text",
          })
        : null;

      return combinePrompts(ocrChatPrompt, ocrTextPrompt);

    case ProcessingMode.SUMMARISE:
      const summariseChatPromptName = misPrompts.data
        .filter((p) => p.type === "chat" && p.tags.includes("summary"))
        .at(0)?.name;

      const summariseTextPromptName = misPrompts.data
        .filter(
          (p) =>
            p.type === "text" &&
            p.tags.includes("glossary") &&
            p.tags.includes(sourceLanguage),
        )
        ?.at(0)?.name;

      let summariseChatPrompt = summariseChatPromptName
        ? await sdk.prompt.get(summariseChatPromptName, {
            type: "chat",
          })
        : null;

      let summariseTextPrompt = summariseTextPromptName
        ? await sdk.prompt.get(summariseTextPromptName, {
            type: "text",
          })
        : null;

      return combinePrompts(summariseChatPrompt, summariseTextPrompt);

    case ProcessingMode.SUMMARISE_ONCO:
      const summariseOncoChatPromptName = misPrompts.data
        .filter((p) => p.type === "chat" && p.tags.includes("oncology"))
        .at(0)?.name;

      const summariseOncoTextPromptName = misPrompts.data
        .filter(
          (p) =>
            p.type === "text" &&
            p.tags.includes("glossary") &&
            p.tags.includes(sourceLanguage),
        )
        ?.at(0)?.name;

      let summariseOncoChatPrompt = summariseOncoChatPromptName
        ? await sdk.prompt.get(summariseOncoChatPromptName, {
            type: "chat",
          })
        : null;

      let summariseOncoTextPrompt = summariseOncoTextPromptName
        ? await sdk.prompt.get(summariseOncoTextPromptName, {
            type: "text",
          })
        : null;

      return combinePrompts(summariseOncoChatPrompt, summariseOncoTextPrompt);

    case ProcessingMode.TRANSLATE:
    case ProcessingMode.TRANSLATE_JUR:
      const langPairChatPromptName =
        misPrompts.data
          .filter(
            (p) =>
              p.type === "chat" &&
              p.tags.includes("translate") &&
              // Require name to include smth like ru->en
              p.name.indexOf(sourceLanguage) < p.name.indexOf(targetLanguage) &&
              p.tags.includes(sourceLanguage) &&
              p.tags.includes(targetLanguage),
          )
          .at(0)?.name ||
        misPrompts.data
          .filter(
            (p) =>
              p.type === "chat" &&
              p.tags.includes("translate") &&
              p.tags.includes("from-any-lang") &&
              p.tags.includes(targetLanguage),
          )
          .at(0)?.name;

      const glossarySourceTextPromptName = misPrompts.data
        .filter((p) => p.type === "text" && p.tags.includes(sourceLanguage))
        .at(0)?.name;

      const glossaryTargetTextPromptName = misPrompts.data
        .filter((p) => p.type === "text" && p.tags.includes(targetLanguage))
        .at(0)?.name;

      const langPairChatPrompt = langPairChatPromptName
        ? await sdk.prompt.get(langPairChatPromptName, { type: "chat" })
        : null;

      const glossarySourceTextPrompt = glossarySourceTextPromptName
        ? await sdk.prompt.get(glossarySourceTextPromptName, { type: "text" })
        : null;
      const glossaryTargetTextPrompt = glossaryTargetTextPromptName
        ? await sdk.prompt.get(glossaryTargetTextPromptName, { type: "text" })
        : null;

      return combinePrompts(
        langPairChatPrompt,
        glossarySourceTextPrompt,
        glossaryTargetTextPrompt,
      );
    default:
      throw new NeverError(processingMode);
  }
}

function combinePrompts(
  chat: ChatPromptClient | null,
  ...texts: (TextPromptClient | null)[]
): SimplifiedChatMessage[] {
  const combinedPrompt = compileChatPrompt(chat, {});

  const combinedTextPrompts = texts.filter(Boolean).map(
    (text) =>
      ({
        role: "system",
        content: text!.prompt,
      }) as const,
  );

  return [...combinedPrompt, ...combinedTextPrompts];
}
