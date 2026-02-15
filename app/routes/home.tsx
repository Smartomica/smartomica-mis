import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/home";
import { getUser } from "~/lib/auth/session.server";
import { Layout } from "~/components/Layout";
import { t } from "~/lib/i18n/i18n";
import { FileTextIcon, LockClosedIcon, GlobeIcon, LightningBoltIcon } from "@radix-ui/react-icons";

export async function loader({ request }: Route.LoaderArgs) {
  return {
    user: await getUser(request),
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: t("siteName") },
    { name: "description", content: t("common.tagline") },
  ];
}

export default function Home() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <Layout user={user}>
      <div className="bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 min-h-150 not-prose">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center prose prose-gray dark:prose-invert mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 sm:text-5xl md:text-6xl">
              {t("home.hero.title")}
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 dark:text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              {t("home.hero.subtitle")}
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8 not-prose">
              <div className="rounded-md shadow">
                <Link
                  to={user ? "/dashboard" : "/login"}
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 md:py-4 md:text-lg md:px-10"
                >
                  {t("home.hero.cta")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-12 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray dark:prose-invert">
          <div className="lg:text-center">
            <h2 className="text-base text-blue-600 dark:text-blue-400 font-semibold tracking-wide uppercase">
              {t("home.features.title")}
            </h2>
          </div>

          <div className="mt-10 not-prose">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 dark:bg-blue-600 text-white">
                    <FileTextIcon className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    {t("home.features.aiTranslation.title")}
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500 dark:text-gray-400">
                  {t("home.features.aiTranslation.description")}
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 dark:bg-blue-600 text-white">
                    <LockClosedIcon className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    {t("home.features.security.title")}
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500 dark:text-gray-400">
                  {t("home.features.security.description")}
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 dark:bg-blue-600 text-white">
                    <GlobeIcon className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    {t("home.features.multilingual.title")}
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500 dark:text-gray-400">
                  {t("home.features.multilingual.description")}
                </dd>
              </div>

              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 dark:bg-blue-600 text-white">
                    <LightningBoltIcon className="h-6 w-6" />
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                    {t("home.features.fast.title")}
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500 dark:text-gray-400">
                  {t("home.features.fast.description")}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 prose prose-gray dark:prose-invert">
          <div className="lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center not-prose">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-4xl">
                {t("home.howItWorks.title")}
              </h2>
              <p className="mt-3 max-w-3xl text-lg text-gray-500 dark:text-gray-400">
                Simple 3-step process to translate your medical documents
              </p>
              <dl className="mt-10 space-y-10">
                <div className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 dark:bg-blue-600 text-white">
                      <span className="text-lg font-bold">1</span>
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                      {t("home.howItWorks.step1.title")}
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500 dark:text-gray-400">
                    {t("home.howItWorks.step1.description")}
                  </dd>
                </div>

                <div className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 dark:bg-blue-600 text-white">
                      <span className="text-lg font-bold">2</span>
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                      {t("home.howItWorks.step2.title")}
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500 dark:text-gray-400">
                    {t("home.howItWorks.step2.description")}
                  </dd>
                </div>

                <div className="relative">
                  <dt>
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 dark:bg-blue-600 text-white">
                      <span className="text-lg font-bold">3</span>
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                      {t("home.howItWorks.step3.title")}
                    </p>
                  </dt>
                  <dd className="mt-2 ml-16 text-base text-gray-500 dark:text-gray-400">
                    {t("home.howItWorks.step3.description")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
