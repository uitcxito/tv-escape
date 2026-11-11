import { LEVELS, PLAYER_RADIUS, PLAYER_SPEED, ENEMY_RADIUS, EXIT_RADIUS, STEP } from './levels'
import type { CastId, Level } from './levels'
import { add, length, meet, move, mul, sub, unit, v } from './physics'
import type { Span, Vec } from './physics'

export type GameEvent = { type: 'catch'; actor: CastId } | { type: 'advance' | 'win' }
export type Mode = 'ready' | 'running' | 'paused' | 'won'
export type Hint = 'move' | 'dodge' | 'exit' | null
export interface Enemy { id: CastId; position: Vec; velocity: Vec; trail: Vec[] }

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
  private trailStep = 0
  private resumeMode: 'ready' | 'running' = 'ready'
  private firstBounceAt: number | null = null

  constructor(readonly levels = LEVELS) { this.load() }
  get level(): Level { return this.levels[this.index] }
  get protected() { return this.shield > 0 }

  private load() {
    this.player = this.level.player
    this.facing = this.player.x < this.level.exit.x ? 1 : -1
    this.moving = false
    this.trailStep = 0
    this.enemies = this.level.enemies.map(e => ({
      id: e.id, position: e.position,
      velocity: v(this.level.speed * Math.cos(e.heading), this.level.speed * Math.sin(e.heading)), trail: [],
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
    this.firstBounceAt = this.lastCaught = null
    this.mode = 'ready'
    this.hint = 'move'
    this.load()
  }

  tick(input: Vec): GameEvent | undefined {
    if (this.mode !== 'running') return
    this.time += STEP
    const dt = STEP
    const active = Math.min(dt, this.shield)
    this.shield = Math.max(0, this.shield - dt)
    if (this.shield < 1e-9) this.shield = 0
    if (input.x) this.facing = Math.sign(input.x)
    const player = move(this.player, mul(unit(input), PLAYER_SPEED), dt, PLAYER_RADIUS, this.level)
    const exit: Span = { from: this.level.exit, to: this.level.exit, start: 0, end: dt }
    const escape = meet(player.path, [exit], EXIT_RADIUS)
    const enemies = this.enemies.map(e =>
      move(e.position, e.velocity, dt, ENEMY_RADIUS, this.level, player.position))
    // If immunity ends mid-tick, only test the unprotected portion of the paths.
    const vulnerable = active < dt ? player.path.flatMap(s => {
      if (s.end < active) return []
      if (s.start >= active) return [s]
      const from = add(s.from, mul(sub(s.to, s.from), (active - s.start) / (s.end - s.start)))
      return [{ ...s, from, start: active }]
    }) : []
    let caughtAt = Infinity
    let caughtBy: CastId | undefined
    for (const [i, enemy] of enemies.entries()) {
      const time = meet(vulnerable, enemy.path, PLAYER_RADIUS + ENEMY_RADIUS)
      if (time < caughtAt) {
        caughtAt = time
        caughtBy = this.enemies[i].id
      }
    }
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
      this.shield = 0
      this.lastCaught = null
      this.load()
      return { type: 'advance' }
    }

    this.moving = length(sub(this.player, player.position)) > 0.1
    this.player = player.position
    this.trailStep = (this.trailStep + 1) % 4
    enemies.forEach((m, i) => {
      const e = this.enemies[i]
      if (this.trailStep === 0) {
        e.trail.unshift(e.position)
        if (e.trail.length > 10) e.trail.pop()
      }
      e.position = m.position
      e.velocity = m.velocity
    })
    if (this.hint === 'dodge') {
      if (this.firstBounceAt === null && enemies.some(m => m.bounces)) this.firstBounceAt = this.time
      if (this.firstBounceAt !== null && this.moving && this.time - this.firstBounceAt > .85) this.hint = 'exit'
    }
  }
}
