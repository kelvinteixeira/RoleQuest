/**
 * Browser errors (uncaught exceptions and rejected promises) go to /api/errors,
 * at most 10 per page view, without personal data: message, stack and the
 * page path only (no query string, which may carry codes or tokens).
 */
let sent = 0;

function send(error: unknown, where: string) {
  if (sent >= 10) return;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Erro sem mensagem");
  // Network blips and extensions are noise.
  if (/ResizeObserver loop|Failed to fetch|NetworkError|Load failed|chrome-extension:/i.test(`${err.message} ${err.stack ?? ""}`)) return;
  sent += 1;
  const body = JSON.stringify({ message: err.message, stack: err.stack, url: location.pathname, where });
  if (!navigator.sendBeacon?.("/api/errors", new Blob([body], { type: "application/json" }))) {
    void fetch("/api/errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
  }
}

if (process.env.NODE_ENV === "production") {
  window.addEventListener("error", (event) => send(event.error ?? event.message, "window.error"));
  window.addEventListener("unhandledrejection", (event) => send(event.reason, "unhandledrejection"));
}

export function reportClientError(error: unknown, where: string) {
  if (process.env.NODE_ENV === "production") send(error, where);
}
