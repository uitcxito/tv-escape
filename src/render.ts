import { CAST, ENEMY_RADIUS, WORLD } from './levels'
import type { CastId, Level } from './levels'
import type { Game } from './game'
import type { Board, Vec } from './physics'

const INK = '#26233e'
const MINT = '#87ecac'
const PALETTES = [
  ['#fff3bc', '#ffdc7e', '#e6ac4e'],
  ['#ede1ff', '#cfb7f5', '#a789db'],
  ['#ffe0df', '#ffb6bc', '#de8697'],
]
const TAU = Math.PI * 2

export const portraitURL = (id: CastId) => `${import.meta.env.BASE_URL}portraits/${CAST[id].file}`

function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
  fill: string | CanvasGradient, stroke?: string, thickness = 2) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fillStyle = fill
  c.fill()
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = thickness
    c.stroke()
  }
}

function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke?: string, thickness = 2) {
  c.beginPath()
  c.arc(x, y, r, 0, TAU)
  c.fillStyle = fill
  c.fill()
  if (stroke) {
    c.strokeStyle = stroke
    c.lineWidth = thickness
    c.stroke()
  }
}

function line(c: CanvasRenderingContext2D, points: number[], color: string, width: number) {
  c.beginPath()
  c.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1])
  c.strokeStyle = color
  c.lineWidth = width
  c.stroke()
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string,
  latin = false) {
  c.fillStyle = color
  c.font = latin ? `700 ${size}px Consolas, monospace` : `750 ${size}px "Microsoft YaHei", sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, x, y)
}

function drawBoard(c: CanvasRenderingContext2D, b: Board) {
  const dx = b.b.x - b.a.x
  const dy = b.b.y - b.a.y
  const len = Math.hypot(dx, dy)
  const r = b.radius
  const [light, fill, dark] = PALETTES[b.tone]
  c.save()
  c.translate(b.a.x, b.a.y + 4)
  c.rotate(Math.atan2(dy, dx))
  round(c, -r, -r + 3, len + 2 * r, 2 * r, r, '#29213b22')
  c.translate(0, -4 * Math.cos(Math.atan2(dy, dx)))
  c.translate(-4 * Math.sin(Math.atan2(dy, dx)), 0)
  round(c, -r + 2, -r + 2, len + 2 * r - 4, 2 * r - 4, r - 2, dark, INK, 4)
  round(c, -r + 4, -r + 4, len + 2 * r - 8, 2 * r - 13, r - 4, fill)
  c.lineCap = 'round'
  line(c, [12, -r + 7, len - 12, -r + 7], light, 2.5)
  line(c, [28, 4, len * .51, 4], dark, 1.25)
  line(c, [len * .68, 4, len - 28, 4], dark, 1.25)
  for (const x of [2, len - 2]) {
    disc(c, x, -1, 3.5, light, INK, 1.4)
    line(c, [x - 1.6, -1, x + 1.6, -1], INK, 1)
  }
  c.restore()
}

function drawFloor(c: CanvasRenderingContext2D, level: Level, index: number) {
  const { width: w, height: h } = WORLD
  const base = c.createLinearGradient(0, 0, 0, h)
  base.addColorStop(0, '#f5fbff')
  base.addColorStop(.55, '#f2f6fb')
  base.addColorStop(1, '#eaf0f8')
  c.fillStyle = base
  c.fillRect(0, 0, w, h)
  c.beginPath()
  for (let x = 0; x < w; x += 28) { c.moveTo(x + .5, 0); c.lineTo(x + .5, h) }
  for (let y = 0; y < h; y += 28) { c.moveTo(0, y + .5); c.lineTo(w, y + .5) }
  c.strokeStyle = '#b2c2d344'
  c.lineWidth = 1
  c.stroke()
  for (let x = 56; x < w; x += 56) {
    for (let y = 56; y < h; y += 56) disc(c, x, y, 1.2, '#a2b4cb59')
  }
  c.strokeStyle = '#7185a523'
  c.lineWidth = 2
  c.strokeRect(12, 12, w - 24, h - 24)
  for (const [x, y, dx, dy] of [[12, 12, 1, 1], [w - 12, 12, -1, 1], [12, h - 12, 1, -1], [w - 12, h - 12, -1, -1]]) {
    line(c, [x, y + dy * 22, x, y, x + dx * 22, y], '#8396b67d', 2)
  }
  label(c, `STAGE  ${String(index + 1).padStart(2, '0')}`, w / 2, 40, 15, '#6b7f9a', true)
  line(c, [w / 2 - 75, 40, w / 2 - 49, 40], '#a0b2cb99', 1)
  line(c, [w / 2 + 49, 40, w / 2 + 75, 40], '#a0b2cb99', 1)
  const { x, y } = level.player
  c.setLineDash([4, 5])
  disc(c, x, y, 35, '#b6ceeb30', '#92abd58f')
  c.setLineDash([])
  label(c, 'START', x, y + 52, 11, '#7088a7', true)
  level.boards.forEach(b => drawBoard(c, b))
}

function drawDoor(c: CanvasRenderingContext2D, p: Vec, time: number) {
  c.save()
  c.translate(p.x, p.y)
  const glow = c.createRadialGradient(0, 3, 8, 0, 3, 83)
  glow.addColorStop(0, '#71eea9aa')
  glow.addColorStop(1, '#71eea900')
  round(c, -83, -80, 166, 166, 70, glow)
  c.globalAlpha = .36 + Math.sin(time * 4) * .10
  c.setLineDash([3, 5])
  disc(c, 0, 3, 45, '#d1ffd977', '#238a57', 1.6)
  c.setLineDash([])
  c.globalAlpha = 1
  round(c, -28, -34, 56, 73, 11, '#21644344')
  round(c, -27, -38, 54, 72, 10, '#36b875', INK, 3.5)
  round(c, -18, -28, 36, 58, 5, '#145443', INK, 2.5)
  round(c, -13, -24, 26, 53, 4, '#b1ffc1')
  line(c, [-6, -6, 6, 3, -6, 12], '#1b8250', 4)
  round(c, -33, 28, 66, 9, 3, MINT, INK, 2.5)
  round(c, -26, 45, 52, 20, 6, '#f2fff4', '#357257', 1.5)
  label(c, '出口', 0, 55, 12, '#225e40')
  for (let i = 0; i < 3; i++) {
    const x = i % 2 ? -41 : 37 + 8 * i
    const y = -23 + i * 17 + Math.sin(time * 2.8 + i) * 7
    line(c, [x - 4, y, x + 4, y], '#41c478', 2)
    line(c, [x, y - 4, x, y + 4], '#41c478', 2)
  }
  c.restore()
}

function drawTV(c: CanvasRenderingContext2D, game: Game, t: number) {
  const { player: p, moving, facing } = game
  c.save()
  c.translate(p.x, p.y)
  if (game.protected) {
    disc(c, 0, 0, 34, '#8ad5ff36', '#608ae480', 2)
    c.globalAlpha = Math.floor(game.shield * 12) % 2 ? .36 : 1
  }
  c.fillStyle = '#3a3e6b30'
  c.beginPath()
  c.ellipse(0, 25, 29, 7, 0, 0, TAU)
  c.fill()
  const bob = moving ? Math.sin(t * 27) * 1.8 : Math.sin(t * 3) * 1.4
  c.translate(0, bob)
  if (moving) c.rotate(facing * .07)
  c.lineCap = 'round'
  line(c, [-1, -20, -11, -34], INK, 3)
  line(c, [1, -20, 11, -35], INK, 3)
  disc(c, -11, -34, 3.4, '#ffd385', INK, 1.6)
  disc(c, 11, -35, 3.4, '#ff8fbb', INK, 1.6)
  round(c, -20, 13, 12, 12, 3, '#fd8fbc', INK, 3)
  round(c, 8, 13, 12, 12, 3, '#fd8fbc', INK, 3)
  round(c, -29, -20, 58, 41, 12, '#f580b9', INK, 4)
  round(c, -27, -19, 53, 35, 10, '#87aaff', INK, 2)
  round(c, -21, -13, 35, 23, 7, '#c9fbff', INK, 2.3)
  round(c, -18, -11, 19, 3, 1, '#ffffffba')
  const x = facing * 1.7
  line(c, [-11 + x, -4, -11 + x, 0], INK, 2.4)
  line(c, [1 + x, -4, 1 + x, 0], INK, 2.4)
  line(c, [-7 + x, 2, -4 + x, 5, -1 + x, 2], '#7650a3', 1.6)
  disc(c, 20, -7, 3.2, '#ffe08f', INK, 1.4)
  disc(c, 20, 3, 2.5, '#fbb6da', INK, 1.2)
  c.restore()
}

export class Renderer {
  private c: CanvasRenderingContext2D
  private floor = document.createElement('canvas')
  private floorLevel = -1
  private photos = new Map<CastId, HTMLImageElement>()
  constructor(private canvas: HTMLCanvasElement) {
    this.c = canvas.getContext('2d')!
    this.floor.width = WORLD.width * 2
    this.floor.height = WORLD.height * 2
    for (const id of Object.keys(CAST) as CastId[]) {
      const img = new Image()
      img.src = portraitURL(id)
      this.photos.set(id, img)
    }
  }

  draw(game: Game, time: number, impact: number) {
    const c = this.c
    const { width: w, height: h } = WORLD
    const scale = Math.min(window.devicePixelRatio || 1, 3)
    const width = Math.round(this.canvas.clientWidth * scale)
    const height = Math.round(this.canvas.clientHeight * scale)
    if (!width || !height) return
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    c.setTransform(width / w, 0, 0, height / h, 0, 0)
    if (this.floorLevel !== game.index) {
      const fc = this.floor.getContext('2d')!
      fc.setTransform(2, 0, 0, 2, 0, 0)
      drawFloor(fc, game.level, game.index)
      this.floorLevel = game.index
    }
    c.drawImage(this.floor, 0, 0, w, h)
    drawDoor(c, game.level.exit, time)

    for (const enemy of game.enemies) {
      const info = CAST[enemy.id]
      for (let i = enemy.trail.length - 1; i >= 0; i--) {
        const p = enemy.trail[i]
        c.globalAlpha = .2 * (1 - i / 10)
        disc(c, p.x, p.y, ENEMY_RADIUS - i * 1.9, info.color)
      }
    }
    c.globalAlpha = 1
    for (const enemy of game.enemies) {
      const { x, y } = enemy.position
      const info = CAST[enemy.id]
      disc(c, x, y + 5, ENEMY_RADIUS + 1, '#29213b2d')
      disc(c, x, y, ENEMY_RADIUS, info.color, INK, 3)
      c.save()
      c.beginPath()
      c.arc(x, y, ENEMY_RADIUS - 5, 0, TAU)
      c.clip()
      const img = this.photos.get(enemy.id)
      const r = ENEMY_RADIUS - 5
      if (img?.naturalWidth) c.drawImage(img, x - r, y - r, r * 2, r * 2)
      else {
        disc(c, x, y, r, info.light)
        label(c, info.initial, x, y, 24, INK)
      }
      c.restore()
      const tagX = Math.max(34, Math.min(w - 34, x))
      const tagY = y + (y > h - 61 ? -35 : 35)
      round(c, tagX - 32, tagY - 10, 64, 20, 6, info.light, INK, 1.8)
      label(c, info.name, tagX, tagY, 12, INK)
    }

    drawTV(c, game, time)
    if (impact > 0 && game.lastCaught) {
      const { x, y } = game.lastCaught
      c.globalAlpha = impact * .8
      disc(c, x, y, 32 + (1 - impact) * 58, '#ffa6ba45', '#f5698b', 3)
      c.globalAlpha = 1
    }
  }
}
