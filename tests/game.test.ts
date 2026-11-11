import assert from 'node:assert/strict'
import test from 'node:test'
import { Game } from '../src/game'
import { ENEMY_RADIUS, EXIT_RADIUS, LEVELS, PLAYER_RADIUS, PLAYER_SPEED, STEP } from '../src/levels'
import { add, boardDistance, cast, dot, isClear, length, MAX_TURN, meet, move, rebound, sub, unit, v } from '../src/physics'
import type { Arena, Board, Vec } from '../src/physics'

const empty = { width: 1000, height: 1000, boards: [] }
const diagonal: Board = { a: v(220, 220), b: v(440, 440), radius: 16, tone: 0 }
const slanted: Arena = { ...empty, boards: [diagonal] }
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≠ ${expected}`)

test('WASD has the same speed on cardinal and diagonal input, at 260 units/s', () => {
  for (const input of [v(1, 0), v(1, 1), v(0, -1)]) {
    const game = new Game([{ ...LEVELS[0], ...empty, player: v(430, 430), exit: v(900, 900), enemies: [] }])
    const initial = game.player
    game.start()
    for (let i = 0; i < 120; i++) game.tick(input)
    close(length(sub(game.player, initial)), PLAYER_SPEED)
  }
})

test('a diagonal collision keeps speed and turns at most 25 degrees from specular reflection', () => {
  const start = v(320, 215)
  const velocity = v(25, 280)
  const hit = cast(start, velocity, 29, slanted)!
  assert.ok(hit.time > 0 && hit.time < 1)
  const normal = hit.normals[0]
  const specular = rebound(velocity, hit.normals, v())
  assert.ok(dot(specular, normal) > 0)
  const bounced = move(start, velocity, 1, 29, slanted, v(380, 510))
  assert.equal(bounced.bounces, 1)
  close(length(bounced.velocity), length(velocity))
  assert.ok(Math.acos(dot(unit(bounced.velocity), unit(specular))) <= MAX_TURN + 1e-7)
  assert.ok(dot(bounced.velocity, normal) > 0)
  assert.ok(isClear(bounced.position, 29, slanted))
})

test('steering toward a board cannot turn back into its surface even at a grazing angle', () => {
  const normal = v(0, -1)
  const reflected = rebound(v(300, 1), [normal], v(100, 300))
  assert.ok(dot(reflected, normal) > 0)
  close(length(reflected), Math.hypot(300, 1))
})

test('the player slides along a diagonal board and can leave its rounded end', () => {
  const motion = move(v(325, 225), v(45, 185), .7, 23, slanted)
  const n = unit(v(1, -1))
  assert.ok(boardDistance(motion.position, diagonal) >= 23)
  close(dot(motion.velocity, n), 0)
  assert.ok(motion.position.x > 370)
  const aroundEnd = move(motion.position, v(0, 250), 1, 23, slanted)
  assert.ok(aroundEnd.position.y > 440)
  assert.ok(isClear(aroundEnd.position, 23, slanted))
})

test('a simultaneous wall corner contact reflects outward on both axes once', () => {
  const motion = move(v(100, 100), v(-200, -200), .5, 29, empty, v(0, 100))
  assert.equal(motion.bounces, 1)
  assert.ok(motion.velocity.x > 0 && motion.velocity.y > 0)
  assert.ok(isClear(motion.position, 29, empty))
  close(length(motion.velocity), Math.hypot(200, 200))
})

test('a high-speed sweep cannot cross a thin panel, its cap, or a wall', () => {
  const board = { a: v(450, 250), b: v(450, 550), radius: 5, tone: 0 }
  const arena = { ...empty, boards: [board] }
  const line = move(v(200, 400), v(100_000, 0), STEP, 23, arena)
  assert.ok(line.position.x < 450 && isClear(line.position, 23, arena))
  const end = cast(v(200, 233), v(750, 0), 23, arena)!
  assert.ok(end.time > 0 && end.time < 1)
  assert.ok(end.normals[0].x < 0 && end.normals[0].y < 0)
  const wall = move(v(900, 500), v(300_000, 0), STEP, 29, empty, v(200, 500))
  assert.ok(wall.bounces >= 2 && isClear(wall.position, 29, empty))
})

test('swept actor paths detect contact even when both step endpoints are separated', () => {
  const span = (from: Vec, to: Vec) => ({ from, to, start: 0, end: 1 })
  close(meet([span(v(0, 0), v(100, 0))], [span(v(100, 0), v(0, 0))], 10), .45)
})

test('two simultaneous catches reset once, restore fixed spawns and velocities, and grant a full second', () => {
  const game = new Game()
  game.index = 3
  const reference = new Game([game.level])
  game.start()
  game.enemies = reference.enemies.map(e => ({ ...e, position: game.player, trail: [v(14, 13)] }))
  assert.equal(game.tick(v()), 'catch')
  assert.equal(game.index, 3)
  assert.equal(game.attempts, 1)
  assert.equal(game.shield, 1)
  assert.deepEqual(game.player, reference.player)
  assert.deepEqual(game.enemies, reference.enemies)

  for (let i = 0; i < 120; i++) {
    for (const enemy of game.enemies) enemy.position = game.player
    assert.equal(game.tick(v()), undefined)
  }
  assert.equal(game.protected, false)
  assert.equal(game.attempts, 1)
  for (const enemy of game.enemies) enemy.position = game.player
  assert.equal(game.tick(v()), 'catch')
  assert.equal(game.attempts, 2)
})

const cardinal = [v(0, 1), v(0, -1), v(1, 0), v(-1, 0)]
function reachable(arena: Arena, player: Vec, exit: Vec, permitted = (_p: Vec) => true) {
  const gap = 12
  const queue = [player]
  const seen = new Set<string>()
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]
    if (length(sub(exit, p)) < EXIT_RADIUS) return true
    for (const { x, y } of cardinal) {
      const delta = v(x * gap, y * gap)
      const q = add(p, delta)
      const key = `${q.x}/${q.y}`
      if (seen.has(key) || !permitted(q) || !isClear(q, PLAYER_RADIUS + 1, arena) || cast(p, delta, PLAYER_RADIUS + 1, arena)) continue
      seen.add(key)
      queue.push(q)
    }
  }
  return false
}

test('all eight maps have safe spawns, reachable exits, and the requested difficulty curve', () => {
  assert.deepEqual(LEVELS.map(l => l.speed), [140, 160, 180, 200, 225, 250, 275, 300])
  assert.deepEqual(LEVELS.map(l => l.enemies.map(e => e.id).join('/')), [
    'zhang', 'zhang', 'zhang/ma', 'zhang/ma', 'zhang/ma/liu', 'zhang/ma/liu', 'zhang/ma/liu', 'zhang/ma/liu',
  ])
  for (const [i, l] of LEVELS.entries()) {
    assert.ok(isClear(l.player, PLAYER_RADIUS, l), `stage ${i + 1} player spawn`)
    assert.ok(isClear(l.exit, EXIT_RADIUS, l), `stage ${i + 1} exit`)
    l.enemies.forEach((e, j) => {
      assert.ok(isClear(e.position, ENEMY_RADIUS, l), `stage ${i + 1} ${e.id} spawn`)
      assert.ok(length(sub(e.position, l.player)) > PLAYER_RADIUS + ENEMY_RADIUS + 80)
      for (const other of l.enemies.slice(j + 1)) assert.ok(length(sub(e.position, other.position)) > ENEMY_RADIUS * 2)
    })
    assert.ok(reachable(l, l.player, l.exit), `stage ${i + 1} exit is reachable`)
  }
  const l = LEVELS[6]
  assert.ok(reachable(l, l.player, l.exit, p => p.y <= l.player.y))
  assert.ok(reachable(l, l.player, l.exit, p => p.y >= l.player.y))
})
