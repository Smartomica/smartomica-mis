import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/$id";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { prisma } from "~/lib/db/client";
import { t } from "~/lib/i18n/i18n";
import { DocumentStatus } from "~/generated/client/enums";
import { DownloadButton } from "~/components/DownloadButton";

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
    },
  });

  if (!document || document.userId !== user.id) {
    throw new Response("Not Found", { status: 404 });
  }

  return { user, document };
}

export default function DocumentDetails() {
  const { user, document } = useLoaderData<typeof loader>();

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

        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                {document.originalName}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                {t("documents.details.subtitle")}
              </p>
            </div>
            <div className="flex space-x-3">
              {document.status === DocumentStatus.COMPLETED && (
                <>
                  <a
                    href={`/documents/export/${document.id}`}
                    className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                    title="Export DOCX"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
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
                  {new Date(document.createdAt).toLocaleString()}
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
                  dangerouslySetInnerHTML={{ __html: document.translatedText }}
                  className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
