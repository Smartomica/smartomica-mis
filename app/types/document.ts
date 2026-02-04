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
  mode: "translate" | "summarize" | "ocr";
  status: "pending" | "processing" | "completed" | "failed";
  result?: string;
  resultUrl?: string;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  error?: string;
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

export const PROCESSING_MODES = [
  {
    value: "translate",
    label: "Translate",
    description: "Translate document to target language",
  },
  {
    value: "summarize",
    label: "Summarize",
    description: "Generate summary of document",
  },
  { value: "ocr", label: "OCR", description: "Extract text from images/PDFs" },
] as const;
