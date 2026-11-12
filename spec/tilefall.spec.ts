// Copyright (C) 2026 Jason Walsh. GPL-3.0-or-later; see LICENSE.
// tilefall.spec.ts: Bombadil laws for Tilefall, over the page's own dataLayer.
// Settled-board laws hold at every settled state; move laws compare consecutive settled states
// of one game. The page's 120 ms clearing frame (settled: false) is exempt from board laws:
// a gap there is the design, and a frame mid-animation is not a settled board.
import { always } from "@antithesishq/bombadil";
import { actions, extract, getFingerprint, weighted } from "@antithesishq/bombadil/browser";
export { noUncaughtExceptions, noUnhandledPromiseRejections, noConsoleErrors } from "@antithesishq/bombadil/browser/defaults/properties";

type St = { game: number; settled: boolean; board: string[]; score: number; last: { n: number; gain: number } | null; over: boolean };

const trail = extract((state) => {
  try {
    const dl = (state.window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer || [];
    return JSON.parse(JSON.stringify(dl.filter((e) => e && e.event === "state")
      .map((e) => ({ game: e.game, settled: e.settled, board: e.board, score: e.score, last: e.last, over: e.over }))));
  } catch (_e) { return null; }
});
const states = () => ((trail.current ?? []) as unknown as St[]);
const settledStates = () => states().filter((s) => s.settled);

function cols(b: string[]): string[] { const w = b[0].length; return Array.from({ length: w }, (_, c) => b.map((r) => r[c]).join("")); }
function counts(b: string[]): Record<string, number> {
  const m: Record<string, number> = {}; for (const r of b) for (const ch of r) if (ch !== ".") m[ch] = (m[ch] || 0) + 1; return m;
}
const gravityOk = (b: string[]) => cols(b).every((col) => /^\.*[0-9]*$/.test(col)); // empties only above tiles
const columnsClosedOk = (b: string[]) => { const e = cols(b).map((c) => /^\.+$/.test(c)); const first = e.indexOf(true); return first < 0 || e.slice(first).every((x) => x); };
function hasGroup(b: string[]): boolean {
  for (let r = 0; r < b.length; r++) for (let c = 0; c < b[r].length; c++) {
    const v = b[r][c]; if (v === ".") continue;
    if ((c + 1 < b[r].length && b[r][c + 1] === v) || (r + 1 < b.length && b[r + 1][c] === v)) return true;
  }
  return false;
}
// consecutive settled states of one game, with the move between them
function moves(): [St, St][] {
  const s = settledStates(); const out: [St, St][] = [];
  for (let i = 1; i < s.length; i++) if (s[i].game === s[i - 1].game && s[i].last) out.push([s[i - 1], s[i]]);
  return out;
}

export const gravity = always(() => settledStates().every((s) => gravityOk(s.board)));
export const columnsClosed = always(() => settledStates().every((s) => columnsClosedOk(s.board)));
export const overIffNoGroups = always(() => settledStates().every((s) => s.over === !hasGroup(s.board)));
export const scoreIsNTimesNMinus1 = always(() => moves().every(([a, b]) => b.score - a.score === b.last!.n * (b.last!.n - 1)));
export const scoreNeverFalls = always(() => moves().every(([a, b]) => b.score >= a.score));
export const onlyTheGroupRemoved = always(() => moves().every(([a, b]) => {
  const ca = counts(a.board), cb = counts(b.board), n = b.last!.n;
  const drops = Object.keys(ca).map((k) => ca[k] - (cb[k] || 0));
  return drops.filter((d) => d !== 0).length === 1 && drops.reduce((x, y) => x + y, 0) === n && drops.every((d) => d >= 0);
}));

// Reach is computed after the run from the recorded trail (run.sh), not exported here.

const controls = extract((state) => {
  try {
    return Array.from(state.document.querySelectorAll("button[data-testid]")).filter((el) => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !(el as HTMLButtonElement).disabled;
    }).map((el) => { const r = el.getBoundingClientRect();
      return { testId: (el as HTMLElement).dataset.testid ?? "", fingerprint: getFingerprint(el), point: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }; });
  } catch (_e) { return []; }
});
const clicks = (id: string) => actions(() => (controls.current ?? []).filter((c) => c.testId === id).map(({ fingerprint, point }) => ({ Click: { fingerprint, point } })));
const isOver = () => { const s = settledStates(); return s.length > 0 && s[s.length - 1].over; };

export const play = weighted([
  [12, clicks("tile")],
  [6, clicks("btn-new").when(isOver)],
  [2, actions(() => ["Wait"])],
]);
