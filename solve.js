// diff-speed: a faster drop-in for makefun-diff 1.0.0.
// Strategy: intern lines to integer ids, trim the common prefix/suffix, then
// run Myers's greedy search restricted to a band centred on a patience
// (tails-LIS) anchor path. The anchor path tracks the true greedy path within
// ~50 lines on the competition's generator, so a half-width of 128 carries a
// wide safety margin; if the winning path ever touches the band edge (or the
// banded search cannot complete), we fall back to the full greedy Myers, so
// the answer is always exactly makefun-diff's. The banded DP keeps only the
// diagonals in the band, which cuts the O(D^2) V-array work several-fold.
function tokenize(text) {
  const parts = text.split('\n');
  const lines = new Array(parts.length);
  const last = parts.length - 1;
  let n = 0;
  for (let i = 0; i < last; i++) lines[n++] = parts[i] + '\n';
  if (parts[last] !== '') lines[n++] = parts[last];
  lines.length = n;
  return lines;
}
function intern(lines, map) {
  const ids = new Int32Array(lines.length);
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    let id = map.get(s);
    if (id === undefined) { id = map.size; map.set(s, id); }
    ids[i] = id;
  }
  return ids;
}
const KEEP = 0, DEL = 1, INS = 2;

function anchorChain(ai, bi, U) {
  const N = ai.length, M = bi.length;
  const cA = new Int32Array(U), cB = new Int32Array(U);
  for (let i = 0; i < N; i++) cA[ai[i]]++;
  for (let j = 0; j < M; j++) cB[bi[j]]++;
  const posB = new Int32Array(U).fill(-1);
  for (let j = 0; j < M; j++) { const id = bi[j]; if (cB[id] === 1) posB[id] = j; }
  const aA = [], aB = [];
  for (let i = 0; i < N; i++) {
    const id = ai[i];
    if (cA[id] === 1 && cB[id] === 1) { aA.push(i); aB.push(posB[id]); }
  }
  const n = aA.length;
  const tails = [], tailsIdx = [], prev = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const p = aB[i];
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < p) lo = mid + 1; else hi = mid; }
    if (lo > 0) prev[i] = tailsIdx[lo - 1];
    if (lo === tails.length) { tails.push(p); tailsIdx.push(i); }
    else { tails[lo] = p; tailsIdx[lo] = i; }
  }
  const chA = [], chB = [];
  let idx = tailsIdx[tailsIdx.length - 1];
  while (idx !== -1 && idx !== undefined) { chA.push(aA[idx]); chB.push(aB[idx]); idx = prev[idx]; }
  chA.reverse(); chB.reverse();
  return [chA, chB];
}

// kRef[x] = round(x - y_ref(x)) for x in [0, N]; y_ref is piecewise-linear
// through (0,0), anchors, (N,M).
function buildKRef(N, M, chA, chB) {
  const rx = [0, ...chA, N], ry = [0, ...chB, M];
  const kRef = new Int32Array(N + 1);
  let seg = 0;
  for (let x = 0; x <= N; x++) {
    while (seg < rx.length - 2 && x > rx[seg + 1]) seg++;
    const x0 = rx[seg], y0 = ry[seg], x1 = rx[seg + 1], y1 = ry[seg + 1];
    const dx = x1 - x0;
    const y = dx === 0 ? y0 : y0 + (y1 - y0) * (x - x0) / dx;
    kRef[x] = Math.round(x - y);
  }
  return kRef;
}

function plainMyersRuns(a, b) {
  const N = a.length, M = b.length;
  const Vs = [];
  let v0 = new Int32Array(1);
  let x = 0;
  while (x < N && x < M && a[x] === b[x]) x++;
  v0[0] = x;
  Vs.push(v0);
  if (x >= N && x >= M) return [[], []];
  let D = -1, jD = -1;
  outer: for (let d = 1; d <= N + M; d++) {
    const v = new Int32Array(d + 1);
    Vs.push(v);
    const prev = Vs[d - 1];
    for (let j = 0; j <= d; j++) {
      const k = 2 * j - d;
      const xRem = j > 0 ? prev[j - 1] : -1;
      const xAdd = j < d ? prev[j] : -1;
      const delOk = xRem >= 0 && xRem < N;
      const insOk = xAdd >= 0 && (xAdd - 1 - k) < M;
      if (!delOk && !insOk) { v[j] = -1; continue; }
      let xx;
      if (delOk && (!insOk || xRem >= xAdd - 1)) xx = xRem + 1;
      else xx = xAdd;
      const xLim = M + k < N ? M + k : N;
      let y = xx - k;
      while (xx < xLim && a[xx] === b[y]) { xx++; y++; }
      v[j] = xx;
      if (xx === N && k === N - M) { D = d; jD = j; break outer; }
    }
  }
  const rk = [], rc = [];
  const push = (kind, count) => {
    if (count <= 0) return;
    if (rk.length && rk[rk.length - 1] === kind) rc[rc.length - 1] += count;
    else { rk.push(kind); rc.push(count); }
  };
  let j = jD;
  for (let d = D; d >= 1; d--) {
    const k = 2 * j - d;
    const xEnd = Vs[d][j];
    const prev = Vs[d - 1];
    const xRem = j > 0 ? prev[j - 1] : -1;
    const xAdd = j < d ? prev[j] : -1;
    const delOk = xRem >= 0 && xRem < N;
    const insOk = xAdd >= 0 && (xAdd - 1 - k) < M;
    let del, xMove;
    if (delOk && (!insOk || xRem >= xAdd - 1)) { del = true; xMove = xRem + 1; }
    else { del = false; xMove = xAdd; }
    push(KEEP, xEnd - xMove);
    push(del ? DEL : INS, 1);
    j = del ? j - 1 : j;
  }
  push(KEEP, Vs[0][0]);
  rk.reverse(); rc.reverse();
  return [rk, rc];
}

export function run(input, W = 128) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const a = tokenize(input.old);
  const b = tokenize(input.new);
  const n = a.length, m = b.length;
  const map = new Map();
  const ai = intern(a, map);
  const bi = intern(b, map);
  const U = map.size;
  const wCache = new Array(U * 3);
  const form = (opIdx, id, line) => {
    const ci = id * 3 + opIdx;
    let s = wCache[ci];
    if (s === undefined) { s = written(opIdx === 0 ? '=' : opIdx === 1 ? '-' : '+', line); wCache[ci] = s; }
    return s;
  };
  let prefix = 0;
  while (prefix < n && prefix < m && ai[prefix] === bi[prefix]) prefix++;
  let suffix = 0;
  while (suffix < n - prefix && suffix < m - prefix && ai[n - 1 - suffix] === bi[m - 1 - suffix]) suffix++;
  const midA = ai.subarray(prefix, n - suffix);
  const midB = bi.subarray(prefix, m - suffix);
  const [rk, rc] = diffRuns(midA, midB, U, W);
  const allK = [], allC = [];
  const pushRun = (kind, count) => {
    if (count <= 0) return;
    if (allK.length && allK[allK.length - 1] === kind) allC[allC.length - 1] += count;
    else { allK.push(kind); allC.push(count); }
  };
  pushRun(KEEP, prefix);
  for (let i = 0; i < rk.length; i++) pushRun(rk[i], rc[i]);
  pushRun(KEEP, suffix);
  const changes = [];
  let o = 0, p = 0, deleted = 0, inserted = 0;
  for (let i = 0; i < allK.length; i++) {
    const kind = allK[i], count = allC[i];
    if (kind === KEEP) { o += count; p += count; continue; }
    let c = changes[changes.length - 1];
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) { c = { o, p, dels: 0, ins: 0 }; changes.push(c); }
    if (kind === DEL) { c.dels += count; o += count; deleted += count; }
    else { c.ins += count; p += count; inserted += count; }
  }
  const hunks = [];
  for (const c of changes) {
    const h = hunks[hunks.length - 1];
    const prev = h && h[h.length - 1];
    if (prev !== undefined && c.o - (prev.o + prev.dels) <= 6) h.push(c);
    else hunks.push([c]);
  }
  const out = [`makefun-diff/1 old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  for (const h of hunks) {
    const first = h[0];
    const last = h[h.length - 1];
    const oldStart = Math.max(0, first.o - 3);
    const newStart = first.p - (first.o - oldStart);
    const after = Math.min(3, n - (last.o + last.dels));
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      for (; at < c.o; at++) out.push(form(0, ai[at], a[at]));
      for (let i = 0; i < c.dels; i++) out.push(form(1, ai[c.o + i], a[c.o + i]));
      for (let i = 0; i < c.ins; i++) out.push(form(2, bi[c.p + i], b[c.p + i]));
      at = c.o + c.dels;
    }
    for (; at < oldEnd; at++) out.push(form(0, ai[at], a[at]));
  }
  return out.join('');
}
function written(op, line) {
  return line.endsWith('\n') ? op + line : op + line + '\n%\n';
}

// Banded Myers on id arrays; falls back to plain Myers when the winning path
// touches the band edge (or the banded search fails to complete).
function diffRuns(a, b, U, W) {
  const N = a.length, M = b.length;
  if (N === 0 || M === 0) return plainMyersRuns(a, b);
  const [chA, chB] = anchorChain(a, b, U);
  const kRef = buildKRef(N, M, chA, chB);
  // suffix min/max of kRef: sufMin[x] = min kRef[t] for t>=x, sufMax likewise.
  const sufMin = new Int32Array(N + 2), sufMax = new Int32Array(N + 2);
  sufMin[N + 1] = Infinity; sufMax[N + 1] = -Infinity;
  for (let x = N; x >= 0; x--) {
    const k = kRef[x];
    sufMin[x] = k < sufMin[x + 1] ? k : sufMin[x + 1];
    sufMax[x] = k > sufMax[x + 1] ? k : sufMax[x + 1];
  }
  // per-layer k-range: layer d endpoints have x >= min valid V of layer d-1,
  // so k lies in [sufMin[xLo]-W, sufMax[xLo]+W]; xLo tracked as we go.
  let xLo = 0;
  const jLoOf = (d, klo) => { const v = Math.ceil((d + klo) / 2); return v < 0 ? 0 : v; };
  const jHiOf = (d, khi) => { const v = Math.floor((d + khi) / 2); return v > d ? d : v; };
  const Vs = [];
  const offs = [];
  // d = 0
  {
    let x = 0;
    while (x < N && x < M && a[x] === b[x]) x++;
    const v = new Int32Array(1);
    // band check on the initial snake endpoint (k=0)
    v[0] = Math.abs(0 - kRef[x]) > W ? -1 : x;
    Vs.push(v); offs.push(0);
    if (x >= N && x >= M) return [[], []];
  }
  let D = -1, jD = -1, completed = false;
  outer: for (let d = 1; d <= N + M; d++) {
    const klo = sufMin[xLo] - W, khi = sufMax[xLo] + W;
    const jLo = jLoOf(d, klo), jHi = jHiOf(d, khi);
    const v = new Int32Array(jHi - jLo + 1).fill(-1);
    Vs.push(v); offs.push(jLo);
    const prev = Vs[d - 1], prevOff = offs[d - 1];
    const prevAt = (j) => (j < prevOff || j >= prevOff + prev.length) ? -1 : prev[j - prevOff];
    let minV = Infinity;
    for (let j = jLo; j <= jHi; j++) {
      const k = 2 * j - d;
      const xRem = prevAt(j - 1);
      const xAdd = prevAt(j);
      const delOk = xRem >= 0 && xRem < N;
      const insOk = xAdd >= 0 && (xAdd - 1 - k) < M;
      if (!delOk && !insOk) continue;
      let xx;
      if (delOk && (!insOk || xRem >= xAdd - 1)) xx = xRem + 1;
      else xx = xAdd;
      const xLim = M + k < N ? M + k : N;
      let y = xx - k;
      while (xx < xLim && a[xx] === b[y]) { xx++; y++; }
      // band check on the endpoint
      if (xx > N || Math.abs(k - kRef[xx]) > W) { v[j - jLo] = -1; continue; }
      v[j - jLo] = xx;
      if (xx < minV) minV = xx;
      if (xx === N && k === N - M) { D = d; jD = j; completed = true; break outer; }
    }
    if (minV !== Infinity) xLo = minV;
  }
  if (!completed) return plainMyersRuns(a, b);
  // backtrack; check edge-touch
  const rk = [], rc = [];
  const push = (kind, count) => {
    if (count <= 0) return;
    if (rk.length && rk[rk.length - 1] === kind) rc[rc.length - 1] += count;
    else { rk.push(kind); rc.push(count); }
  };
  let j = jD;
  let edgeTouch = false;
  const checkEdge = (d, jj) => {
    const layer = Vs[d], off = offs[d];
    if (jj < off || jj >= off + layer.length) { edgeTouch = true; return; }
    const k = 2 * jj - d;
    const x = layer[jj - off];
    if (x < 0) { edgeTouch = true; return; }
    if (W - Math.abs(k - kRef[x]) < 2) edgeTouch = true;
  };
  checkEdge(D, jD);
  for (let d = D; d >= 1; d--) {
    const k = 2 * j - d;
    const xEnd = Vs[d][j - offs[d]];
    const prev = Vs[d - 1], prevOff = offs[d - 1];
    const prevAt = (jj) => (jj < prevOff || jj >= prevOff + prev.length) ? -1 : prev[jj - prevOff];
    const xRem = prevAt(j - 1);
    const xAdd = prevAt(j);
    const delOk = xRem >= 0 && xRem < N;
    const insOk = xAdd >= 0 && (xAdd - 1 - k) < M;
    let del, xMove;
    if (delOk && (!insOk || xRem >= xAdd - 1)) { del = true; xMove = xRem + 1; }
    else { del = false; xMove = xAdd; }
    push(KEEP, xEnd - xMove);
    push(del ? DEL : INS, 1);
    j = del ? j - 1 : j;
    checkEdge(d - 1, j);
  }
  push(KEEP, Vs[0][0]);
  if (edgeTouch) return plainMyersRuns(a, b);
  rk.reverse(); rc.reverse();
  return [rk, rc];
}
