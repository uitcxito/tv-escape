import { BATTERY_RADIUS, LEVELS, PLAYER_RADIUS, PLAYER_SPEED, ENEMY_RADIUS, EXIT_RADIUS, STEP } from './levels'
import type { CastId, Level } from './levels'
import { CELL_SIZE, cellAt, mazeDistances } from './maze'
import type { Maze } from './maze'
import { add, cast, dot, length, meet, move, mul, sub, unit, v } from './physics'
import type { Span, Vec } from './physics'

export const MAX_CHARGES = 3
export const PULSE_RADIUS = 158
export const PULSE_DURATION = .56
const PULSE_SHIELD = .72
const DISRUPTED_TIME = 1.10
const DISRUPTED_SPEED = .64
const REACTION_TIME = .60
const ARRIVAL_DISTANCE = .01

export type GameEvent =
  | { type: 'catch'; actor: CastId }
  | { type: 'pickup'; charged: boolean }
  | { type: 'advance' | 'win' }
export type Mode = 'ready' | 'running' | 'paused' | 'won'
export type Hint = 'move' | 'dodge' | 'exit' | 'pulse' | null
export interface Enemy {
  id: CastId
  position: Vec
  velocity: Vec
  trail: Vec[]
  delay: number
  disrupted: number
  waypoint?: Vec
  reaction: number
}

const stepTimer = (time: number) => time > STEP + 1e-9 ? time - STEP : 0
const stationary = (at: Vec): Span => ({ from: at, to: at, start: 0, end: STEP })

export class Game {
  index = 0
  mode: Mode = 'ready'
  hint: Hint = 'move'
  player = v()
  facing = 1
  enemies: Enemy[] = []
  attempts = 0
  time = 0
  shield = 0
  lastCaught: Vec | null = null
  moving = false
  charge = 1
  readonly takenBatteries = new Set<number>()
  batteriesFound = 0
  pulseHits = 0
  pulse: { origin: Vec; remaining: number } | null = null
  private trailStep = 0
  private resumeMode: 'ready' | 'running' = 'ready'
  private hasPulsed = false
  private pulseHintEnds = 0

  constructor(readonly levels = LEVELS) { this.load() }
  get level(): Level { return this.levels[this.index] }
  get protected() { return this.shield > 0 }
  get canPulse() { return this.mode === 'running' && this.charge > 0 && this.pulse === null }

  private load() {
    this.player = this.level.player
    this.facing = this.player.x < this.level.exit.x ? 1 : -1
    this.moving = false
    this.trailStep = 0
    const reserve = this.level.enemies.length >= 7 ? 2 : 1
    this.charge = Math.max(reserve, this.charge)
    this.pulse = null
    this.enemies = this.level.enemies.map(e => ({
      id: e.id, position: e.position,
      velocity: v(this.level.speed * Math.cos(e.heading), this.level.speed * Math.sin(e.heading)), trail: [],
      delay: e.delay, disrupted: 0, reaction: 0,
    }))
  }

  start() {
    if (this.mode === 'ready') {
      this.mode = 'running'
      if (this.hint === 'move') this.hint = 'dodge'
    }
  }
  pause() {
    if (this.mode === 'ready' || this.mode === 'running') {
      this.resumeMode = this.mode
      this.moving = false
      this.mode = 'paused'
    }
  }
  resume() { if (this.mode === 'paused') this.mode = this.resumeMode }

  restart() {
    this.index = this.attempts = this.time = this.shield = 0
    this.lastCaught = null
    this.charge = 1
    this.takenBatteries.clear()
    this.batteriesFound = this.pulseHits = this.pulseHintEnds = 0
    this.hasPulsed = false
    this.mode = 'ready'
    this.hint = 'move'
    this.load()
  }

  releasePulse(): number | undefined {
    if (!this.canPulse) return
    this.charge--
    this.hasPulsed = true
    if (this.hint === 'pulse') this.hint = null
    this.pulse = { origin: this.player, remaining: PULSE_DURATION }
    this.shield = Math.max(this.shield, PULSE_SHIELD)
    let hits = 0
    for (const enemy of this.enemies) {
      const offset = sub(enemy.position, this.player)
      const distance = length(offset)
      if (enemy.delay > 0 || distance > PULSE_RADIUS) continue
      const direction = distance > 0 ? mul(offset, 1 / distance) : v(this.facing, 0)
      enemy.velocity = mul(direction, this.level.speed)
      enemy.disrupted = DISRUPTED_TIME
      enemy.waypoint = undefined
      enemy.trail.length = 0
      hits++
    }
    this.pulseHits += hits
    return hits
  }

  private nextWaypoint(enemy: Enemy, maze: Maze, player: Vec, arrived: boolean) {
    const offset = sub(player, enemy.position)
    if (length(offset) <= (maze.chaseRange + .5) * CELL_SIZE &&
        !cast(enemy.position, offset, ENEMY_RADIUS, this.level)) return player

    const index = cellAt(maze, enemy.position)
    const cell = maze.cells[index]
    const distance = mazeDistances(maze, cellAt(maze, player), maze.chaseRange)
    if (distance[index] === 0 && length(sub(cell.center, enemy.position)) > ARRIVAL_DISTANCE) return cell.center

    let next = cell.neighbors.find(id => distance[id] >= 0 && distance[id] < distance[index])
    if (next === undefined) {
      if (!arrived) return
      // Out of range: keep moving along the corridor, reversing at a dead end.
      let alignment = -Infinity
      for (const id of cell.neighbors) {
        const score = dot(enemy.velocity, sub(maze.cells[id].center, cell.center))
        if (score <= alignment) continue
        alignment = score
        next = id
      }
    }
    const goal = next === undefined ? cell.center : maze.cells[next].center
    // After a pulse or a sighting in mid-corridor, the next doorway may need
    // an approach through the center before the chaser can make the turn.
    return cast(enemy.position, sub(goal, enemy.position), ENEMY_RADIUS, this.level) ? cell.center : goal
  }

  private moveEnemy(enemy: Enemy, player: Vec) {
    if (enemy.delay > 0) return
    if (enemy.disrupted > 0) {
      return move(enemy.position, mul(enemy.velocity, DISRUPTED_SPEED), STEP, ENEMY_RADIUS, this.level, null)
    }
    const maze = this.level.maze
    if (!maze) return move(enemy.position, enemy.velocity, STEP, ENEMY_RADIUS, this.level, player)

    enemy.reaction = stepTimer(enemy.reaction)
    const arrived = !enemy.waypoint || length(sub(enemy.waypoint, enemy.position)) <= ARRIVAL_DISTANCE
    if (arrived || !enemy.reaction) {
      enemy.waypoint = this.nextWaypoint(enemy, maze, player, arrived) ?? enemy.waypoint
      enemy.reaction = REACTION_TIME
    }
    const offset = sub(enemy.waypoint ?? enemy.position, enemy.position)
    const speed = Math.min(this.level.speed, length(offset) / STEP)
    return move(enemy.position, mul(unit(offset), speed), STEP, ENEMY_RADIUS, this.level, null)
  }

  private collectBatteries(path: Span[], until: number): GameEvent | undefined {
    let pickedUp = false
    const charge = this.charge
    for (const [i, position] of this.level.batteries.entries()) {
      if (this.takenBatteries.has(i) ||
          meet(path, [stationary(position)], PLAYER_RADIUS + BATTERY_RADIUS) > until) continue
      this.takenBatteries.add(i)
      this.batteriesFound++
      this.charge = Math.min(MAX_CHARGES, this.charge + 1)
      pickedUp = true
    }
    if (pickedUp) return { type: 'pickup', charged: this.charge > charge }
  }

  tick(input: Vec): GameEvent | undefined {
    if (this.mode !== 'running') return
    this.time += STEP
    const dt = STEP
    if (this.pulse) {
      this.pulse.remaining = stepTimer(this.pulse.remaining)
      if (!this.pulse.remaining) this.pulse = null
    }
    if (this.hint === 'pulse' && this.time >= this.pulseHintEnds) this.hint = null
    const active = Math.min(dt, this.shield)
    this.shield = stepTimer(this.shield)
    if (input.x) this.facing = Math.sign(input.x)
    const player = move(this.player, mul(unit(input), PLAYER_SPEED), dt, PLAYER_RADIUS, this.level)
    const escape = meet(player.path, [stationary(this.level.exit)], EXIT_RADIUS)
    const enemies = this.enemies.map(e => this.moveEnemy(e, player.position))
    // If immunity ends mid-tick, only test the unprotected portion of the paths.
    const vulnerable = active < dt ? player.path.flatMap(s => {
      if (s.end < active) return []
      if (s.start >= active) return [s]
      const from = add(s.from, mul(sub(s.to, s.from), (active - s.start) / (s.end - s.start)))
      return [{ ...s, from, start: active }]
    }) : []
    let caughtAt = Infinity
    let caughtBy: CastId | undefined
    for (const [i, motion] of enemies.entries()) {
      if (!motion || this.enemies[i].disrupted > 0) continue
      const time = meet(vulnerable, motion.path, PLAYER_RADIUS + ENEMY_RADIUS)
      if (time < caughtAt) {
        caughtAt = time
        caughtBy = this.enemies[i].id
      }
    }
    const pickup = this.collectBatteries(player.path, Math.min(caughtAt, escape, dt))
    if (caughtBy && caughtAt <= dt && caughtAt <= escape) {
      this.attempts++
      this.lastCaught = player.position
      this.load()
      this.shield = 1
      return { type: 'catch', actor: caughtBy }
    }
    if (escape <= dt) {
      this.hint = null
      if (this.index === this.levels.length - 1) {
        this.player = player.position
        this.moving = false
        this.mode = 'won'
        return { type: 'win' }
      }
      this.index++
      this.takenBatteries.clear()
      if (this.index === 1 && !this.hasPulsed) {
        this.hint = 'pulse'
        this.pulseHintEnds = this.time + 2.9
      }
      this.shield = 0
      this.lastCaught = null
      this.load()
      return { type: 'advance' }
    }

    this.moving = length(sub(this.player, player.position)) > 0.1
    this.player = player.position
    this.trailStep = (this.trailStep + 1) % 4
    this.enemies.forEach((e, i) => {
      const m = enemies[i]
      if (!m) {
        e.delay = stepTimer(e.delay)
        return
      }
      if (this.trailStep === 0) {
        e.trail.unshift(e.position)
        if (e.trail.length > 10) e.trail.pop()
      }
      e.position = m.position
      e.velocity = e.disrupted > 0 ? mul(m.velocity, 1 / DISRUPTED_SPEED) : m.velocity
      e.disrupted = stepTimer(e.disrupted)
      if (m.bounces) e.waypoint = undefined
    })
    if (this.hint === 'dodge' && this.moving && this.time > 1.65) this.hint = 'exit'
    return pickup
  }
}
