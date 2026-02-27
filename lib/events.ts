/**
 * Minimal module-level pub/sub for cross-component communication.
 * Used to trigger a home screen data reload after a notification action
 * completes its storage write in _layout.tsx.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToHomeRefresh(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Call this AFTER storage writes are done to trigger a home screen reload. */
export function triggerHomeRefresh(): void {
    listeners.forEach((fn) => fn());
}
