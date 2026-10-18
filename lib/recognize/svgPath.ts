// KanjiVG のパス（M / C / S / L など）を折れ線にする
export type Pt = { x: number; y: number };

const NUM_RE = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, out: Pt[], steps = 8) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
}

export function pathToPoints(d: string): Pt[] {
  const out: Pt[] = [];
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = cur;
  let lastCtrl: Pt | null = null;
  for (const seg of d.match(/[MmLlHhVvCcSsZz][^MmLlHhVvCcSsZz]*/g) ?? []) {
    const cmd = seg[0];
    const n = (seg.slice(1).match(NUM_RE) ?? []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    const P = (x: number, y: number): Pt => (rel ? { x: cur.x + x, y: cur.y + y } : { x, y });
    switch (cmd.toUpperCase()) {
      case 'M':
        for (let i = 0; i + 1 < n.length; i += 2) {
          cur = P(n[i], n[i + 1]);
          if (i === 0) start = cur;
          out.push(cur);
        }
        lastCtrl = null;
        break;
      case 'L':
        for (let i = 0; i + 1 < n.length; i += 2) { cur = P(n[i], n[i + 1]); out.push(cur); }
        lastCtrl = null;
        break;
      case 'H':
        for (const v of n) { cur = { x: rel ? cur.x + v : v, y: cur.y }; out.push(cur); }
        lastCtrl = null;
        break;
      case 'V':
        for (const v of n) { cur = { x: cur.x, y: rel ? cur.y + v : v }; out.push(cur); }
        lastCtrl = null;
        break;
      case 'C':
        for (let i = 0; i + 5 < n.length; i += 6) {
          const c1 = P(n[i], n[i + 1]), c2 = P(n[i + 2], n[i + 3]), e = P(n[i + 4], n[i + 5]);
          cubic(cur, c1, c2, e, out);
          lastCtrl = c2;
          cur = e;
        }
        break;
      case 'S':
        for (let i = 0; i + 3 < n.length; i += 4) {
          const c1 = lastCtrl ? { x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y } : cur;
          const c2 = P(n[i], n[i + 1]), e = P(n[i + 2], n[i + 3]);
          cubic(cur, c1, c2, e, out);
          lastCtrl = c2;
          cur = e;
        }
        break;
      case 'Z':
        cur = start;
        out.push(cur);
        lastCtrl = null;
        break;
    }
  }
  return out;
}
