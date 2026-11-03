"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data: T | undefined; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | undefined; error: unknown };

/**
 * Runs an async loader and tracks loading / success / error.
 * `reload()` re-runs it, keeping the previous data visible (no flash).
 * Stale responses from earlier runs are ignored.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading", data: undefined, error: null });
  const runId = useRef(0);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async () => {
    const id = ++runId.current;
    setState((s) => ({ status: "loading", data: s.data, error: null }));
    try {
      const data = await loaderRef.current();
      if (id === runId.current) setState({ status: "success", data, error: null });
    } catch (error) {
      if (id === runId.current) setState((s) => ({ status: "error", data: s.data, error }));
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are supplied by the caller
  }, deps);

  return { ...state, reload: run };
}
