import { useState } from "react";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from "react-router";
import type { Route } from "./+types/upload";
import { requireUser } from "~/lib/auth/session.server";
import { processDocument } from "~/lib/services/document-processor.server";
import { Layout } from "~/components/Layout";
import { DirectUpload } from "~/components/DirectUpload";
import { t } from "~/lib/i18n/i18n";
import { SUPPORTED_LANGUAGES, PROCESSING_MODES } from "~/types/document";
import { ProcessingMode } from "~/generated/client/enums";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const rawFiles = formData.get("files") as string;
  const sourceLanguage = formData.get("sourceLanguage") as string;
  const targetLanguage = formData.get("targetLanguage") as string;
  const mode = formData.get("mode") as ProcessingMode;

  if (!rawFiles || !sourceLanguage || !targetLanguage || !mode) {
    return {
      error: t("documents.upload.fillAllFields"),
    };
  }

  if (
    sourceLanguage === targetLanguage &&
    (mode === ProcessingMode.TRANSLATE || mode === ProcessingMode.TRANSLATE_JUR)
  ) {
    return {
      error: t("documents.upload.languagesDifferent"),
    };
  }

  try {
    const files = JSON.parse(rawFiles) as Array<{
      objectName: string;
      originalName: string;
      mimeType: string;
      size: number;
    }>;

    if (!files.length) {
      return {
        error: t("documents.upload.fillAllFields"),
      };
    }

    const result = await processDocument({
      files,
      sourceLanguage,
      targetLanguage,
      mode,
      userId: user.id,
    });

    if (!result.success) {
      return {
        error: result.error || "Processing failed",
      };
    }

    return redirect("/documents");
  } catch (error) {
    console.error("Upload error:", error);
    return {
      error: t("documents.upload.uploadError"),
    };
  }
}

export default function DocumentUpload() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      objectName: string;
      originalName: string;
      mimeType: string;
      size: number;
    }>
  >([]);
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [mode, setMode] = useState<ProcessingMode>(ProcessingMode.TRANSLATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!uploadedFiles.length || !sourceLanguage || !targetLanguage || !mode) {
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.set("files", JSON.stringify(uploadedFiles));
    formData.set("sourceLanguage", sourceLanguage);
    formData.set("targetLanguage", targetLanguage);
    formData.set("mode", mode);

    // Submit the form data
    const response = await fetch("/documents/upload", {
      method: "POST",
      body: formData,
    });

    if (response.redirected) {
      window.location.href = response.url;
    } else {
      const result = await response.json();
      if (result.error) {
        setIsSubmitting(false);
        // Error will be shown in actionData
      }
    }
  };

  return (
    <Layout user={user}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("documents.upload.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload documents for AI-powered translation and processing
          </p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <Form
            method="post"
            encType="multipart/form-data"
            onSubmit={handleSubmit}
            className="p-6 space-y-6"
          >
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t("documents.upload.documents")}
              </label>
              <DirectUpload
                onFilesReady={setUploadedFiles}
                multiple={true}
                disabled={isSubmitting}
              />
            </div>

            {/* Source Language */}
            <div>
              <label
                htmlFor="sourceLanguage"
                className="block text-sm font-medium text-gray-700"
              >
                {t("documents.upload.sourceLanguage")}
              </label>
              <select
                id="sourceLanguage"
                name="sourceLanguage"
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                required
              >
                <option value="">{t("documents.upload.selectLanguage")}</option>
                <option value="auto">
                  {t("documents.upload.sourceLanguageAuto")}
                </option>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Language */}
            <div>
              <label
                htmlFor="targetLanguage"
                className="block text-sm font-medium text-gray-700"
              >
                {t("documents.upload.targetLanguage")}
              </label>
              <select
                id="targetLanguage"
                name="targetLanguage"
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                required
              >
                <option value="">{t("documents.upload.selectLanguage")}</option>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Processing Mode */}
            <div>
              <label
                htmlFor="mode"
                className="block text-sm font-medium text-gray-700"
              >
                {t("documents.upload.mode")}
              </label>
              <select
                id="mode"
                name="mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as ProcessingMode)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                required
              >
                {Object.entries(PROCESSING_MODES).map(([key, modeOption]) => (
                  <option key={key} value={key}>
                    {t(`documents.modeOption.${key}.label`)} -{" "}
                    {t(`documents.modeOption.${key}.description`)}
                  </option>
                ))}
              </select>
            </div>

            {actionData?.error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{actionData.error}</div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t("common.back")}
              </button>

              <button
                type="submit"
                disabled={
                  !uploadedFiles.length ||
                  !sourceLanguage ||
                  !targetLanguage ||
                  !mode ||
                  isSubmitting
                }
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {t("documents.upload.processing", {
                      count: uploadedFiles.length.toString(),
                    })}
                  </div>
                ) : (
                  t("documents.upload.submit")
                )}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </Layout>
  );
}
