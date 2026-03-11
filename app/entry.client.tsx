import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import type { ClientOnErrorFunction } from "react-router";
import { HydratedRouter } from "react-router/dom";
import { toast } from "sonner";

const onError: ClientOnErrorFunction = (
  error,
  { location, params, unstable_pattern, errorInfo },
) => {
  if (typeof error === "string") toast.error(error);
  if (typeof error === "object") {
    const anyError = error as any;
    if (!anyError.name) return;
    if (anyError.message) {
      toast.error(anyError.name, {
        description: anyError.message,
      });
    }
    toast.error(anyError.name);
  }

  // make sure to still log the error so you can see it
  console.error(error, errorInfo);
};

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter onError={onError} />
    </StrictMode>,
  );
});
