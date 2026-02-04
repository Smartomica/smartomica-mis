import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { t } from "~/lib/i18n/i18n";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  
  // Simulate document stats - in production, fetch from database
  const stats = {
    totalDocuments: 12,
    inProgress: 2,
    completed: 10,
  };

  // Simulate recent documents - in production, fetch from database
  const recentDocuments = [
    {
      id: "1",
      name: "Medical Report.pdf",
      status: "completed" as const,
      createdAt: "2024-02-04T09:30:00Z",
      mode: "translate" as const,
      sourceLanguage: "en",
      targetLanguage: "ru",
    },
    {
      id: "2", 
      name: "Lab Results.docx",
      status: "processing" as const,
      createdAt: "2024-02-04T10:15:00Z",
      mode: "summarize" as const,
      sourceLanguage: "ru",
      targetLanguage: "en",
    },
    {
      id: "3",
      name: "Prescription.jpg",
      status: "completed" as const,
      createdAt: "2024-02-03T16:45:00Z",
      mode: "ocr" as const,
      sourceLanguage: "he",
      targetLanguage: "en",
    },
  ];

  return { user, stats, recentDocuments };
}

export default function Dashboard() {
  const { user, stats, recentDocuments } = useLoaderData<typeof loader>();

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("dashboard.welcome", { name: user.name })}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("dashboard.manageDocuments")}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t("dashboard.stats.totalDocuments")}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.totalDocuments}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t("dashboard.stats.inProgress")}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.inProgress}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t("dashboard.stats.completed")}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
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
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
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
                    className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t("common.upload")}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    {t("dashboard.myDocuments")}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {t("dashboard.viewAllDocuments")}
                  </p>
                  <Link
                    to="/documents"
                    className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    View Documents
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              {t("dashboard.recentDocuments")}
            </h3>
            
            {recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">
                          {t(`documents.mode.${doc.mode}`)} • {t(`languages.${doc.sourceLanguage}`)} → {t(`languages.${doc.targetLanguage}`)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        doc.status === "completed" 
                          ? "bg-green-100 text-green-800"
                          : doc.status === "processing"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {t(`documents.status.${doc.status}`)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {t("dashboard.noDocuments")}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t("dashboard.uploadFirstDocument")}
                </p>
                <div className="mt-6">
                  <Link
                    to="/documents/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
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