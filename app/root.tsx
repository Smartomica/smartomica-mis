import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { getUser } from "~/lib/auth/session.server";
import { ensureDB } from "./lib/db/ensureDb";
import { MINIO_ENDPOINT, NODE_ENV } from "~/env.server";
import "./app.css";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "SmartOmica MIS - Medical Document Translation" },
    {
      name: "description",
      content: "AI-powered medical document translation platform",
    },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  // Initialize OpenTelemetry on server
  // Import instrumentation to ensure it runs on server startup
  await import("./instrumentation.server");

  await ensureDB();

  return {
    user: await getUser(request),
  };
}

export const headers: Route.HeadersFunction = () => {
  const minioUrl = new URL(MINIO_ENDPOINT);
  const minioOrigin = `${minioUrl.protocol}//${minioUrl.hostname}${minioUrl.port ? `:${minioUrl.port}` : ""}`;

  const isDev = NODE_ENV === "development";

  // CSP configuration
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for React
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow inline styles and Google Fonts
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: " + minioOrigin, // Allow images from Minio
    "connect-src 'self' " + minioOrigin + (isDev ? " ws: http: https:" : ""), // Allow connections to Minio and dev tools
    "media-src 'self' " + minioOrigin, // Allow media from Minio
    "object-src 'none'", // Prevent object/embed elements
    "frame-ancestors 'none'", // Prevent framing
    "base-uri 'self'", // Restrict base URI
    "form-action 'self'", // Restrict form submissions
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
};

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="font-sans bg-gray-50 dark:bg-gray-950 min-h-screen prose prose-gray max-w-none dark:prose-invert">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
