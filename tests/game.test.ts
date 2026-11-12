import assert from 'node:assert/strict'
import test from 'node:test'
import { Game, MAX_CHARGES } from '../src/game'
import { BATTERY_RADIUS, CAST, ENEMY_RADIUS, EXIT_RADIUS, LEVELS, PLAYER_RADIUS, PLAYER_SPEED, STEP } from '../src/levels'
import { buildMaze, cellAt, CELL_SIZE, mazeDistances } from '../src/maze'
import { add, boardDistance, cast, dot, isClear, length, MAX_TURN, meet, move, mul, rebound, sub, unit, v } from '../src/physics'
import type { Arena, Board, Vec } from '../src/physics'

const empty = { width: 1000, height: 1000, boards: [] }
const openLevel = { ...LEVELS[0], ...empty, maze: undefined }
const diagonal: Board = { a: v(220, 220), b: v(440, 440), radius: 16, tone: 0 }
const slanted: Arena = { ...empty, boards: [diagonal] }
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≠ ${expected}`)

test('WASD has the same speed on cardinal and diagonal input, at 260 units/s', () => {
  for (const input of [v(1, 0), v(1, 1), v(0, -1)]) {
    const game = new Game([{ ...openLevel, player: v(430, 430), exit: v(900, 900), enemies: [] }])
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
  game.player = reference.player
  game.start()
  game.enemies = reference.enemies.map(e => ({ ...e, position: game.player, delay: 0, trail: [v(14, 13)] }))
  assert.deepEqual(game.tick(v()), { type: 'catch', actor: 'zhang' })
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
  assert.deepEqual(game.tick(v()), { type: 'catch', actor: 'zhang' })
  assert.equal(game.attempts, 2)
})

test('the first actor to touch the player provides the collision cue, regardless of roster order', () => {
  const game = new Game([{ ...openLevel, player: v(400, 400) }])
  game.start()
  game.enemies = [
    { id: 'ma', position: v(453.5, 400), velocity: v(-240, 0), trail: [], delay: 0, disrupted: 0, reaction: 0 },
    { id: 'pony', position: v(347.25, 400), velocity: v(240, 0), trail: [], delay: 0, disrupted: 0, reaction: 0 },
  ]
  assert.deepEqual(game.tick(v()), { type: 'catch', actor: 'pony' })
  assert.equal(game.attempts, 1)
})

test('a pulse spends one charge, repels a nearby chaser, and gives temporary protection', () => {
  const game = new Game([{ ...openLevel, player: v(400, 400), enemies: [] }])
  assert.equal(game.releasePulse(), undefined)
  game.start()
  game.enemies = [
    { id: 'zhang', position: v(450, 400), velocity: v(-140, 0), trail: [], delay: 0, disrupted: 0, reaction: 0 },
    { id: 'ma', position: v(600, 400), velocity: v(140, 0), trail: [], delay: 0, disrupted: 0, reaction: 0 },
  ]
  assert.equal(game.releasePulse(), 1)
  assert.equal(game.charge, 0)
  assert.equal(game.pulseHits, 1)
  assert.equal(game.releasePulse(), undefined)
  assert.ok(game.protected)
  const enemy = game.enemies[0]
  assert.ok(enemy.velocity.x > 0)
  assert.ok(enemy.disrupted > 0)
  assert.equal(game.enemies[1].disrupted, 0)
  for (let i = 0; i < 90; i++) assert.equal(game.tick(v()), undefined)
  assert.ok(enemy.position.x > 450)
  assert.equal(game.protected, false)
  assert.ok(enemy.disrupted > 0)
  enemy.position = game.player
  assert.equal(game.tick(v()), undefined, 'a disrupted chaser is harmless even after the shield ends')
  enemy.position = v(500, 400)
  for (let i = 0; i < 45; i++) game.tick(v())
  assert.equal(enemy.disrupted, 0)
  close(length(enemy.velocity), game.level.speed)
  enemy.position = game.player
  assert.deepEqual(game.tick(v()), { type: 'catch', actor: 'zhang' })
  assert.equal(game.charge, 1, 'a retry restores a pulse if none remain')
})

test('collecting batteries is optional, caps charges, and keeps credit when a player retries', () => {
  const game = new Game([{
    ...openLevel, player: v(400, 400), exit: v(660, 400),
    enemies: [], batteries: [v(440, 400), v(550, 400)],
  }])
  game.start()
  assert.deepEqual(game.tick(v(1, 0)), { type: 'pickup', charged: true })
  assert.equal(game.charge, 2)
  game.enemies = [
    { id: 'zhang', position: game.player, velocity: v(-140, 0), trail: [], delay: 0, disrupted: 0, reaction: 0 },
  ]
  assert.deepEqual(game.tick(v()), { type: 'catch', actor: 'zhang' })
  assert.equal(game.batteriesFound, 1)
  assert.equal(game.charge, 2)
  assert.equal(game.tick(v(1, 0)), undefined, 'a battery collected earlier stays collected')
  game.charge = MAX_CHARGES
  game.player = v(515, 400)
  assert.deepEqual(game.tick(v()), { type: 'pickup', charged: false })
  assert.equal(game.batteriesFound, 2)
  assert.equal(game.charge, MAX_CHARGES)
  game.restart()
  assert.equal(game.batteriesFound, 0)
  assert.equal(game.charge, 1)
  assert.equal(game.takenBatteries.size, 0)
  game.start()
  game.player = v(630, 400)
  assert.deepEqual(game.tick(v()), { type: 'win' }, 'the exit opens with zero batteries collected')
})

test('staggered chasers wait through the start and the finale gives the player time to get moving', () => {
  const game = new Game([LEVELS[7]])
  game.start()
  assert.equal(game.charge, 2)
  const delayed = game.enemies.find(enemy => enemy.id === 'chen')!
  const initial = delayed.position
  for (let i = 0; i < 36; i++) assert.notEqual(game.tick(v(1, 0))?.type, 'catch')
  assert.deepEqual(delayed.position, initial)
  assert.ok(game.player.x > LEVELS[7].player.x + 70)

  const demo = new Game([{ ...openLevel, player: v(400, 400), batteries: [], enemies: [] }])
  demo.start()
  demo.enemies = [
    { id: 'chen', position: demo.player, velocity: v(140, 0), trail: [], delay: .2, disrupted: 0, reaction: 0 },
  ]
  for (let i = 0; i < 24; i++) assert.equal(demo.tick(v()), undefined)
  assert.deepEqual(demo.tick(v()), { type: 'catch', actor: 'chen' })
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

test('all eight mazes have safe spawns, reachable exits and batteries, and walls between corridors', () => {
  assert.ok(LEVELS.every((l, i) => l.speed < PLAYER_SPEED && (i === 0 || l.speed > LEVELS[i - 1].speed)))
  assert.deepEqual(LEVELS.map(l => l.enemies.length), [1, 1, 2, 3, 4, 5, 7, 9])
  assert.deepEqual(LEVELS[7].enemies.map(e => e.id), Object.keys(CAST))
  for (const [i, l] of LEVELS.entries()) {
    assert.ok(isClear(l.player, PLAYER_RADIUS, l), `stage ${i + 1} player spawn`)
    assert.ok(isClear(l.exit, EXIT_RADIUS, l), `stage ${i + 1} exit`)
    l.enemies.forEach((e, j) => {
      assert.ok(isClear(e.position, ENEMY_RADIUS, l), `stage ${i + 1} ${e.id} spawn`)
      assert.ok(length(sub(e.position, l.player)) > PLAYER_RADIUS + ENEMY_RADIUS + 80)
      for (const other of l.enemies.slice(j + 1)) assert.ok(length(sub(e.position, other.position)) > ENEMY_RADIUS * 2)
    })
    assert.ok(cast(l.player, sub(l.exit, l.player), PLAYER_RADIUS, l), `stage ${i + 1} blocks the direct route`)
    const maze = l.maze!
    assert.ok(mazeDistances(maze, cellAt(maze, l.player)).every(distance => distance >= 0))
    for (const cell of maze.cells) {
      for (const dir of cardinal) {
        const offset = mul(dir, CELL_SIZE)
        const neighbor = add(cell.center, offset)
        if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= l.width || neighbor.y >= l.height) continue
        const connected = cell.neighbors.includes(cellAt(maze, neighbor))
        assert.equal(!cast(cell.center, offset, ENEMY_RADIUS, l), connected, 'the maze graph matches the physical walls')
      }
    }
    assert.ok(reachable(l, l.player, l.exit), `stage ${i + 1} exit is reachable`)
    l.batteries.forEach((battery, j) => {
      assert.ok(isClear(battery, BATTERY_RADIUS, l), `stage ${i + 1} battery ${j + 1} is on open floor`)
      assert.ok(reachable(l, l.player, battery), `stage ${i + 1} battery ${j + 1} is reachable`)
    })
  }
  const l = LEVELS[6]
  assert.ok(reachable(l, l.player, l.exit, p => p.y <= l.player.y))
  assert.ok(reachable(l, l.player, l.exit, p => p.y >= l.player.y))
})

test('a chaser turns before hitting a wall and follows the passage around it', () => {
  const { maze, boards } = buildMaze([
    '+---+---+---+',
    '|       |   |',
    '+---+   +   +',
    '|           |',
    '+---+---+---+',
  ], 4)
  const start = maze.cells[1].center
  const player = maze.cells[2].center
  const game = new Game([{
    ...openLevel, width: 3 * CELL_SIZE, height: 2 * CELL_SIZE, maze, boards,
    player, exit: maze.cells[3].center, batteries: [],
    enemies: [{ id: 'zhang', position: start, heading: 0, delay: 0 }],
  }])
  game.start()
  assert.ok(cast(start, sub(player, start), ENEMY_RADIUS, game.level))
  assert.equal(game.tick(v()), undefined)
  assert.equal(game.enemies[0].position.x, start.x)
  assert.ok(game.enemies[0].position.y > start.y)
  let wentAround = false
  for (let i = 0; i < 360; i++) {
    const event = game.tick(v())
    if (event?.type === 'catch') break
    const { position } = game.enemies[0]
    assert.ok(isClear(position, ENEMY_RADIUS, game.level))
    wentAround ||= position.x > 2 * CELL_SIZE && position.y > CELL_SIZE
  }
  assert.ok(wentAround)
  assert.equal(game.attempts, 1)
})

test('chase maps have no dead ends and pickups offer separated escape routes', () => {
  for (const level of LEVELS) {
    const maze = level.maze!
    assert.ok(maze.cells.every(cell => cell.neighbors.length >= 2))
    assert.equal(level.batteries.length, level === LEVELS[0] ? 1 : 2)
    const start = mazeDistances(maze, cellAt(maze, level.player))
    for (const battery of level.batteries) {
      const index = cellAt(maze, battery)
      assert.ok(start[index] >= 3)
      assert.ok(maze.cells[index].neighbors.length >= 2)
      assert.ok(level.enemies.every(enemy => cellAt(maze, enemy.position) !== index))
    }
  }
})
