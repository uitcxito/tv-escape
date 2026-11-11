export interface Vec { x: number; y: number }
export interface Board { a: Vec; b: Vec; radius: number; tone: number }
export interface Arena { width: number; height: number; boards: readonly Board[] }
export const v = (x = 0, y = 0): Vec => ({ x, y })
export const add = (a: Vec, b: Vec) => v(a.x + b.x, a.y + b.y)
export const sub = (a: Vec, b: Vec) => v(a.x - b.x, a.y - b.y)
export const mul = (a: Vec, n: number) => v(a.x * n, a.y * n)
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y
export const length = (a: Vec) => Math.hypot(a.x, a.y)
export const unit = (a: Vec) => length(a) > 0 ? mul(a, 1 / length(a)) : v()
export const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x))

const EPS = 1e-8
const SKIN = 0.001
export const MAX_TURN = 25 * Math.PI / 180

export function boardDistance(p: Vec, board: Board) {
  const ab = sub(board.b, board.a)
  const t = clamp(dot(sub(p, board.a), ab) / dot(ab, ab), 0, 1)
  return length(sub(p, add(board.a, mul(ab, t)))) - board.radius
}

export function isClear(p: Vec, radius: number, arena: Arena) {
  return p.x >= radius && p.y >= radius && p.x <= arena.width - radius &&
    p.y <= arena.height - radius && arena.boards.every(b => boardDistance(p, b) >= radius - EPS)
}

// First entry of a point moving by d into a disk around the origin. The quadratic
// uses the projection to avoid catastrophic cancellation on distant casts.
function diskEntry(p: Vec, d: Vec, radius: number): number {
  const aa = dot(d, d)
  const bb = dot(p, d)
  const cc = dot(p, p) - radius * radius
  if (cc <= 0) return 0
  if (aa < EPS || bb >= 0) return Infinity
  const det = bb * bb - aa * cc
  return det < 0 ? Infinity : cc / (-bb + Math.sqrt(det))
}

interface Hit { time: number; normals: Vec[] }

export function cast(p: Vec, d: Vec, radius: number, arena: Arena): Hit | undefined {
  let best = Infinity
  let normals: Vec[] = []
  const offer = (t: number, n: Vec) => {
    if (t < -EPS || t > 1 + EPS || dot(d, n) >= -EPS) return
    if (t < best - EPS) {
      best = Math.max(0, t)
      normals = [n]
    } else if (Math.abs(t - best) <= EPS && normals.every(old => dot(old, n) < 1 - EPS)) {
      normals.push(n)
    }
  }

  if (d.x < -EPS) offer((radius - p.x) / d.x, v(1, 0))
  if (d.x > EPS) offer((arena.width - radius - p.x) / d.x, v(-1, 0))
  if (d.y < -EPS) offer((radius - p.y) / d.y, v(0, 1))
  if (d.y > EPS) offer((arena.height - radius - p.y) / d.y, v(0, -1))

  for (const b of arena.boards) {
    const ab = sub(b.b, b.a)
    const axis = unit(ab)
    const side = v(-axis.y, axis.x)
    const local = sub(p, b.a)
    const r = radius + b.radius
    for (const n of [side, mul(side, -1)]) {
      const inward = dot(d, n)
      if (inward >= -EPS) continue
      const t = (r - dot(local, n)) / inward
      const along = dot(add(local, mul(d, t)), axis)
      if (along >= -EPS && along <= length(ab) + EPS) offer(t, n)
    }
    for (const [end, sign] of [[b.a, -1], [b.b, 1]] as const) {
      const rel = sub(p, end)
      const t = diskEntry(rel, d, r)
      if (t > 1 + EPS) continue
      const fromEnd = add(rel, mul(d, t))
      if (sign * dot(fromEnd, axis) >= -EPS) offer(t, unit(fromEnd))
    }
  }

  return normals.length ? { time: clamp(best, 0, 1), normals } : undefined
}

function slide(velocity: Vec, normals: Vec[]) {
  // The closest allowed velocity is either the original, a projection onto
  // one contact tangent, or zero at the tip of the feasible cone.
  const fits = (candidate: Vec) => normals.every(n => dot(candidate, n) >= -EPS)
  if (fits(velocity)) return velocity
  const options = [v(), ...normals.map(n => sub(velocity, mul(n, dot(velocity, n))))].filter(fits)
  return options.reduce((a, b) => length(sub(a, velocity)) < length(sub(b, velocity)) ? a : b)
}

export function rebound(velocity: Vec, normals: Vec[], toward: Vec): Vec {
  const speed = length(velocity)
  const incoming = unit(velocity)
  let out = incoming
  for (const normal of normals) {
    if (dot(out, normal) < 0) out = sub(out, mul(normal, 2 * dot(out, normal)))
  }
  const pointsOut = (p: Vec) => normals.every(n => dot(p, n) > 0)
  // At an acute corner, sequential reflections can point back into a face.
  if (!pointsOut(out)) out = mul(incoming, -1)
  const cross = out.x * toward.y - out.y * toward.x
  let angle = clamp(Math.atan2(cross, dot(out, toward)), -MAX_TURN, MAX_TURN)
  for (let i = 0; i < 24; i++, angle *= .5) {
    const next = v(out.x * Math.cos(angle) - out.y * Math.sin(angle),
      out.x * Math.sin(angle) + out.y * Math.cos(angle))
    if (pointsOut(next)) return mul(next, speed)
  }
  return mul(out, speed)
}

export interface Span { from: Vec; to: Vec; start: number; end: number }
export interface Motion { position: Vec; velocity: Vec; path: Span[]; bounces: number }

export function move(start: Vec, velocity: Vec, dt: number, radius: number, arena: Arena, target?: Vec): Motion {
  let position = start
  let elapsed = 0
  let bounces = 0
  const path: Span[] = []
  for (let i = 0; i < 12 && elapsed < dt - EPS; i++) {
    const remaining = dt - elapsed
    const d = mul(velocity, remaining)
    const hit = cast(position, d, radius, arena)
    const next = add(position, mul(d, hit?.time ?? 1))
    const end = elapsed + remaining * (hit?.time ?? 1)
    if (end > elapsed) path.push({ from: position, to: next, start: elapsed, end })
    position = next
    elapsed = end
    if (!hit) break
    const separated = add(position, mul(unit(hit.normals.reduce(add, v())), SKIN))
    if (isClear(separated, radius, arena)) position = separated
    if (target) {
      velocity = rebound(velocity, hit.normals, sub(target, position))
      bounces++
    } else velocity = slide(velocity, hit.normals)
  }
  if (elapsed < dt || !path.length) path.push({ from: position, to: position, start: elapsed, end: dt })
  return { position, velocity, path, bounces }
}

export function sample(span: Span, t: number) {
  return add(span.from, mul(sub(span.to, span.from), span.end > span.start ? (t - span.start) / (span.end - span.start) : 0))
}

export function meet(first: Span[], second: Span[], radius: number): number {
  let earliest = Infinity
  for (const a of first) for (const b of second) {
    const start = Math.max(a.start, b.start)
    const end = Math.min(a.end, b.end)
    if (start > end || start >= earliest) continue
    const p = sub(sample(a, start), sample(b, start))
    const q = sub(sample(a, end), sample(b, end))
    const t = diskEntry(p, sub(q, p), radius)
    if (t <= 1) earliest = start + t * (end - start)
  }
  return earliest
}
