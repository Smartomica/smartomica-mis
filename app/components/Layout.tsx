import { Link, useLoaderData } from "react-router";
import { t } from "~/lib/i18n/i18n";
import type { User } from "~/lib/auth/session.server";
import { DarkModeToggle } from "./DarkModeToggle";

interface LayoutProps {
  children: React.ReactNode;
  user?: User | null;
}

export function Layout({ children, user }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 prose prose-gray max-w-none dark:prose-invert">
      <nav className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 not-prose">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {t("common.appName")}
                </h1>
              </Link>

              {user && (
                <div className="ml-10 flex space-x-8">
                  <Link
                    to="/dashboard"
                    className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 text-sm font-medium"
                  >
                    {t("navigation.dashboard")}
                  </Link>
                  <Link
                    to="/documents"
                    className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 text-sm font-medium"
                  >
                    {t("navigation.documents")}
                  </Link>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <DarkModeToggle />
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t("dashboard.welcome", { name: user.name })}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {user.tokensRemaining} tokens
                  </span>
                  {user.role === "admin" && (
                    <Link
                      to="/admin"
                      className="bg-purple-100 dark:bg-purple-800 hover:bg-purple-200 dark:hover:bg-purple-700 text-purple-800 dark:text-purple-200 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/logout"
                    className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    {t("navigation.signOut")}
                  </Link>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  {t("navigation.signIn")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="prose prose-gray max-w-none dark:prose-invert">{children}</main>
    </div>
  );
}
