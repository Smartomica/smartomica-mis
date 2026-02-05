import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/login";
import { login, createUserSession, getUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { t } from "~/lib/i18n/i18n";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (user) {
    return redirect("/dashboard");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return {
      error: "Invalid form data",
    };
  }

  const user = await login(email, password);
  if (!user) {
    return {
      error: "Invalid email or password",
    };
  }

  return createUserSession(user, "/dashboard");
}

export default function Login() {
  const actionData = useActionData<typeof action>();

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
              {t("auth.signIn.title")}
            </h2>
          </div>
          <Form className="mt-8 space-y-6" method="post">
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  {t("auth.signIn.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 focus:z-10 sm:text-sm"
                  placeholder={t("auth.signIn.email")}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  {t("auth.signIn.password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 focus:z-10 sm:text-sm"
                  placeholder={t("auth.signIn.password")}
                />
              </div>
            </div>

            {actionData?.error && (
              <div className="text-red-600 dark:text-red-400 text-sm mt-2">
                {actionData.error}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                {t("auth.signIn.button")}
              </button>
            </div>

            <div className="text-center">
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t("auth.signIn.noAccount")}{" "}
                <a href="mailto:admin@smartomica.org" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                  {t("auth.signIn.signUpLink")}
                </a>
              </p>
            </div>
          </Form>
          
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Demo Accounts:</h3>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <div>Admin: admin@smartomica.org / admin123</div>
              <div>User: user@smartomica.org / user123</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}