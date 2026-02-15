import { Link, useLoaderData, useRevalidator, useFetcher } from "react-router";
import type { Route } from "./+types/index";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { TranslateButton } from "~/components/TranslateButton";
import { t } from "~/lib/i18n/i18n";
import type { TranslationJob } from "~/types/document";
import { DocumentStatus } from "~/generated/client/enums";
import { prisma } from "~/lib/db/client";
import { useEffect } from "react";
import { getOriginalDocumentPreviewUrl } from "~/lib/services/document.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  // Get real documents from database
  const dbDocuments = await prisma.document.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1, // Get the latest job for each document
      },
    },
  });

  // Transform database documents to match the frontend type
  const documents: TranslationJob[] = await Promise.all(
    dbDocuments.map(async (doc) => {
      const fileUrl = await getOriginalDocumentPreviewUrl(doc);

      return {
        id: doc.id,
        userId: doc.userId,
        files: [
          {
            id: doc.id,
            name: doc.originalName,
            size: doc.fileSize,
            type: doc.mimeType,
            url: fileUrl,
            uploadedAt: doc.createdAt.toISOString(),
          },
        ],
        sourceLanguage: doc.sourceLanguage,
        targetLanguage: doc.targetLanguage || "",
        mode: doc.mode,
        status: doc.status,
        result: doc.translatedText || doc.extractedText || undefined,
        resultUrl:
          doc.status === "COMPLETED"
            ? `/documents/download/${doc.id}`
            : undefined,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        progress: calculateProgress(doc.status),
        error: doc.errorMessage || "Unknown error",
        tokensUsed: doc.tokensUsed || undefined,
      };
    }),
  );

  return { user, documents };
}

function calculateProgress(status: string): number {
  switch (status) {
    case "COMPLETED":
      return 100;
    case "PROCESSING":
      return 50;
    case "FAILED":
      return 0;
    case "PENDING":
    default:
      return 0;
  }
}

export default function Documents() {
  const { user, documents } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const retryFetcher = useFetcher();

  const getStatusBadge = (status: TranslationJob["status"]) => {
    switch (status) {
      case DocumentStatus.COMPLETED:
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case DocumentStatus.PROCESSING:
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300";
      case DocumentStatus.PENDING:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300";
      case DocumentStatus.FAILED:
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300";
    }
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      // Don't revalidate if already loading or if retry fetcher is working
      if (revalidator.state === "loading" || retryFetcher.state !== "idle")
        return;

      if (
        documents.every(
          (doc) =>
            doc.status !== DocumentStatus.PROCESSING &&
            doc.status !== DocumentStatus.PENDING,
        )
      )
        return;

      revalidator.revalidate();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [documents, revalidator, retryFetcher.state]);

  function handleRetry(documentId: string) {
    if (confirm("Are you sure you want to retry processing this document?")) {
      retryFetcher.submit(
        { documentId },
        { method: "post", action: "/resources/retry-document" },
      );
    }
  }

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t("documents.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {t("documents.manageDocuments")}
            </p>
          </div>
          <Link
            to="/documents/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <svg
              className="-ml-1 mr-2 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            {t("documents.uploadButton")}
          </Link>
        </div>

        {documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className="shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-45">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                            title={doc.files[0].name}
                          >
                            {doc.files.length === 1
                              ? doc.files[0].name
                              : `${doc.files.length} files`}
                          </Link>
                        </h3>
                        {doc.files.length > 1 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-45">
                            {doc.files.map((f) => f.name).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                        doc.status,
                      )}`}
                    >
                      {t(`documents.status.${doc.status}`)}
                    </span>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("documents.table.mode")}
                        </p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {t(`documents.modeOption.${doc.mode}.label`)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("documents.table.createdAt")}
                        </p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(doc.createdAt).toLocaleDateString("en-US")}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Languages
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        <span className="truncate max-w-25">
                          {t(`languages.${doc.sourceLanguage}`)}
                        </span>
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="truncate max-w-25">
                          {t(`languages.${doc.targetLanguage}`)}
                        </span>
                      </p>
                    </div>

                    {doc.tokensUsed !== undefined && doc.tokensUsed > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Tokens Used
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {doc.tokensUsed.toFixed(2)}
                        </p>
                      </div>
                    )}

                    {doc.status === DocumentStatus.PROCESSING &&
                      doc.progress && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${doc.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-center text-gray-500 mt-1">
                            Processing...
                          </p>
                        </div>
                      )}

                    {doc.status === DocumentStatus.FAILED && doc.error && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        Error: {doc.error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    to={`/documents/${doc.id}`}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                    title={t("common.view")}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </Link>

                  {doc.files[0].url && (
                    <a
                      href={doc.files[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                      title="Preview original file"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </a>
                  )}

                  {doc.status === DocumentStatus.COMPLETED && (
                    <>
                      <TranslateButton
                        documentId={doc.id}
                        currentSourceLanguage={doc.sourceLanguage}
                        onError={(error) => alert(error)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                      />

                      <a
                        href={`/documents/export/${doc.id}`}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                        title="Export DOCX"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </a>
                    </>
                  )}

                  {doc.status === DocumentStatus.FAILED && (
                    <button
                      type="button"
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                      title="Retry"
                      onClick={() => handleRetry(doc.id)}
                      disabled={retryFetcher.state !== "idle"}
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}

                  <button
                    type="button"
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                    title={t("common.delete")}
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to delete this document?",
                        )
                      ) {
                        alert("Delete functionality would be implemented here");
                      }
                    }}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              {t("documents.noDocuments")}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t("documents.uploadFirst")}
            </p>
            <div className="mt-6">
              <Link
                to="/documents/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                {t("documents.uploadButton")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
