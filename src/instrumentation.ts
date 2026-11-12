import type { Instrumentation } from "next";

/** Server errors Next.js catches (routes, server rendering, proxy) go to the error report. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Node only: the report uses the server log and fetch, and must not reach the edge bundle.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { report } = await import("@/server/errors");
  const error = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  await report({ message: error.message, stack: error.stack, source: "server", where: `${context.routerKind} ${context.routeType}`, url: request.path, digest, method: request.method });
};
