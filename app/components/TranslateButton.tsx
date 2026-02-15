import { useState } from "react";
import { UpdateIcon, GlobeIcon } from "@radix-ui/react-icons";
import { SUPPORTED_LANGUAGES } from "~/types/document";
import { ProcessingMode } from "~/generated/client/enums";
import { t } from "~/lib/i18n/i18n";

interface TranslateButtonProps {
  className?: string;
  documentId: string;
  currentSourceLanguage: string;
  onTranslateStart?: () => void;
  onTranslateComplete?: () => void;
  onError?: (error: string) => void;
}

export function TranslateButton({
  className,
  documentId,
  currentSourceLanguage,
  onTranslateStart,
  onTranslateComplete,
  onError,
}: TranslateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [mode, setMode] = useState<ProcessingMode>(ProcessingMode.TRANSLATE);

  const handleTranslate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetLanguage || !mode) {
      return;
    }

    if (targetLanguage === currentSourceLanguage) {
      onError?.("Target language must be different from source language");
      return;
    }

    setIsTranslating(true);
    onTranslateStart?.();

    try {
      const formData = new FormData();
      formData.set("documentId", documentId);
      formData.set("targetLanguage", targetLanguage);
      formData.set("mode", mode);

      const response = await fetch("/documents/translate", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Translation failed");
      }

      setIsOpen(false);
      setTargetLanguage("");
      onTranslateComplete?.();

      // Refresh the page to show the new translation job
      window.location.reload();
    } catch (error) {
      console.error("Translation error:", error);
      onError?.(error instanceof Error ? error.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center ${className}`}
      >
        <GlobeIcon className="h-4 w-4 mr-1" />
        Translate
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Translate Document
              </h3>

              <form onSubmit={handleTranslate} className="mt-4 ">
                <fieldset className="space-y-4" disabled={isTranslating}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Source Language
                    </label>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100">
                      {SUPPORTED_LANGUAGES.find(
                        (l) => l.code === currentSourceLanguage,
                      )?.name || currentSourceLanguage}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Target Language
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm rounded-md"
                      required
                    >
                      <option value="">Select target language</option>
                      {SUPPORTED_LANGUAGES.filter(
                        (lang) => lang.code !== currentSourceLanguage,
                      ).map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Translation Type
                    </label>
                    <select
                      value={mode}
                      onChange={(e) =>
                        setMode(e.target.value as ProcessingMode)
                      }
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm rounded-md"
                      required
                    >
                      <option value={ProcessingMode.TRANSLATE}>
                        {t("documents.modeOption.TRANSLATE.label")} -{" "}
                        {t("documents.modeOption.TRANSLATE.description")}
                      </option>
                      <option value={ProcessingMode.TRANSLATE_JUR}>
                        {t("documents.modeOption.TRANSLATE_JUR.label")} -{" "}
                        {t("documents.modeOption.TRANSLATE_JUR.description")}
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      disabled={isTranslating}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isTranslating || !targetLanguage || !mode}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                    >
                      {isTranslating ? (
                        <>
                          <UpdateIcon className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                          Translating...
                        </>
                      ) : (
                        "Start Translation"
                      )}
                    </button>
                  </div>
                </fieldset>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
