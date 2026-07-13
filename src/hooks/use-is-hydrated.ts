import { useSyncExternalStore } from "react"

// A no-op subscribe: the hydration flag never changes after the first commit,
// so there is nothing to subscribe to.
const emptySubscribe = () => () => {}

/**
 * Returns `false` during SSR and the very first client render, then `true`
 * after hydration completes.
 *
 * Use this to gate rendering of client-only state (e.g. values read from
 * localStorage through a Zustand store) so the first client render matches the
 * server output and avoids a hydration mismatch.
 *
 * This replaces the older `useState(false)` + `useEffect(() => setMounted(true))`
 * pattern, which calls setState synchronously inside an effect and triggers the
 * `react-hooks/set-state-in-effect` rule (cascading renders).
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  )
}
