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
interface LanguageSetting {
  sourceLang: Lang;
  targetLang: Lang;
  detectedLangs: Lang[];
}

export async function resolveMisPrompt(
  processingMode: ProcessingMode,
  sourceLang: Lang,
  targetLang: Lang,
  detectedLangs: Lang[] = [],
): Promise<SimplifiedChatMessage[]> {
  const misPrompts = await listPrompts({
    tag: Tag.ProjectMis,
    limit: 100,
  });
  const languageSetting = {
    sourceLang,
    targetLang,
    detectedLangs,
  } satisfies LanguageSetting;

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

      return combinePrompts(languageSetting, ocrChatPrompt);

    case ProcessingMode.SUMMARISE:
      const summariseChatPrompt = await getPrompt(
        PromptType.Chat,
        getChatName(Tag.OperationSummary),
      );

      return combinePrompts(
        languageSetting,
        summariseChatPrompt,
        glossaryTargetTextPrompt,
        translationFromTextPrompt,
        translationToTextPrompt,
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
        translationFromTextPrompt,
        translationToTextPrompt,
      );

    case ProcessingMode.TRANSLATE:
    case ProcessingMode.TRANSLATE_JUR:
      const langPairChatPrompt = await getPrompt(
        PromptType.Chat,
        getChatName(Tag.TranslateLang),
      );

      return combinePrompts(
        languageSetting,
        langPairChatPrompt,
        glossarySourceTextPrompt,
        glossaryTargetTextPrompt,
        translationFromTextPrompt,
        translationToTextPrompt,
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
  { sourceLang, targetLang, detectedLangs }: LanguageSetting,
  chat: ChatPromptClient | null,
  ...texts: (TextPromptClient | null)[]
): SimplifiedChatMessage[] {
  if (!chat)
    throw new Error("Chat prompt is required as it is the primary prompt");

  const combinedPrompt = compileChatPrompt(chat, {
    sourceLang: replaceCodeWithName(sourceLang),
    targetLang: replaceCodeWithName(targetLang),
    detectedLangs: detectedLangs.map(replaceCodeWithName).join("|"),
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

function replaceCodeWithName(lang: Lang) {
  return (
    SUPPORTED_LANGUAGES.find((validLang) => validLang.code === lang)?.name ||
    lang
  );
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
