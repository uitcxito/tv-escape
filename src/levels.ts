import { v } from './physics'
import type { Arena, Board, Vec } from './physics'

export const WORLD = { width: 1120, height: 560 }
export const PLAYER_SPEED = 260
export const PLAYER_RADIUS = 23
export const ENEMY_RADIUS = 29
export const EXIT_RADIUS = 32
export const STEP = 1 / 120

export const CAST = {
  zhang: { name: '张一鸣', color: '#f16b84', light: '#ffdfdf', file: 'zhang.webp', initial: '张' },
  ma: { name: '马云', color: '#9877df', light: '#ebe2ff', file: 'ma.webp', initial: '马' },
  liu: { name: '刘强东', color: '#f9a44c', light: '#ffe8c4', file: 'liu.webp', initial: '刘' },
} as const

export type CastId = keyof typeof CAST
interface Spawn { id: CastId; position: Vec; heading: number }
export interface Level extends Arena {
  title: string
  player: Vec
  exit: Vec
  speed: number
  enemies: readonly Spawn[]
}

const board = (x: number, y: number, w: number, h: number, tone = 0, radius = 16): Board =>
  ({ a: v(x, y), b: v(w, h), radius, tone })
const at = (id: CastId, x: number, y: number, heading: number): Spawn =>
  ({ id, position: v(x, y), heading: heading * Math.PI / 180 })
const level = (title: string, speed: number, player: Vec, exit: Vec, enemies: Spawn[], boards: Board[]): Level =>
  ({ ...WORLD, title, speed, player, exit, enemies, boards })

export const LEVELS: readonly Level[] = [
  level('试播现场', 140, v(132, 427), v(991, 139), [at('zhang', 787, 402, 148)], [
    board(319, 179, 526, 179), board(662, 294, 824, 220, 1), board(390, 385, 574, 385, 2),
  ]),
  level('斜板首秀', 160, v(121, 145), v(995, 429), [at('zhang', 825, 133, 164)], [
    board(291, 194, 445, 315, 1), board(482, 135, 654, 88),
    board(564, 411, 747, 308, 2), board(858, 195, 943, 267, 1),
  ]),
  level('双人夹击', 180, v(111, 415), v(1001, 135), [at('zhang', 418, 113, 113), at('ma', 837, 452, -138)], [
    board(252, 229, 252, 370, 1), board(389, 264, 630, 264),
    board(667, 124, 794, 164, 2), board(804, 295, 947, 352, 1),
  ]),
  level('反向折返', 200, v(129, 124), v(983, 425), [at('zhang', 595, 155, 123), at('ma', 870, 437, -138)], [
    board(285, 30, 285, 333, 1), board(496, 230, 496, 530),
    board(711, 30, 711, 333, 2), board(914, 241, 1034, 241),
  ]),
  level('环线追车', 225, v(122, 423), v(988, 141), [at('zhang', 395, 101, 151), at('ma', 859, 409, 162), at('liu', 955, 262, -88)], [
    board(340, 193, 547, 193, 1), board(572, 193, 779, 193),
    board(340, 373, 549, 373), board(573, 373, 778, 373, 2),
    board(330, 205, 330, 360), board(788, 204, 788, 359, 1),
  ]),
  level('交叉回响', 250, v(116, 142), v(1004, 429), [at('zhang', 801, 115, 147), at('ma', 314, 440, -132), at('liu', 968, 250, 159)], [
    board(255, 208, 365, 269, 2), board(474, 96, 521, 224, 1),
    board(675, 174, 741, 233), board(498, 365, 625, 458, 1),
    board(781, 374, 891, 321, 2),
  ]),
  level('双线突围', 275, v(119, 278), v(1002, 278), [at('zhang', 389, 115, 150), at('ma', 711, 436, -155), at('liu', 1025, 111, 127)], [
    board(269, 237, 343, 280, 1), board(343, 280, 269, 323, 1),
    board(447, 278, 694, 278), board(694, 278, 823, 278, 2),
    board(480, 105, 578, 147, 2), board(590, 430, 675, 470, 1),
  ]),
  level('终极逃亡', 300, v(116, 417), v(1004, 137), [at('zhang', 368, 104, 135), at('ma', 818, 452, -155), at('liu', 1004, 355, -120)], [
    board(225, 210, 332, 284, 2), board(393, 381, 493, 471),
    board(480, 155, 602, 96, 1), board(510, 286, 657, 286, 2),
    board(730, 181, 835, 229), board(771, 369, 900, 307, 1),
  ]),
]
