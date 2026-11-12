import { CAST, ENEMY_RADIUS, WORLD } from './levels'
import type { CastId, Level } from './levels'
import { PULSE_DURATION, PULSE_RADIUS } from './game'
import type { Game } from './game'
import { WALL_RADIUS } from './maze'
import type { Board, Vec } from './physics'

const INK = '#26233e'
const MINT = '#87ecac'
const TAU = Math.PI * 2

export const portraitURL = (id: CastId) => `${import.meta.env.BASE_URL}portraits/${id}.webp`

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

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  c.fillStyle = color
  c.font = `750 ${size}px "Microsoft YaHei", sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, x, y)
}

function drawWalls(c: CanvasRenderingContext2D, boards: readonly Board[]) {
  const walls = new Path2D()
  for (const { a, b } of boards) {
    walls.moveTo(a.x, a.y)
    walls.lineTo(b.x, b.y)
  }
  const width = WALL_RADIUS * 2
  c.save()
  c.lineCap = 'round'
  c.translate(0, 4)
  c.strokeStyle = '#2c24422b'
  c.lineWidth = width + 1
  c.stroke(walls)
  c.translate(0, -4)
  c.strokeStyle = INK
  c.lineWidth = width
  c.stroke(walls)
  c.strokeStyle = '#a79ace'
  c.lineWidth = width - 5
  c.stroke(walls)
  c.translate(0, -1.5)
  c.strokeStyle = '#e7def7'
  c.lineWidth = width - 10
  c.stroke(walls)
  c.restore()
}

function drawFloor(c: CanvasRenderingContext2D, level: Level) {
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
  const { x, y } = level.player
  c.setLineDash([4, 5])
  disc(c, x, y, 30, '#b6ceeb30', '#92abd58f')
  c.setLineDash([])
  label(c, '起点', x, y + 38, 11, '#546f93')
  drawWalls(c, level.boards)
}

function drawDoor(c: CanvasRenderingContext2D, p: Vec, time: number) {
  c.save()
  c.translate(p.x, p.y)
  const glow = c.createRadialGradient(0, 3, 8, 0, 3, 59)
  glow.addColorStop(0, '#71eea9aa')
  glow.addColorStop(1, '#71eea900')
  round(c, -59, -56, 118, 118, 57, glow)
  c.globalAlpha = .36 + Math.sin(time * 4) * .10
  c.setLineDash([3, 5])
  disc(c, 0, 1, 40, '#d1ffd977', '#238a57', 1.6)
  c.setLineDash([])
  c.globalAlpha = 1
  round(c, -28, -34, 56, 73, 11, '#21644344')
  round(c, -27, -38, 54, 72, 10, '#36b875', INK, 3.5)
  round(c, -18, -28, 36, 58, 5, '#145443', INK, 2.5)
  round(c, -13, -24, 26, 53, 4, '#b1ffc1')
  line(c, [-6, -6, 6, 3, -6, 12], '#1b8250', 4)
  round(c, -30, 28, 60, 15, 4, MINT, INK, 2.5)
  label(c, '出口', 0, 35, 10, '#225e40')
  for (let i = 0; i < 3; i++) {
    const x = i % 2 ? -41 : 37 + 8 * i
    const y = -23 + i * 17 + Math.sin(time * 2.8 + i) * 7
    line(c, [x - 4, y, x + 4, y], '#41c478', 2)
    line(c, [x, y - 4, x, y + 4], '#41c478', 2)
  }
  c.restore()
}

function drawBattery(c: CanvasRenderingContext2D, p: Vec, t: number, showLabel: boolean) {
  c.save()
  c.translate(p.x, p.y)
  disc(c, 0, 0, 24, '#ffe49947')
  c.setLineDash([3, 4])
  disc(c, 0, 0, 23, '#fff2ba3b', '#bd8d3a', 1.4)
  c.setLineDash([])
  c.translate(0, Math.sin(t * 4 + p.x * .013) * 3)
  round(c, -11, -11, 24, 28, 6, '#37274728')
  round(c, -5, -17, 10, 7, 2, '#fff2a9', INK, 2)
  round(c, -11, -12, 22, 27, 5, '#ffcc56', INK, 2.6)
  round(c, -7, -9, 5, 16, 2, '#fff3bba6')
  c.beginPath()
  c.moveTo(1, -8)
  c.lineTo(-5, 2)
  c.lineTo(0, 2)
  c.lineTo(-1, 10)
  c.lineTo(6, -1)
  c.lineTo(1, -1)
  c.closePath()
  c.fillStyle = '#67442c'
  c.fill()
  if (showLabel) label(c, '电池', 0, 36, 12, '#79532e')
  c.restore()
}

function drawPulse(c: CanvasRenderingContext2D, pulse: NonNullable<Game['pulse']>) {
  const progress = 1 - pulse.remaining / PULSE_DURATION
  const r = 36 + (PULSE_RADIUS - 36) * (1 - (1 - progress) ** 3)
  const { x, y } = pulse.origin
  c.save()
  c.globalAlpha = .78 * (1 - progress)
  disc(c, x, y, r, '#a8dfff35', '#6a78dd', 4)
  c.setLineDash([8, 9])
  disc(c, x, y, r + 7, '#ffffff00', '#8466d8', 2)
  c.setLineDash([])
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8 + .16
    disc(c, x + Math.cos(angle) * (r + 13), y + Math.sin(angle) * (r + 13), 3, '#6860cd')
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
  round(c, -21, -13, 35, 23, 7, game.pulse ? '#fff0ad' : '#c9fbff', INK, 2.3)
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
      drawFloor(fc, game.level)
      this.floorLevel = game.index
    }
    c.drawImage(this.floor, 0, 0, w, h)
    drawDoor(c, game.level.exit, time)
    game.level.batteries.forEach((p, i) => {
      if (!game.takenBatteries.has(i)) drawBattery(c, p, time, game.index === 0)
    })
    if (game.pulse) drawPulse(c, game.pulse)

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
      const waiting = enemy.delay > 0
      const disrupted = enemy.disrupted > 0
      c.globalAlpha = waiting ? .53 : 1
      disc(c, x, y + 5, ENEMY_RADIUS + 1, '#29213b2d')
      disc(c, x, y, ENEMY_RADIUS, disrupted ? '#a6c9ff' : info.color, INK, 3)
      c.save()
      c.beginPath()
      c.arc(x, y, ENEMY_RADIUS - 5, 0, TAU)
      c.clip()
      const img = this.photos.get(enemy.id)
      const r = ENEMY_RADIUS - 5
      if (img?.naturalWidth) c.drawImage(img, x - r, y - r, r * 2, r * 2)
      else {
        disc(c, x, y, r, info.light)
        label(c, info.name[0], x, y, 24, INK)
      }
      if (disrupted) {
        for (let dy = -20; dy < 25; dy += 7) {
          line(c, [x - r, y + dy, x + r, y + dy], '#e6f8ffc4', 2.5)
        }
      }
      c.restore()
      c.globalAlpha = 1
      const tagX = Math.max(34, Math.min(w - 34, x))
      const tagY = y + (y > h - 61 ? -35 : 35)
      round(c, tagX - 32, tagY - 10, 64, 20, 6, info.light, INK, 1.8)
      label(c, info.name, tagX, tagY, 12, INK)
      if (waiting || disrupted) {
        const badgeX = x > w - 54 ? x - 23 : x + 23
        const badgeY = y < 39 ? y + 22 : y - 22
        disc(c, badgeX, badgeY, 10, waiting ? '#f4f0ff' : '#d8f3ff', INK, 1.5)
        label(c, waiting ? '待' : '✦', badgeX, badgeY, 11, '#494b82')
      }
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
