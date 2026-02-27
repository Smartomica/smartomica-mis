import { useEffect, useRef, useState } from "react";
import {
  Form,
  redirect,
  useActionData,
  useFetcher,
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
import type { FormUploadFile } from "~/hooks/useFormUpload";
import { UpdateIcon } from "@radix-ui/react-icons";
import { Lang } from "~/lib/services/document-processor.server/const";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const sourceLanguage = formData.get("sourceLanguage") as string;
  const targetLanguage = formData.get("targetLanguage") as string;
  const mode = formData.get("mode") as ProcessingMode;

  const rawFiles = formData.get("files") as string;

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
      name: string;
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
  const uploadFetcher = useFetcher<typeof action>();
  const consentFetcher = useFetcher<{ success: boolean }>();

  const formRef = useRef<HTMLFormElement>(null);

  const [uploadedFiles, setUploadedFiles] = useState<FormUploadFile[]>([]);
  const [sourceLanguage, setSourceLanguage] = useState(Lang.Auto);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [isSubmitPressed, setSubmitPressed] = useState(false);
  const [mode, setMode] = useState<ProcessingMode>(ProcessingMode.TRANSLATE);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(!!user.lastConsentAt);

  const isSubmitting = isSubmitPressed || uploadFetcher.state === "submitting";

  useEffect(() => {
    if (!consentFetcher.data?.success) return;

    setHasConsented(true);
    setShowConsentModal(false);

    if (!formRef.current) return;
    handleSubmit(null);
  }, [consentFetcher.data]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | null) => {
    setSubmitPressed(true);
    e?.preventDefault();

    if (!uploadedFiles.length || !sourceLanguage || !targetLanguage || !mode) {
      return;
    }

    if (!hasConsented) {
      setShowConsentModal(true);
      return;
    }

    // Transform FormUploadFile[] to the expected format for processDocument
    const filesForProcessing = uploadedFiles.map((file) => ({
      objectName: file.objectName,
      name: file.file.name,
      mimeType: file.file.type,
      size: file.file.size,
    }));

    const formData = new FormData();
    formData.set("files", JSON.stringify(filesForProcessing));
    formData.set("sourceLanguage", sourceLanguage);
    formData.set("targetLanguage", targetLanguage);
    formData.set("mode", mode);

    // Submit the form data
    await uploadFetcher.submit(formData, {
      method: "POST",
      unstable_defaultShouldRevalidate: false,
    });
  };

  function onConsentAgree() {
    consentFetcher.submit(
      {},
      { method: "POST", action: "/resources/consent-tos" },
    );
  }

  useEffect(() => {
    const result = uploadFetcher.data;
    if (!result) return;

    if (result.error) {
      console.error(result.error);
    }
  }, [uploadFetcher.data]);

  return (
    <Layout user={user}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showConsentModal && (
          <DataProcessingConsent
            isLoading={consentFetcher.state !== "idle"}
            onDisagree={() => setShowConsentModal(false)}
            onAgree={onConsentAgree}
          />
        )}

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("documents.upload.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Upload documents for AI-powered translation and processing
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <Form
            ref={formRef}
            method="post"
            encType="multipart/form-data"
            onSubmit={handleSubmit}
            className="p-6"
          >
            <fieldset className="contents space-y-6" disabled={isSubmitting}>
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t("documents.upload.documents")}
                </label>
                <DirectUpload
                  onFilesReady={setUploadedFiles}
                  multiple={true}
                  disabled={isSubmitting}
                />
              </div>

              {/* Source Language */}
              <div className="hidden invisible">
                <label
                  htmlFor="sourceLanguage"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("documents.upload.sourceLanguage")}
                </label>
                <select
                  id="sourceLanguage"
                  name="sourceLanguage"
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value as Lang)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm rounded-md"
                  required
                >
                  <option value="">
                    {t("documents.upload.selectLanguage")}
                  </option>
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
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("documents.upload.targetLanguage")}
                </label>
                <select
                  id="targetLanguage"
                  name="targetLanguage"
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm rounded-md"
                  required
                >
                  <option value="">
                    {t("documents.upload.selectLanguage")}
                  </option>
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
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t("documents.upload.mode")}
                </label>
                <select
                  id="mode"
                  name="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ProcessingMode)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm rounded-md"
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
                <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                  <div className="text-sm text-red-700 dark:text-red-300">
                    {actionData.error}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
                  className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <UpdateIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                      {t("documents.upload.processing", {
                        count: uploadedFiles.length.toString(),
                      })}
                    </div>
                  ) : (
                    t("documents.upload.submit")
                  )}
                </button>
              </div>
            </fieldset>
          </Form>
        </div>
      </div>
    </Layout>
  );
}

function DataProcessingConsent({
  isLoading,
  onDisagree,
  onAgree,
}: {
  isLoading: boolean;
  onDisagree(): void;
  onAgree(): void;
}) {
  const [isChecked, setIsChecked] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const checkBoxRef = useRef<HTMLInputElement>(null);

  const blocks = [
    "block1",
    "block2",
    "block3",
    "block4",
    "block5",
    "block6",
  ].map(function (blockName) {
    const text = t(`fileUpload.consent.${blockName}`);
    const dot = text.indexOf(".");
    const firstSentence = text.slice(0, dot + 1);
    const rest = text.slice(dot + 1);
    return [firstSentence, rest] as const;
  });

  function handleConsent() {
    if (!checkBoxRef.current) return;
    if (!isChecked) {
      setIsHighlighted(true);
      checkBoxRef.current.focus();
      return;
    }
    onAgree();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <article className="prose-sm bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-xxl w-full mx-4">
        <h2 className=" text-gray-900 dark:text-gray-100">
          {t("fileUpload.consent.title")}
        </h2>
        <p className=" text-gray-600 dark:text-gray-300">
          {t("fileUpload.consent.block0")}
        </p>
        {blocks.map(function ([firstSentence, rest]) {
          return (
            <p
              key={firstSentence}
              className=" text-gray-600 dark:text-gray-300"
            >
              <span className="font-bold">{firstSentence}</span>
              <span className="text-gray-600 dark:text-gray-300">{rest}</span>
            </p>
          );
        })}

        <label>
          <input
            ref={checkBoxRef}
            type="checkbox"
            className={isHighlighted ? "border-red-500" : ""}
            checked={isChecked}
            onChange={() => setIsChecked(!isChecked)}
          />
          <span className={isHighlighted ? "text-red-500 ms-2" : "ms-2"}>
            {t("fileUpload.consent.consent")}
          </span>
        </label>
        <p className=" text-gray-600 dark:text-gray-300">
          {t("fileUpload.consent.footer")}
        </p>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onDisagree}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t("fileUpload.consent.disagree")}
          </button>
          <button
            type="button"
            onClick={handleConsent}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? t("common.loading") : t("fileUpload.consent.agree")}
          </button>
        </div>
      </article>
    </div>
  );
}
