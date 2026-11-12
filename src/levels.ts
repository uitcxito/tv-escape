import { buildMaze } from './maze'
import type { Maze } from './maze'
import type { Arena, Vec } from './physics'

export const WORLD = { width: 1120, height: 560 }
export const PLAYER_SPEED = 260
export const PLAYER_RADIUS = 23
export const ENEMY_RADIUS = 29
export const EXIT_RADIUS = 40
export const BATTERY_RADIUS = 16
export const STEP = 1 / 120

export const CAST = {
  zhang: { name: '张一鸣', color: '#f16b84', light: '#ffdfdf', line: '不要让跳动停下来！' },
  ma: { name: '马云', color: '#9877df', light: '#ebe2ff', line: '996！' },
  liu: { name: '刘强东', color: '#f9a44c', light: '#ffe8c4', line: '兄弟，你的快递到了！' },
  chen: { name: '陈睿', color: '#36b9df', light: '#dcf5ff', line: '下次一定跑得掉！' },
  pony: { name: '马化腾', color: '#4b76df', light: '#dce6ff', line: '你要不要 Q 币呀？' },
  lei: { name: '雷军', color: '#ed6f3b', light: '#ffe1ce', line: '准备好，再来一局！' },
  li: { name: '李彦宏', color: '#29aa83', light: '#d4f5e9', line: '已为你找到复活点！' },
  wang: { name: '王兴', color: '#d69e1c', light: '#fff0b3', line: '订单已送达！' },
  zhou: { name: '周鸿祎', color: '#cf4b62', light: '#fbd4df', line: '发现小电视，立即拦截！' },
} as const

export type CastId = keyof typeof CAST
interface Spawn { id: CastId; position: Vec; heading: number; delay: number }
export interface Level extends Arena {
  title: string
  player: Vec
  exit: Vec
  speed: number
  enemies: readonly Spawn[]
  batteries: readonly Vec[]
  maze?: Maze
}

type CastSpawn = [id: CastId, heading: number, delay?: number]

function level(title: string, speed: number, chaseRange: number, cast: readonly CastSpawn[],
  layout: readonly string[]): Level {
  const { maze, boards, markers } = buildMaze(layout, chaseRange)
  const position = (mark: string) => {
    const point = markers.get(mark)?.[0]
    if (!point) throw new Error(`${title} has no maze marker ${mark}`)
    return point
  }
  const enemies = cast.map(([id, heading, delay = 0], i) =>
    ({ id, position: position(String(i + 1)), heading: heading * Math.PI / 180, delay }))
  return {
    ...WORLD, title, speed, maze, boards, enemies, player: position('S'), exit: position('E'),
    batteries: markers.get('*') ?? [],
  }
}

// S: start, E: exit, *: battery, 1–9: chaser spawns in cast order.
export const LEVELS: readonly Level[] = [
  level('入门走廊', 126, 2, [['zhang', 0]], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '|   |       |           |   |           |',
    '+   +---+   +---+---+   +   +   +---+   +',
    '|                           |       | E |',
    '+   +---+   +   +---+   +---+   +---+   +',
    '|           |   |   |                   |',
    '+---+---+   +---+   +---+   +---+   +   +',
    '| S       * |               |   |   |   |',
    '+   +---+---+   +---+---+---+   +   +   +',
    '|           |             1 |       |   |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
  level('折角信号', 132, 2, [['zhang', 180, 1.3]], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '|           |   |   |   |       |       |',
    '+   +---+---+   +   +   +---+   +   +   +',
    '| S         |   |     1   *         |   |',
    '+---+   +   +   +---+   +   +---+   +   +',
    '|       |   |           |   |   |       |',
    '+   +---+   +---+---+   +   +   +   +---+',
    '|   |                           |     E |',
    '+   +---+   +   +   +   +   +   +---+   +',
    '|         * |       |   |   |           |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
  level('双路夹击', 139, 2, [['zhang', -90], ['ma', 0, 1.25]], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '|               |       |             E |',
    '+   +   +   +---+   +   +   +---+   +   +',
    '|   |   |   | 1 |   |   |   |   |   |   |',
    '+   +   +   +   +---+   +   +   +---+   +',
    '|     *                     |       |   |',
    '+   +---+---+   +---+   +---+   +   +   +',
    '|   |   |       |       |       |   |   |',
    '+   +   +---+   +---+   +   +---+   +   +',
    '| S                   *     | 2         |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
  level('折返巷道', 145, 2, [
    ['zhang', 0, .5], ['ma', 180, 3.5], ['chen', -90, 3.5],
  ], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '| S                   3 |   |           |',
    '+   +---+   +   +---+   +   +   +---+   +',
    '|   |       |   |               |       |',
    '+   +---+   +---+   +---+   +---+   +   +',
    '|   |   |   |       |   |       | 2 |   |',
    '+   +   +   +---+   +   +   +   +---+   +',
    '|         *   1         |           |   |',
    '+   +---+   +   +---+   +   +---+   +   +',
    '|           |   |       | *     |     E |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
  level('环线追车', 151, 2, [
    ['zhang', -90, 1], ['ma', 0, 3], ['liu', 0, 3.25],
    ['pony', 180, 3.7],
  ], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '|   |   |         2     |   |           |',
    '+   +   +   +---+---+   +   +   +---+   +',
    '|   |           |               |   |   |',
    '+   +   +---+   +   +   +---+   +   +   +',
    '| S         | * |   |   | 3 |         E |',
    '+   +   +---+   +---+   +   +   +---+   +',
    '|   |                       |   |   |   |',
    '+   +   +   +   +---+---+   +   +   +   +',
    '|         1 |   |     *       4         |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
  level('交叉回响', 157, 2, [
    ['zhang', -90, 1.5], ['ma', 180, 3.5], ['liu', 0, 4.25],
    ['chen', -90, 2], ['pony', 90, 4.5],
  ], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '|       |   |             1 |   |       |',
    '+   +   +   +---+---+---+   +   +   +   +',
    '|         *             |             E |',
    '+   +---+   +---+   +   +   +   +   +   +',
    '|   |       |       | 4 |       |   |   |',
    '+   +---+   +---+   +---+   +---+   +   +',
    '| S         |   |             *   3 |   |',
    '+   +---+---+   +   +   +   +   +---+   +',
    '|         2         |   |   |   |     5 |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
  level('双线突围', 164, 3, [
    ['zhang', -90, 1.75], ['ma', -90, 3.5], ['liu', -90, 1.75],
    ['chen', 90, 2.25], ['pony', 0, 5.25], ['lei', -90, 2.5],
    ['li', 90, 5.5],
  ], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '|             1 |       |         3     |',
    '+   +   +---+   +   +---+   +---+   +   +',
    '|   |     * |             5     |   |   |',
    '+   +   +---+   +   +---+   +   +   +   +',
    '| S         |   |   |   |   | 7 |     E |',
    '+   +   +---+---+   +   +---+   +   +   +',
    '|   |   |   |     2         |   |   |   |',
    '+   +   +   +   +---+   +   +---+   +   +',
    '|         4     |     * |         6     |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
  level('终局迷阵', 171, 3, [
    ['zhang', -90, 1.5], ['ma', 180, 2.75], ['liu', 90, 2.5],
    ['chen', -90, 3], ['pony', 0, 2.5], ['lei', 0, 5.25],
    ['li', 0, 5.5], ['wang', 180, 4.5], ['zhou', 180, 5.5],
  ], [
    '+---+---+---+---+---+---+---+---+---+---+',
    '|           | 1         |   |     5   E |',
    '+   +---+   +   +   +   +   +   +   +   +',
    '|   |     9     | 7     | 6     |       |',
    '+   +---+---+   +   +---+   +---+   +   +',
    '|                       |         * |   |',
    '+---+---+   +---+   +---+   +   +   +   +',
    '|       |   | 4             | 3 |       |',
    '+---+   +   +---+   +---+   +---+   +   +',
    '| S       * |         2         |     8 |',
    '+---+---+---+---+---+---+---+---+---+---+',
  ]),
]
