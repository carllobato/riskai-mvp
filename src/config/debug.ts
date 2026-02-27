/**
 * Debug flags for development. Defaults must be false for production.
 * Decision layer logging is gated by DEBUG_DECISION.
 */
export const DEBUG_DECISION = false;

/** When true, run forward projection guard checks on load (dev-only, console output). */
export const DEBUG_FORWARD_PROJECTION = false;

/*
 * Manual verification checklist (Day 6 decision layer):
 * - [ ] App loads with no console errors
 * - [ ] Risk register renders with score + tags column
 * - [ ] Flagged-only toggle works
 * - [ ] Decision panel renders (Top Critical list + tiles)
 * - [ ] No logs appear when DEBUG_DECISION=false
 */
