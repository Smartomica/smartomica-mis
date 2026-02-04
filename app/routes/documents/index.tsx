import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { requireUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { t } from "~/lib/i18n/i18n";
import type { TranslationJob } from "~/types/document";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  
  // Simulate document list - in production, fetch from database
  const documents: TranslationJob[] = [
    {
      id: "1",
      userId: user.id,
      files: [
        {
          id: "1",
          name: "Medical Report.pdf",
          size: 1024000,
          type: "application/pdf",
          url: "/files/medical-report.pdf",
          uploadedAt: "2024-02-04T09:30:00Z",
        }
      ],
      sourceLanguage: "en",
      targetLanguage: "ru",
      mode: "translate",
      status: "completed",
      result: "Translated content here...",
      resultUrl: "/files/medical-report-translated.txt",
      createdAt: "2024-02-04T09:30:00Z",
      updatedAt: "2024-02-04T09:35:00Z",
      progress: 100,
    },
    {
      id: "2",
      userId: user.id,
      files: [
        {
          id: "2",
          name: "Lab Results.docx",
          size: 512000,
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          url: "/files/lab-results.docx",
          uploadedAt: "2024-02-04T10:15:00Z",
        },
        {
          id: "3",
          name: "Additional Notes.txt",
          size: 2048,
          type: "text/plain",
          url: "/files/notes.txt",
          uploadedAt: "2024-02-04T10:16:00Z",
        }
      ],
      sourceLanguage: "ru",
      targetLanguage: "en",
      mode: "summarize",
      status: "processing",
      createdAt: "2024-02-04T10:15:00Z",
      updatedAt: "2024-02-04T10:20:00Z",
      progress: 60,
    },
    {
      id: "3",
      userId: user.id,
      files: [
        {
          id: "4",
          name: "Prescription.jpg",
          size: 256000,
          type: "image/jpeg",
          url: "/files/prescription.jpg",
          uploadedAt: "2024-02-03T16:45:00Z",
        }
      ],
      sourceLanguage: "he",
      targetLanguage: "en",
      mode: "ocr",
      status: "completed",
      result: "Extracted text from prescription...",
      resultUrl: "/files/prescription-ocr.txt",
      createdAt: "2024-02-03T16:45:00Z",
      updatedAt: "2024-02-03T16:46:00Z",
      progress: 100,
    },
    {
      id: "4",
      userId: user.id,
      files: [
        {
          id: "5",
          name: "MRI Report.pdf",
          size: 2048000,
          type: "application/pdf",
          url: "/files/mri-report.pdf",
          uploadedAt: "2024-02-02T14:20:00Z",
        }
      ],
      sourceLanguage: "es",
      targetLanguage: "en",
      mode: "translate",
      status: "failed",
      error: "Translation service temporarily unavailable",
      createdAt: "2024-02-02T14:20:00Z",
      updatedAt: "2024-02-02T14:25:00Z",
      progress: 0,
    },
  ];

  return { user, documents };
}

export default function Documents() {
  const { user, documents } = useLoaderData<typeof loader>();

  const getStatusBadge = (status: TranslationJob["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-orange-100 text-orange-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Layout user={user}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("documents.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {t("documents.manageDocuments")}
            </p>
          </div>
          <Link
            to="/documents/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t("documents.uploadButton")}
          </Link>
        </div>

        {documents.length > 0 ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("documents.table.name")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("documents.table.mode")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("documents.table.sourceLanguage")} → {t("documents.table.targetLanguage")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("documents.table.status")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("documents.table.createdAt")}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("documents.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {doc.files.length === 1 
                              ? doc.files[0].name 
                              : `${doc.files.length} files`}
                          </div>
                          {doc.files.length > 1 && (
                            <div className="text-sm text-gray-500">
                              {doc.files.map(f => f.name).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {t(`documents.mode.${doc.mode}`)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {t(`languages.${doc.sourceLanguage}`)} → {t(`languages.${doc.targetLanguage}`)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(doc.status)}`}>
                        {t(`documents.status.${doc.status}`)}
                      </span>
                      {doc.status === "processing" && doc.progress && (
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${doc.progress}%` }}
                          />
                        </div>
                      )}
                      {doc.status === "failed" && doc.error && (
                        <div className="mt-1 text-xs text-red-600">
                          {doc.error}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {doc.status === "completed" && doc.resultUrl && (
                        <a
                          href={doc.resultUrl}
                          download
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {t("common.download")}
                        </a>
                      )}
                      
                      {doc.status === "failed" && (
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                          onClick={() => {
                            // In production, implement retry logic
                            alert("Retry functionality would be implemented here");
                          }}
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Retry
                        </button>
                      )}

                      <button
                        type="button"
                        className="text-red-600 hover:text-red-900 inline-flex items-center"
                        onClick={() => {
                          // In production, implement delete logic
                          if (confirm("Are you sure you want to delete this document?")) {
                            alert("Delete functionality would be implemented here");
                          }
                        }}
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
          <div className="text-center py-12 bg-white shadow rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t("documents.noDocuments")}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t("documents.uploadFirst")}
            </p>
            <div className="mt-6">
              <Link
                to="/documents/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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