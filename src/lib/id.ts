// Simple Day-1 id generator (fine for local state + later DB swap)
export function makeId(prefix = "risk"): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  }