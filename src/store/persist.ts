/**
 * Persist state subsets to localStorage. Does not throw if localStorage is unavailable.
 */

export function saveState<T>(key: string, stateSubset: T): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(stateSubset);
    window.localStorage.setItem(key, raw);
  } catch {
    // quota exceeded, privacy mode, or disabled
  }
}

export function loadState<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}
