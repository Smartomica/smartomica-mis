import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { DownloadButton } from "~/components/DownloadButton";
import { TranslateButton } from "~/components/TranslateButton";
import { t } from "~/lib/i18n/i18n";
import type { TranslationJob } from "~/types/document";
import { DocumentStatus } from "~/generated/client/enums";
import { prisma } from "~/lib/db/client";

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
  const documents: TranslationJob[] = dbDocuments.map((doc) => {
    const latestJob = doc.jobs[0];

    return {
      id: doc.id,
      userId: doc.userId,
      files: [
        {
          id: doc.id,
          name: doc.originalName,
          size: doc.fileSize,
          type: doc.mimeType,
          url: `/files/${doc.filename}`, // This would need to be the actual file serving route
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
    };
  });

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
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {t("documents.table.name")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {t("documents.table.mode")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {t("documents.table.sourceLanguage")} →{" "}
                    {t("documents.table.targetLanguage")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {t("documents.table.status")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {t("documents.table.createdAt")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {t("documents.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="shrink-0 h-10 w-10">
                          <svg
                            className="h-10 w-10 text-gray-400 dark:text-gray-500"
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
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {doc.files.length === 1
                              ? doc.files[0].name
                              : `${doc.files.length} files`}
                          </div>
                          {doc.files.length > 1 && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {doc.files.map((f) => f.name).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {t(`documents.modeOption.${doc.mode}.label`)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {t(`languages.${doc.sourceLanguage}`)} →{" "}
                      {t(`languages.${doc.targetLanguage}`)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(doc.status)}`}
                      >
                        {t(`documents.status.${doc.status}`)}
                      </span>
                      {doc.status === DocumentStatus.PROCESSING &&
                        doc.progress && (
                          <div className="mt-1 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${doc.progress}%` }}
                            />
                          </div>
                        )}
                      {doc.status === DocumentStatus.FAILED && doc.error && (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {doc.error}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(doc.createdAt).toLocaleString("en-US")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {doc.status === DocumentStatus.COMPLETED && (
                        <>
                          <DownloadButton documentId={doc.id}>
                            <svg
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            {t("common.download")}
                          </DownloadButton>
                          
                          <TranslateButton
                            documentId={doc.id}
                            currentSourceLanguage={doc.sourceLanguage}
                            onError={(error) => alert(error)}
                          />
                        </>
                      )}

                      {doc.status === DocumentStatus.FAILED && (
                        <button
                          type="button"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 inline-flex items-center"
                          onClick={() => {
                            // In production, implement retry logic
                            alert(
                              "Retry functionality would be implemented here",
                            );
                          }}
                        >
                          <svg
                            className="h-4 w-4 mr-1"
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
                          Retry
                        </button>
                      )}

                      <button
                        type="button"
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 inline-flex items-center"
                        onClick={() => {
                          // In production, implement delete logic
                          if (
                            confirm(
                              "Are you sure you want to delete this document?",
                            )
                          ) {
                            alert(
                              "Delete functionality would be implemented here",
                            );
                          }
                        }}
                      >
                        <svg
                          className="h-4 w-4 mr-1"
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
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 shadow rounded-lg">
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
