import { Link, useLoaderData } from "react-router";
import { t } from "~/lib/i18n/i18n";
import type { User } from "~/lib/auth/session.server";

interface LayoutProps {
  children: React.ReactNode;
  user?: User | null;
}

export function Layout({ children, user }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-blue-600">
                  {t("common.appName")}
                </h1>
              </Link>
              
              {user && (
                <div className="ml-10 flex space-x-8">
                  <Link
                    to="/dashboard"
                    className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                  >
                    {t("navigation.dashboard")}
                  </Link>
                  <Link
                    to="/documents"
                    className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium"
                  >
                    {t("navigation.documents")}
                  </Link>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    {t("dashboard.welcome", { name: user.name })}
                  </span>
                  <Link
                    to="/logout"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    {t("navigation.signOut")}
                  </Link>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {t("navigation.signIn")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>
    </div>
  );
}