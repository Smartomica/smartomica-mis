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
import {
  PlusIcon,
  FileTextIcon,
  OpenInNewWindowIcon,
  EyeOpenIcon,
  DownloadIcon,
  ReloadIcon,
  TrashIcon,
  LayersIcon,
} from "@radix-ui/react-icons";

type DisplayItem = TranslationJob & {
  isBatch: boolean;
  batchId?: string;
  documentCount: number;
  documents?: { id: string; name: string; status: DocumentStatus }[];
};

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
      batch: {
        include: {
          jobs: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  // Group by batchId
  const groupedItems = new Map<string, typeof dbDocuments>();
  const singleItems: typeof dbDocuments = [];

  for (const doc of dbDocuments) {
    if (doc.batchId) {
      if (!groupedItems.has(doc.batchId)) {
        groupedItems.set(doc.batchId, []);
      }
      groupedItems.get(doc.batchId)!.push(doc);
    } else {
      singleItems.push(doc);
    }
  }

  // Transform database documents to match the frontend type
  const displayItems: DisplayItem[] = [];

  // Process single documents
  for (const doc of singleItems) {
    const fileUrl = await getOriginalDocumentPreviewUrl(doc);
    displayItems.push({
      id: doc.id,
      userId: doc.userId,
      isBatch: false,
      documentCount: 1,
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
    });
  }

  // Process batches
  for (const [batchId, docs] of groupedItems) {
    if (docs.length === 0) continue;

    const representative = docs[0];
    const batch = representative.batch;

    // If a batch has only 1 document, treat it as a single file
    if (docs.length === 1) {
      const doc = docs[0];
      const fileUrl = await getOriginalDocumentPreviewUrl(doc);

      let status = doc.status;
      let error = doc.errorMessage;
      const batchJob = doc.batch?.jobs?.[0];
      if (doc.batch && batchJob && batchJob.status === "FAILED") {
        status = DocumentStatus.FAILED;
        error = batchJob.errorMessage || error || "Batch processing failed";
      }

      displayItems.push({
        id: doc.id,
        userId: doc.userId,
        isBatch: false,
        documentCount: 1,
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
        status: status,
        result: doc.translatedText || doc.extractedText || undefined,
        resultUrl:
          status === "COMPLETED" ? `/documents/download/${doc.id}` : undefined,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        progress: calculateProgress(status),
        error: error || "Unknown error",
        tokensUsed: doc.tokensUsed || undefined,
      });
      continue;
    }

    let batchStatus = batch?.status || DocumentStatus.PENDING;
    let batchError = "";

    const batchJob = batch?.jobs?.[0];
    if (batchJob && batchJob.status === "FAILED") {
      batchStatus = DocumentStatus.FAILED;
      batchError = batchJob.errorMessage || "Batch processing failed";
    }

    displayItems.push({
      id: representative.id, // Link to the first document as entry point
      userId: representative.userId,
      isBatch: true,
      batchId: batchId,
      documentCount: docs.length,
      documents: docs.map((d) => ({
        id: d.id,
        name: d.originalName,
        status: d.status,
      })),
      files: docs.map((d) => ({
        id: d.id,
        name: d.originalName,
        size: d.fileSize,
        type: d.mimeType,
        url: null,
        uploadedAt: d.createdAt.toISOString(),
      })),
      sourceLanguage: representative.sourceLanguage,
      targetLanguage: representative.targetLanguage || "",
      mode: representative.mode,
      status: batchStatus,
      result: undefined, // Batches might not have a single result text
      createdAt:
        batch?.createdAt.toISOString() ||
        representative.createdAt.toISOString(),
      updatedAt:
        batch?.updatedAt.toISOString() ||
        representative.updatedAt.toISOString(),
      progress: calculateProgress(batchStatus),
      error: batchError,
      tokensUsed: docs.reduce((sum, d) => sum + (d.tokensUsed || 0), 0),
    });
  }

  // Sort combined list by createdAt desc
  displayItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return { user, documents: displayItems };
}

function calculateProgress(status: string): number {
  switch (status) {
    case "COMPLETED":
      return 100;
    case "PROCESSING":
    case "RUNNING":
      return 50;
    case "FAILED":
      return 0;
    case "PENDING":
    case "QUEUED":
    default:
      return 0;
  }
}

export default function Documents() {
  const { user, documents } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const retryFetcher = useFetcher();

  const getStatusBadge = (status: string) => {
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
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            {t("documents.uploadButton")}
          </Link>
        </div>

        {documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div
                        className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-lg ${item.isBatch ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"}`}
                      >
                        {item.isBatch ? (
                          <LayersIcon className="h-6 w-6" />
                        ) : (
                          <FileTextIcon className="h-6 w-6" />
                        )}
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-45">
                          <Link
                            to={`/documents/${item.id}`}
                            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                            title={
                              item.isBatch ? "View Batch" : item.files[0].name
                            }
                          >
                            {item.isBatch
                              ? `Batch of ${item.documentCount} files`
                              : item.files[0].name}
                          </Link>
                        </h3>
                        {item.isBatch ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-45">
                            {item.documents?.[0].name}, +
                            {item.documentCount - 1} more
                          </div>
                        ) : (
                          item.files.length > 1 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-45">
                              {item.files.map((f) => f.name).join(", ")}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                        item.status,
                      )}`}
                    >
                      {item.isBatch && item.status === "PENDING"
                        ? "PROCESSING"
                        : t(`documents.status.${item.status}`)}
                    </span>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("documents.table.mode")}
                        </p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {t(`documents.modeOption.${item.mode}.label`)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t("documents.table.createdAt")}
                        </p>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(item.createdAt).toLocaleDateString("en-US")}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Languages
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        <span className="truncate max-w-25">
                          {t(`languages.${item.sourceLanguage}`)}
                        </span>
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="truncate max-w-25">
                          {t(`languages.${item.targetLanguage}`)}
                        </span>
                      </p>
                    </div>

                    {item.tokensUsed !== undefined && item.tokensUsed > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Tokens Used
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.tokensUsed.toFixed(2)}
                        </p>
                      </div>
                    )}

                    {item.status === DocumentStatus.PROCESSING &&
                      item.progress && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-center text-gray-500 mt-1">
                            Processing...
                          </p>
                        </div>
                      )}

                    {item.status === DocumentStatus.FAILED && item.error && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        Error: {item.error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    to={`/documents/${item.id}`}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                    title={t("common.view")}
                  >
                    <OpenInNewWindowIcon className="h-5 w-5" />
                  </Link>

                  {!item.isBatch && item.files[0]?.url && (
                    <a
                      href={item.files[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                      title="Preview original file"
                    >
                      <EyeOpenIcon className="h-5 w-5" />
                    </a>
                  )}

                  {!item.isBatch &&
                    item.status === DocumentStatus.COMPLETED && (
                      <>
                        <TranslateButton
                          documentId={item.id}
                          currentSourceLanguage={item.sourceLanguage}
                          onError={(error) => alert(error)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                        />

                        <a
                          href={`/documents/export/${item.id}`}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                          title="Export DOCX"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <DownloadIcon className="h-5 w-5" />
                        </a>
                      </>
                    )}

                  {!item.isBatch && item.status === DocumentStatus.FAILED && (
                    <button
                      type="button"
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-white dark:hover:bg-gray-600 rounded-full transition-colors"
                      title="Retry"
                      onClick={() => handleRetry(item.id)}
                      disabled={retryFetcher.state !== "idle"}
                    >
                      <ReloadIcon className="h-5 w-5" />
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
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
            <FileTextIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
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
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                {t("documents.uploadButton")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
