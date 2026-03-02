import type { ChatPromptClient, TextPromptClient } from "@langfuse/client";
import { ProcessingMode } from "~/generated/client/enums";
import { NeverError } from "~/lib/error";
import {
  compileChatPrompt,
  getLangfuseSDK,
  listPrompts,
} from "~/lib/langfuse.server";
import type { Lang, SimplifiedChatMessage } from "./const";
import { SUPPORTED_LANGUAGES } from "~/types/document";
import { PromptType } from "@langfuse/core";

export async function resolveMisPrompt(
  processingMode: ProcessingMode,
  sourceLanguage: Lang,
  targetLanguage: Lang,
): Promise<SimplifiedChatMessage[]> {
  const languageSetting = [sourceLanguage, targetLanguage] as const;
  const misPrompts = await listPrompts({ tag: "mis", limit: 100 });

  const glossarySourceTextPromptName = getTextName("glossary", sourceLanguage);
  const glossaryTargetTextPromptName = getTextName("glossary", targetLanguage);
  const glossarySourceTextPrompt = await getPrompt(
    PromptType.Text,
    glossarySourceTextPromptName,
  );
  const glossaryTargetTextPrompt = await getPrompt(
    PromptType.Text,
    glossaryTargetTextPromptName,
  );

  function getChatName(...tags: string[]) {
    return misPrompts.data
      .filter(
        (p) => p.type === "chat" && tags.every((tag) => p.tags.includes(tag)),
      )
      ?.at(0)?.name;
  }

  function getTextName(...tags: string[]) {
    return misPrompts.data
      .filter(
        (p) => p.type === "text" && tags.every((tag) => p.tags.includes(tag)),
      )
      ?.at(0)?.name;
  }

  switch (processingMode) {
    case ProcessingMode.OCR:
      const ocrChatPromptName = getChatName("ocr");
      const ocrChatPrompt = await getPrompt(PromptType.Chat, ocrChatPromptName);

      return combinePrompts(
        languageSetting,
        ocrChatPrompt,
        glossaryTargetTextPrompt,
      );

    case ProcessingMode.SUMMARISE:
      const summariseChatPromptName = getChatName("summary");
      const summariseChatPrompt = await getPrompt(
        PromptType.Chat,
        summariseChatPromptName,
      );

      return combinePrompts(
        languageSetting,
        summariseChatPrompt,
        glossaryTargetTextPrompt,
      );

    case ProcessingMode.SUMMARISE_ONCO:
      const summariseOncoChatPromptName = getChatName("oncology");

      const summariseOncoChatPrompt = await getPrompt(
        PromptType.Chat,
        summariseOncoChatPromptName,
      );

      return combinePrompts(
        languageSetting,
        summariseOncoChatPrompt,
        glossaryTargetTextPrompt,
      );

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
        getChatName("translate", "from-any-lang", targetLanguage);

      const langPairChatPrompt = await getPrompt(
        PromptType.Chat,
        langPairChatPromptName,
      );

      return combinePrompts(
        languageSetting,
        langPairChatPrompt,
        glossarySourceTextPrompt,
        glossaryTargetTextPrompt,
      );
    default:
      throw new NeverError(processingMode);
  }
}

function combinePrompts(
  [from, to]: readonly [Lang, Lang],
  chat: ChatPromptClient | null,
  ...texts: (TextPromptClient | null)[]
): SimplifiedChatMessage[] {
  if (!chat)
    throw new Error("Chat prompt is required as it is the primary prompt");

  const combinedPrompt = compileChatPrompt(chat, {
    sourceLang:
      SUPPORTED_LANGUAGES.find((lang) => lang.code === from)?.name || from,
    targetLang:
      SUPPORTED_LANGUAGES.find((lang) => lang.code === to)?.name || to,
  });

  const combinedTextPrompts = texts.filter(Boolean).map(
    (text) =>
      ({
        role: "system",
        content: text!.prompt,
      }) as const,
  );

  return [...combinedPrompt, ...combinedTextPrompts];
}

function getPrompt(
  type: typeof PromptType.Chat,
  name: string | void,
): Promise<ChatPromptClient | null>;

function getPrompt(
  type: typeof PromptType.Text,
  name: string | void,
): Promise<TextPromptClient | null>;

async function getPrompt(
  type: typeof PromptType.Chat | typeof PromptType.Text,
  name: string | void,
) {
  if (!name) return null;
  const sdk = getLangfuseSDK();

  if (type === PromptType.Chat) return await sdk.prompt.get(name, { type });
  return await sdk.prompt.get(name, { type });
}
