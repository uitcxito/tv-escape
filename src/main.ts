import './style.css'
import { Sound } from './audio'
import { Game, MAX_CHARGES } from './game'
import type { Hint, Mode } from './game'
import { CAST, LEVELS, STEP, WORLD } from './levels'
import { v } from './physics'
import { portraitURL, Renderer } from './render'

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const game = new Game()
const renderer = new Renderer(byId<HTMLCanvasElement>('map'))
const pause = byId<HTMLButtonElement>('pause')
const mute = byId<HTMLButtonElement>('mute')
const pulseButton = byId<HTMLButtonElement>('pulse')
const powerCount = byId('power-count')
const powerCells = Array.from({ length: MAX_CHARGES }, () => document.createElement('span'))
byId('power-cells').append(...powerCells)
const unlock = byId<HTMLButtonElement>('unlock')
const overlay = byId('overlay')
const action = byId<HTMLButtonElement>('result-action')
const bubble = byId('hint')
const feedback = byId('feedback')
const audioNote = byId('audio-note')
const down = new Set<string>()
const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD'])
const hints: Record<NonNullable<Hint>, string> = {
  move: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动',
  dodge: '躲开头像，注意反弹',
  exit: '进入绿门过关',
  pulse: '<kbd>空格</kbd> 释放干扰<br>捡电池可补充',
}
const batteryTotal = LEVELS.reduce((total, level) => total + level.batteries.length, 0)
let shownHint: Hint
let shownMode: Mode
let shownIndex = -1
let shownCharge = -1
let shownPulseReady: boolean | undefined
let impact = 0
let toast = 0
let accumulated = 0
let last = performance.now()
let artTime = 0

function updateSound() {
  const needsActivation = sound.needsActivation
  const label = needsActivation ? '开启游戏声音' : sound.muted ? '取消静音' : '静音'
  if (needsActivation) mute.removeAttribute('aria-pressed')
  else mute.setAttribute('aria-pressed', String(sound.muted))
  mute.setAttribute('aria-label', label)
  mute.title = needsActivation ? label : `${label} (M)`
  mute.classList.toggle('needs-activation', needsActivation)
  byId('mute-label').textContent = needsActivation ? '开启声音' : sound.muted ? '静音' : '声音'
  byId('sound-waves').style.display = sound.muted ? 'none' : ''
  byId('sound-cross').style.display = sound.muted ? '' : 'none'
  const { music, hit } = sound.status
  unlock.hidden = !sound.blocked || sound.muted || game.mode === 'won' || game.mode === 'paused'
  audioNote.textContent = music === 'missing' && hit === 'missing' ? '本地音频未加载'
    : music === 'missing' ? '《U Can’t Touch This》未加载'
    : hit === 'missing' ? '碰撞短句未加载' : ''
  audioNote.hidden = !audioNote.textContent
}

const sound = new Sound(() => queueMicrotask(updateSound))

function updateLevel() {
  shownIndex = game.index
  byId('level-number').textContent = String(game.index + 1).padStart(2, '0')
  byId('level-count').textContent = `第 ${game.index + 1} / ${LEVELS.length} 关`
  byId('level-title').textContent = game.level.title
  byId('hud').classList.toggle('crowded', game.level.enemies.length > 4)
  byId('roster-count').textContent = `追捕者 · ${game.level.enemies.length} 人`
  byId('roster-speed').textContent = `${game.level.speed} 单位/秒`
  byId('progress').replaceChildren(...LEVELS.map((_, index) => {
    const el = document.createElement('span')
    if (index <= game.index) el.className = index === game.index && game.mode !== 'won' ? 'active' : 'done'
    return el
  }))
  byId('roster').replaceChildren(...game.level.enemies.map(({ id }) => {
    const person = CAST[id]
    const tag = document.createElement('span')
    tag.className = 'person'
    tag.style.setProperty('--tag', person.light)
    const img = document.createElement('img')
    img.src = portraitURL(id)
    img.alt = ''
    tag.append(img, person.name)
    return tag
  }))
}

function updateMode() {
  const restoreFocus = !overlay.hidden && overlay.contains(document.activeElement)
  shownMode = game.mode
  const paused = game.mode === 'paused'
  const won = game.mode === 'won'
  overlay.hidden = !paused && !won
  pause.disabled = won
  pause.setAttribute('aria-label', paused ? '继续' : '暂停')
  pause.title = paused ? '继续 (Esc)' : '暂停 (Esc)'
  byId('pause-label').textContent = paused ? '继续' : '暂停'
  pause.querySelector('path')?.setAttribute('d', paused ? 'm9 5 10 7-10 7z' : 'M9 5v14M15 5v14')
  if (!overlay.hidden) {
    byId('result-icon').textContent = won ? '08 / 08' : 'Ⅱ'
    byId('result-kicker').textContent = won ? 'SIGNAL CLEAR · 通关' : 'ON HOLD · 暂停'
    byId('result-title').textContent = won ? '成功逃出！' : '游戏暂停'
    const summary = `八关全部完成 · 电池 ${game.batteriesFound} / ${batteryTotal}`
    byId('result-description').textContent = won
      ? summary + (game.pulseHits ? ` · 干扰命中 ${game.pulseHits} 次` : '')
      : '继续后，用 WASD 接着跑。'
    action.textContent = won ? '再玩一次' : '继续游戏'
    action.focus({ preventScroll: true })
  } else if (restoreFocus) pause.focus({ preventScroll: true })
  if (won) updateLevel()
  updateSound()
}

function updateHint() {
  const hint = game.hint
  if (shownHint !== hint) {
    shownHint = hint
    bubble.dataset.kind = hint ?? ''
    bubble.innerHTML = hint ? hints[hint] : ''
  }
  const hidden = !hint || game.mode === 'paused' || game.mode === 'won'
  bubble.hidden = hidden
  if (hidden) return
  // Teach at the relevant spot without letting the callout obscure the moving actor.
  const p = hint === 'move' || hint === 'pulse' ? game.level.player : hint === 'dodge'
    ? game.level.enemies[0].position : game.level.exit
  bubble.style.setProperty('--x', `${p.x / WORLD.width * 100}%`)
  bubble.style.setProperty('--y', `${p.y / WORLD.height * 100}%`)
}

function updatePower() {
  if (shownCharge !== game.charge) {
    shownCharge = game.charge
    powerCount.textContent = `剩余 ${game.charge} 次`
    powerCells.forEach((cell, index) => cell.classList.toggle('charged', index < game.charge))
  }
  if (shownPulseReady !== game.canPulse) {
    shownPulseReady = game.canPulse
    pulseButton.setAttribute('aria-disabled', String(!game.canPulse))
  }
}

function sync() {
  if (shownIndex !== game.index) updateLevel()
  if (shownMode !== game.mode) updateMode()
  updateHint()
  updatePower()
}

function togglePause() {
  down.clear()
  accumulated = 0
  if (game.mode === 'paused') game.resume()
  else game.pause()
  sync()
}

function pauseForBlur() {
  down.clear()
  accumulated = 0
  game.pause()
  sync()
}

function showFeedback(message: string, color: string, seconds: number) {
  toast = seconds
  feedback.textContent = message
  feedback.style.setProperty('--tag', color)
  feedback.hidden = false
}

function releasePulse() {
  const hits = game.releasePulse()
  if (hits === undefined) return
  sound.enable()
  sound.effect('pulse')
  showFeedback(hits ? `干扰命中 ${hits} 名 · 快溜！` : '干扰已释放 · 短时保护', '#fff1b9', 1.35)
  sync()
}

pause.addEventListener('click', () => { sound.enable(); togglePause() })
mute.addEventListener('click', () => {
  if (sound.needsActivation) sound.enable()
  else sound.toggleMute()
})
unlock.addEventListener('click', () => sound.enable())
pulseButton.addEventListener('click', releasePulse)
action.addEventListener('click', () => {
  sound.enable()
  if (game.mode === 'won') {
    down.clear()
    game.restart()
    sound.resetGameplayMusic()
    accumulated = impact = toast = 0
    feedback.hidden = true
    sync()
  } else togglePause()
})

window.addEventListener('keydown', e => {
  if (e.metaKey || e.altKey || e.ctrlKey) return
  if (movement.has(e.code)) {
    e.preventDefault()
    if (!e.repeat) sound.enable()
    if (game.mode === 'ready' && !e.repeat) {
      game.start()
      sound.startGameplayMusic()
      accumulated = 0
    }
    if (game.mode === 'running' && !e.repeat) down.add(e.code)
    return
  }
  if (e.code === 'Space' && game.mode === 'running') {
    e.preventDefault()
    if (!e.repeat) releasePulse()
    return
  }
  if (e.repeat) return
  if (e.code === 'Escape') {
    e.preventDefault()
    sound.enable()
    togglePause()
  } else if (e.code === 'KeyM') {
    e.preventDefault()
    sound.toggleMute()
  }
})
window.addEventListener('keyup', e => down.delete(e.code))
window.addEventListener('blur', pauseForBlur)
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForBlur() })

function frame(now: number) {
  const elapsed = Math.max(0, Math.min((now - last) / 1000, .1))
  last = now
  if (game.mode !== 'paused' && game.mode !== 'won') artTime += elapsed
  if (game.mode === 'running') {
    accumulated += elapsed
    const input = v(Number(down.has('KeyD')) - Number(down.has('KeyA')),
      Number(down.has('KeyS')) - Number(down.has('KeyW')))
    while (accumulated + 1e-9 >= STEP && game.mode === 'running') {
      accumulated = Math.max(0, accumulated - STEP)
      impact = Math.max(0, impact - STEP * 2.5)
      toast = Math.max(0, toast - STEP)
      const event = game.tick(input)
      if (event?.type === 'catch') {
        const actor = CAST[event.actor]
        sound.caught(event.actor)
        impact = 1
        showFeedback(`${actor.name}：「${actor.line}」 · 重新出发 · ${game.attempts}`, actor.light, 2.2)
      } else if (event?.type === 'pickup') {
        sound.effect('pickup')
        showFeedback(event.charged ? '电池 +1 · 空格释放干扰' : '已收集电池 · 干扰电量已满', '#fff1b9', 1.25)
      } else if (event) {
        sound.effect('clear')
        impact = toast = 0
      }
    }
  }
  feedback.hidden = toast <= 0 || game.mode !== 'running'
  sync()
  renderer.draw(game, artTime, impact)
  requestAnimationFrame(frame)
}

sync()
requestAnimationFrame(frame)
