import { toast as sonnerToast, type ExternalToast } from "sonner";

type SonnerMessage = Parameters<typeof sonnerToast.error>[0];
type SonnerArgs = Parameters<typeof sonnerToast.error>[1];

export const toast = (function () {
  function wrap(sonnerF: (message: SonnerMessage, opts: SonnerArgs) => void) {
    return function (message: SonnerMessage, opts?: SonnerArgs) {
      const mergedArgs = { ...defaultOpts, ...(opts || {}) };
      sonnerF.call(null, message, mergedArgs);
    };
  }

  return {
    error: wrap(sonnerToast.error),
    info: wrap(sonnerToast.info),
    warning: wrap(sonnerToast.warning),
  };
})();

const defaultOpts: ExternalToast = {
  className: "bg-red",
};
