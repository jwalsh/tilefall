// Tilefall: an original tile-clearing game, built as a property-based testing target.
// Copyright (C) 2026 Jason Walsh
//
// This program is free software: you can redistribute it and/or modify it under the terms of
// the GNU General Public License as published by the Free Software Foundation, either version 3
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
// without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
// the GNU General Public License for more details. You should have received a copy of the GNU
// General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// app.js: the game. It publishes what it believes on window.dataLayer: every move pushes
// a `state` entry {seq, game, settled, board, score, last, over}. board is rows top to bottom,
// one string per row, "." empty and "0".."2" a colour.
//
// Rules: a group is tiles of one colour joined up/down/left/right. Clicking a tile in a group of
// 2+ clears it, then tiles fall and empty columns close to the left (settled 120 ms later).
// Score += n*(n-1). The game is over exactly when no group of 2+ remains.
//
// Planted faults, ?fault=<name>:
//   gravity-skips-col  column 3 does not fall
//   score-off-by-one   gain computed as (n-1)*(n-2)
//   close-overshoot    closing an empty column also drops the column to its right
//   never-over         game over is never declared
"use strict";
(function () {
  const W = 8, H = 10, K = 3, SETTLE_MS = 120;
  const params = new URLSearchParams(location.search);
  const fault = params.get("fault") || "";
  let seed = Number(params.get("seed") || 26);

  window.dataLayer = window.dataLayer || [];
  let seq = 0;
  const push = (event, fields) => window.dataLayer.push(Object.assign({ event, seq: ++seq, ts: Date.now() }, fields));

  // Park-Miller, as the lab's drivers use: the same seed gives the same board.
  let rng = 1;
  const rand = () => (rng = (rng * 48271) % 2147483647);
  // grid[c][r], r = 0 at the top; null is empty.
  let grid, score, game = 0, over = false, busy = false, last = null;

  function newGame() {
    rng = (seed + game) % 2147483646 + 1;
    game += 1;
    grid = Array.from({ length: W }, () => Array.from({ length: H }, () => rand() % K));
    score = 0; over = false; last = null;
    commit(true);
  }

  function groupAt(c, r) {
    const col = grid[c][r];
    if (col === null) return [];
    const seen = new Set([c + "," + r]), out = [[c, r]], stack = [[c, r]];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + "," + ny;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k) || grid[nx][ny] !== col) continue;
        seen.add(k); out.push([nx, ny]); stack.push([nx, ny]);
      }
    }
    return out;
  }

  function anyGroup() {
    for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
      const v = grid[c][r];
      if (v === null) continue;
      if ((c + 1 < W && grid[c + 1][r] === v) || (r + 1 < H && grid[c][r + 1] === v)) return true;
    }
    return false;
  }

  function fall() {
    for (let c = 0; c < W; c++) {
      if (fault === "gravity-skips-col" && c === 3) continue;
      const kept = grid[c].filter((v) => v !== null);
      grid[c] = Array(H - kept.length).fill(null).concat(kept);
    }
  }

  function close() {
    const out = [];
    for (let c = 0; c < W; c++) {
      if (grid[c].every((v) => v === null)) {
        if (fault === "close-overshoot" && c + 1 < W && out.length > 0) c += 1; // drops the next column
        continue;
      }
      out.push(grid[c]);
    }
    while (out.length < W) out.push(Array(H).fill(null));
    grid = out;
  }

  function play(c, r) {
    if (busy || over) return;
    const g = groupAt(c, r);
    if (g.length < 2) return;
    busy = true;
    const n = g.length;
    const gain = fault === "score-off-by-one" ? (n - 1) * (n - 2) : n * (n - 1);
    for (const [x, y] of g) grid[x][y] = null;
    score += gain;
    last = { n, gain, colour: null };
    commit(false);
    setTimeout(() => {
      fall(); close();
      over = fault === "never-over" ? false : !anyGroup();
      busy = false;
      commit(true);
    }, SETTLE_MS);
  }

  function boardRows() {
    const rows = [];
    for (let r = 0; r < H; r++) {
      let s = "";
      for (let c = 0; c < W; c++) s += grid[c][r] === null ? "." : String(grid[c][r]);
      rows.push(s);
    }
    return rows;
  }

  function commit(settled) {
    push("state", { game, settled, board: boardRows(), score, last, over, fault: fault || null });
    render(settled);
  }

  const $ = (s) => document.querySelector(s);
  function render(settled) {
    const b = $("#board");
    b.textContent = "";
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const v = grid[c][r];
      const el = document.createElement("button");
      el.className = "tile " + (v === null ? "empty" : "c" + v + (settled ? "" : ""));
      el.dataset.testid = "tile";
      el.dataset.c = c; el.dataset.r = r;
      el.disabled = v === null || busy || over;
      el.setAttribute("aria-label", v === null ? "empty" : "tile " + v);
      el.addEventListener("click", () => play(c, r));
      b.appendChild(el);
    }
    $("[data-testid=score]").textContent = String(score);
    $("[data-testid=status]").textContent = over ? "No moves left." : busy ? "Clearing..." : "";
  }

  $("[data-testid=btn-new]").addEventListener("click", () => { if (!busy) newGame(); });
  push("page_view", { page: "tilefall" });
  newGame();
})();
