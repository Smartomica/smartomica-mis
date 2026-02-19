import { Link, useLoaderData, NavLink } from "react-router";
import type { Route } from "./+types/$id";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { prisma } from "~/lib/db/client";
import { t } from "~/lib/i18n/i18n";
import { DocumentStatus } from "~/generated/client/enums";
import { getOriginalDocumentPreviewUrl } from "~/lib/services/document.server";
import { getFileUrl } from "~/lib/storage/minio.server";
import { EyeOpenIcon, DownloadIcon, LayersIcon } from "@radix-ui/react-icons";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { id } = params;

  if (!id) {
    throw new Response("Not Found", { status: 404 });
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      batch: {
        include: {
          jobs: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          documents: {
            select: {
              id: true,
              originalName: true,
              status: true,
              filePath: true,
              mimeType: true,
            },
            orderBy: { originalName: "asc" },
          },
        },
      },
    },
  });

  if (!document || document.userId !== user.id) {
    throw new Response("Not Found", { status: 404 });
  }

  // Sync status if batch failed
  if (
    document.batch &&
    document.batch.jobs[0]?.status === "FAILED" &&
    document.status !== "FAILED"
  ) {
    document.status = DocumentStatus.FAILED;
    document.errorMessage =
      document.batch.jobs[0].errorMessage || "Batch processing failed";
  }

  const siblings = await Promise.all(
    (document.batch?.documents || []).map(async (doc) => {
      const isDoc =
        doc.mimeType.includes("word") ||
        doc.mimeType.includes("officedocument") ||
        doc.originalName.endsWith(".doc") ||
        doc.originalName.endsWith(".docx");

      return {
        ...doc,
        fileUrl: isDoc ? null : await getFileUrl(doc.filePath),
      };
    }),
  );

  const fileUrl = await getOriginalDocumentPreviewUrl(document);

  return { user, document, fileUrl, siblings };
}

export default function DocumentDetails() {
  const { user, document, fileUrl, siblings } = useLoaderData<typeof loader>();

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

  // Determine the title: specific document name if single, or enumeration if batch
  const pageTitle =
    siblings.length > 1
      ? siblings.map((s) => s.originalName).join(", ")
      : document.originalName;

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            to="/documents"
            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
          >
            ← {t("common.back")}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    {pageTitle}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                    {t("documents.details.subtitle")}
                  </p>
                </div>
                <div className="flex space-x-3">
                  {/* Keep header preview button only for single files */}
                  {fileUrl && siblings.length <= 1 && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900 inline-flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-md"
                    >
                      <EyeOpenIcon className="h-4 w-4 mr-1" />
                      Original
                    </a>
                  )}
                  {document.status === DocumentStatus.COMPLETED && (
                    <>
                      <a
                        href={`/documents/export/${document.id}`}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                        title="Export DOCX"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <DownloadIcon className="h-4 w-4 mr-1" />
                        Export DOCX
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700">
                <dl>
                  <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("documents.table.status")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          document.status,
                        )}`}
                      >
                        {t(`documents.status.${document.status}`)}
                      </span>
                      {document.errorMessage && (
                        <p className="mt-2 text-red-600 text-xs">
                          {document.errorMessage}
                        </p>
                      )}
                    </dd>
                  </div>
                  <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("documents.table.mode")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                      {t(`documents.modeOption.${document.mode}.label`)}
                    </dd>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("documents.table.sourceLanguage")} →{" "}
                      {t("documents.table.targetLanguage")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                      {t(`languages.${document.sourceLanguage}`)} →{" "}
                      {t(`languages.${document.targetLanguage}`)}
                    </dd>
                  </div>
                  <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t("documents.table.createdAt")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                      {new Date(document.createdAt).toLocaleString("en-US")}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {document.translatedText && (
              <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    {t("documents.details.content")}
                  </h3>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {t("documents.details.translated")}
                    </h4>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: document.translatedText,
                      }}
                      className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar / Siblings (Batch Files) */}
          {siblings.length > 1 && (
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 sticky top-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <LayersIcon className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    Batch Files ({siblings.length})
                  </h3>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {siblings.map((sib) => (
                    <li key={sib.id} className="relative group">
                      {/* Using div instead of NavLink to remove selection UI */}
                      <div className="block px-4 py-3 pr-10 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-l-4 border-transparent">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                            {sib.originalName}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${sib.status === "COMPLETED" ? "bg-green-100 text-green-700" : sib.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}
                          >
                            {sib.status}
                          </span>
                        </div>
                      </div>
                      {/* Show preview eye on ALL items if valid URL */}
                      {sib.fileUrl && (
                        <a
                          href={sib.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 bg-white/50 hover:bg-white dark:bg-gray-700/50 dark:hover:bg-gray-600 rounded-full transition-all"
                          title="Preview original"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EyeOpenIcon className="w-4 h-4" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
