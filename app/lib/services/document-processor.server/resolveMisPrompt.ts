import type { ChatPromptClient, TextPromptClient } from "@langfuse/client";
import { PromptType } from "@langfuse/core";
import { ProcessingMode } from "~/generated/client/enums";
import { NeverError } from "~/lib/error";
import {
  compileChatPrompt,
  getLangfuseSDK,
  listPrompts,
} from "~/lib/langfuse.server";
import { SUPPORTED_LANGUAGES } from "~/types/document";
import type { Lang, SimplifiedChatMessage } from "./const";

enum Tag {
  ProjectMis = "mis",

  OperationOcr = "ocr",
  OperationTranslate = "translate",
  OperationSummary = "summary",
  OperationOnco = "oncology",

  Glossary = "glossary",
  TranslateLang = "translate-lang",
  TranslateLegacy = "translate",
  FromAny = "from-any-lang",
  ToAny = "to-any-lang",
}

type LookupTag = Tag | Lang;

export async function resolveMisPrompt(
  processingMode: ProcessingMode,
  sourceLang: Lang,
  targetLang: Lang,
): Promise<SimplifiedChatMessage[]> {
  const languageSetting = [sourceLang, targetLang] as const;
  const misPrompts = await listPrompts({
    tag: Tag.ProjectMis,
    limit: 100,
  });

  const [
    glossarySourceTextPrompt,
    glossaryTargetTextPrompt,
    translationFromTextPrompt,
    translationToTextPrompt,
  ] = await Promise.all([
    getPrompt(PromptType.Text, getTextName(Tag.Glossary, sourceLang)),
    getPrompt(PromptType.Text, getTextName(Tag.Glossary, targetLang)),
    getPrompt(
      PromptType.Text,
      getTextName(Tag.TranslateLang, Tag.FromAny, sourceLang) ||
        getTextNameStrict(Tag.TranslateLang, Tag.ToAny),
    ),
    getPrompt(
      PromptType.Text,
      getTextName(Tag.TranslateLang, Tag.FromAny, targetLang) ||
        getTextNameStrict(Tag.TranslateLang, Tag.FromAny),
    ),
  ]);

  switch (processingMode) {
    case ProcessingMode.OCR:
      const ocrChatPrompt = await getPrompt(
        PromptType.Chat,
        getChatName(Tag.OperationOcr),
      );

      return combinePrompts(
        languageSetting,
        ocrChatPrompt,
        glossaryTargetTextPrompt,
      );

    case ProcessingMode.SUMMARISE:
      const summariseChatPrompt = await getPrompt(
        PromptType.Chat,
        getChatName(Tag.OperationSummary),
      );

      return combinePrompts(
        languageSetting,
        summariseChatPrompt,
        glossaryTargetTextPrompt,
      );

    case ProcessingMode.SUMMARISE_ONCO:
      const summariseOncoChatPrompt = await getPrompt(
        PromptType.Chat,
        getChatName(Tag.OperationOnco),
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
              p.type === PromptType.Chat &&
              p.tags.includes(Tag.TranslateLegacy) &&
              // Require name to include smth like ru->en
              p.name.indexOf(sourceLang) < p.name.indexOf(targetLang) &&
              p.tags.includes(sourceLang) &&
              p.tags.includes(targetLang),
          )
          .at(0)?.name ||
        getChatName(Tag.TranslateLegacy, Tag.FromAny, targetLang);

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

  /**
   * @desc: Resolves chat prompt by tag list. Extra tags are allowed
   */
  function getChatName(...tags: LookupTag[]) {
    return misPrompts.data
      .filter(
        (p) =>
          p.type === PromptType.Chat &&
          tags.every((tag) => p.tags.includes(tag)),
      )
      ?.at(0)?.name;
  }

  /**
   * @desc: Resolves chat prompt by tag list. Extra tags are allowed
   */
  function getTextName(...tags: LookupTag[]) {
    return misPrompts.data
      .filter(
        (p) =>
          p.type === PromptType.Text &&
          tags.every((tag) => p.tags.includes(tag)),
      )
      ?.at(0)?.name;
  }

  /**
   * @desc: Resolves chat prompt by tag list. No extra tags allowed
   */
  function getTextNameStrict(...tags: LookupTag[]) {
    return misPrompts.data
      .filter(
        (p) =>
          p.type === PromptType.Text &&
          tags.every((tag) => p.tags.includes(tag)) &&
          tags.length === p.tags.length,
      )
      ?.at(0)?.name;
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
