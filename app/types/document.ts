import { DocumentStatus, ProcessingMode } from "~/generated/client/enums";

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface TranslationJob {
  id: string;
  userId: string;
  files: DocumentFile[];
  sourceLanguage: string;
  targetLanguage: string;
  mode: ProcessingMode;
  status: DocumentStatus;
  result?: string;
  resultUrl?: string;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  error?: string;
  tokensUsed?: number;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "he", name: "Hebrew", flag: "🇮🇱" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
];

export const PROCESSING_MODES: {
  [key in ProcessingMode]: {
    label: string;
    description: string;
  };
} = {
  [ProcessingMode.OCR]: {
    label: "OCR",
    description: "Extract text from images/PDFs",
  },
  [ProcessingMode.TRANSLATE]: {
    label: "Translate",
    description: "Translate document to target language",
  },
  [ProcessingMode.TRANSLATE_JUR]: {
    label: "Translate Jurisdical",
    description: "Translate document to target jurisdiction",
  },
  [ProcessingMode.SUMMARISE]: {
    label: "Summarize",
    description: "Generate summary of document",
  },
  [ProcessingMode.SUMMARISE_ONCO]: {
    label: "Summarize Oncology",
    description: "Generate summary of oncology document",
  },
};
