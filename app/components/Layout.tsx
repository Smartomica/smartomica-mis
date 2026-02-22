import { Link } from "react-router";
import { useState } from "react";
import { t } from "~/lib/i18n/i18n";
import type { User } from "~/lib/auth/session.server";
import { HamburgerMenuIcon, Cross2Icon } from "@radix-ui/react-icons";

interface LayoutProps {
  children: React.ReactNode;
  user?: User | null;
}

export function Layout({ children, user }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 max-w-none">
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
                <div className="hidden md:ml-10 md:flex md:space-x-8">
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

            <div className="hidden md:flex items-center space-x-4">
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

            <div className="flex items-center md:hidden space-x-4">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-controls="mobile-menu"
                aria-expanded="false"
              >
                <span className="sr-only">Open main menu</span>
                {/* Icon when menu is closed. */}
                <HamburgerMenuIcon
                  className={`${isMenuOpen ? "hidden" : "block"} h-6 w-6`}
                />
                {/* Icon when menu is open. */}
                <Cross2Icon
                  className={`${isMenuOpen ? "block" : "hidden"} h-6 w-6`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu, show/hide based on menu state. */}
        <div
          className={`${isMenuOpen ? "block" : "hidden"} md:hidden`}
          id="mobile-menu"
        >
          <div className="pt-2 pb-3 space-y-1 px-4">
            {user && (
              <>
                <Link
                  to="/dashboard"
                  className="bg-blue-50 dark:bg-gray-800 border-blue-500 text-blue-700 dark:text-blue-300 block pl-3 pr-4 py-2 border-l-4 text-base font-medium sm:pl-5 sm:pr-6"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t("navigation.dashboard")}
                </Link>
                <Link
                  to="/documents"
                  className="border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200 block pl-3 pr-4 py-2 border-l-4 text-base font-medium sm:pl-5 sm:pr-6"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t("navigation.documents")}
                </Link>
              </>
            )}
          </div>
          <div className="pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            {user ? (
              <div className="flex items-center px-4 sm:px-6">
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800 dark:text-gray-200">
                    {t("dashboard.welcome", { name: user.name })}
                  </div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {user.tokensRemaining} tokens
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-3 space-y-1 px-4 sm:px-6">
              {user ? (
                <>
                  {user.role === "admin" && (
                    <Link
                      to="/admin"
                      className="block px-4 py-2 text-base font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/logout"
                    className="block px-4 py-2 text-base font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t("navigation.signOut")}
                  </Link>
                </>
              ) : (
                <Link
                  to="/login"
                  className="block px-4 py-2 text-base font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t("navigation.signIn")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-none">{children}</main>
    </div>
  );
}
