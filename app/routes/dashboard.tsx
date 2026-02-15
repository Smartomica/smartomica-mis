import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { t } from "~/lib/i18n/i18n";
import { prisma } from "~/lib/db/client";
import { DocumentStatus } from "~/generated/client/enums";
import { FileTextIcon, TimerIcon, CheckCircledIcon, UploadIcon, PlusIcon } from "@radix-ui/react-icons";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  // Get real document stats from database
  const [totalDocuments, inProgress, completed] = await Promise.all([
    prisma.document.count({ where: { userId: user.id } }),
    prisma.document.count({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    }),
    prisma.document.count({
      where: {
        userId: user.id,
        status: "COMPLETED",
      },
    }),
  ]);

  const stats = {
    totalDocuments,
    inProgress,
    completed,
  };

  // Get recent documents from database
  const recentDocs = await prisma.document.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentDocuments = recentDocs.map((doc) => ({
    id: doc.id,
    name: doc.originalName,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    mode: mapProcessingMode(doc.mode),
    sourceLanguage: doc.sourceLanguage,
    targetLanguage: doc.targetLanguage || "",
  }));

  return { user, stats, recentDocuments };
}

// Helper function to map database enum to frontend types
function mapProcessingMode(mode: string) {
  switch (mode) {
    case "OCR_ONLY":
      return "ocr" as const;
    case "TRANSLATE_ONLY":
      return "translate" as const;
    case "OCR_AND_TRANSLATE":
      return "summarize" as const; // Using "summarize" as the closest match for combined processing
    default:
      return "ocr" as const;
  }
}

export default function Dashboard() {
  const { user, stats, recentDocuments } = useLoaderData<typeof loader>();

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("dashboard.welcome", { name: user.name })}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("dashboard.manageDocuments")}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <FileTextIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {t("dashboard.stats.totalDocuments")}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {stats.totalDocuments}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <TimerIcon className="h-6 w-6 text-orange-400 dark:text-orange-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {t("dashboard.stats.inProgress")}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {stats.inProgress}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="shrink-0">
                  <CheckCircledIcon className="h-6 w-6 text-green-400 dark:text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {t("dashboard.stats.completed")}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {stats.completed}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-8">
          <div className="bg-linear-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-lg shadow-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="shrink-0">
                  <UploadIcon className="h-8 w-8 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <h3 className="text-lg font-medium text-white">
                    {t("dashboard.uploadNew")}
                  </h3>
                  <p className="text-sm text-blue-100 mt-1">
                    {t("dashboard.uploadNewDescription")}
                  </p>
                  <Link
                    to="/documents/upload"
                    className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 dark:text-blue-700 bg-white dark:bg-gray-100 hover:bg-blue-50 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    {t("common.upload")}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center">
                <div className="shrink-0">
                  <FileTextIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {t("dashboard.myDocuments")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t("dashboard.viewAllDocuments")}
                  </p>
                  <Link
                    to="/documents"
                    className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    View Documents
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t("dashboard.recentDocuments")}
            </h3>

            {recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="shrink-0">
                        <FileTextIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="hover:underline hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {doc.name}
                          </Link>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t(`documents.mode.${doc.mode}`)} •{" "}
                          {t(`languages.${doc.sourceLanguage}`)} →{" "}
                          {t(`languages.${doc.targetLanguage}`)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          doc.status === DocumentStatus.COMPLETED
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : doc.status === DocumentStatus.PROCESSING
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {t(`documents.status.${doc.status}`)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileTextIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t("dashboard.noDocuments")}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("dashboard.uploadFirstDocument")}
                </p>
                <div className="mt-6">
                  <Link
                    to="/documents/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                    {t("dashboard.uploadNew")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
