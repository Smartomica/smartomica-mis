import type { ProcessingMode } from "~/generated/client/enums";

export const PAGES_SUBDIRECTORY = "pages";

export interface SimplifiedChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProcessDocumentArgs {
  files: Array<{
    objectName: string;
    name: string;
    mimeType: string;
    size: number;
  }>;
  sourceLanguage: string;
  targetLanguage: string;
  mode: ProcessingMode;
  userId: string;
}

export enum Lang {
  Auto = "auto",
  AR = "ar",
  EN = "en",
  ES = "es",
  FR = "fr",
  DE = "de",
  HE = "he",
  IT = "it",
  PT = "pt",
  RU = "ru",
  UK = "uk",
  UZ = "uz",
}

export const ALL_LANGUAGES: Lang[] = Object.values(Lang);
