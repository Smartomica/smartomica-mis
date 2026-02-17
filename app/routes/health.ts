import type { LoaderFunctionArgs } from "react-router";

export function loader({}: LoaderFunctionArgs) {
  return new Response("OK", { status: 200 });
}
