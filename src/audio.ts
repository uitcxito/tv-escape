import { CAST } from './levels'
import type { CastId } from './levels'

const AUDIO = {
  music: 'audio/music.mp3',
  hit: 'audio/hit.mp3',
  musicVolume: .42,
  duckVolume: .10,
  voiceVolume: .95,
} as const

type Track = 'music' | 'hit' | CastId
type Availability = 'loading' | 'ready' | 'missing'
const TRACKS: readonly (readonly [Track, string])[] = [
  ['music', AUDIO.music],
  ['hit', AUDIO.hit],
  ...(Object.keys(CAST) as CastId[]).map(id => [id, `voices/${id}.wav`] as const),
]

const EFFECTS = {
  pickup: [620, 880, 1175],
  pulse: [255, 410],
  clear: [523, 659, 784, 1047],
} as const

export class Sound {
  muted = false
  blocked = false
  private availability = new Map<Track, Availability>(TRACKS.map(([track]) => [track, 'loading']))
  private buffers: Partial<Record<Track, AudioBuffer>> = {}
  private context?: AudioContext
  private master?: GainNode
  private musicGain?: GainNode
  private music?: AudioBufferSourceNode
  private voice?: AudioBufferSourceNode
  private unlocking?: Promise<void>

  constructor(private changed: () => void) {
    // Decode as early as possible without creating a live context before user input.
    void this.preload()
  }

  get status() {
    const music = this.availability.get('music') ?? 'missing'
    const voices = TRACKS.filter(([track]) => track !== 'music')
    const hit = voices.some(([track]) => this.availability.get(track) === 'ready') ? 'ready'
      : voices.some(([track]) => this.availability.get(track) === 'loading') ? 'loading' : 'missing'
    return { music, hit }
  }

  get needsActivation() {
    return !this.muted && this.context?.state !== 'running'
  }

  private async preload() {
    let decoder: OfflineAudioContext
    try { decoder = new OfflineAudioContext(2, 1, 44100) }
    catch {
      this.availability.clear()
      this.changed()
      return
    }
    await Promise.all(TRACKS.map(async ([track, path]) => {
      try {
        const url = new URL(import.meta.env.BASE_URL + path, document.baseURI)
        const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
        if (!response.ok || response.headers.get('Content-Type')?.includes('text/html')) {
          throw new Error('Audio asset missing')
        }
        const data = await response.arrayBuffer()
        this.buffers[track] = await decoder.decodeAudioData(data)
        this.availability.set(track, 'ready')
        if (track === 'music') this.startMusic()
      } catch { this.availability.set(track, 'missing') }
      this.changed()
    }))
  }

  enable() {
    try {
      if (!this.context) {
        const ctx = new AudioContext()
        this.master = ctx.createGain()
        this.master.gain.value = this.muted ? 0 : 1
        this.master.connect(ctx.destination)
        this.musicGain = ctx.createGain()
        this.musicGain.gain.value = AUDIO.musicVolume
        this.musicGain.connect(this.master)
        this.context = ctx
      }
      if (this.context.state === 'running') {
        this.blocked = false
        this.startMusic()
        this.changed()
      } else if (!this.unlocking) {
        // Some browsers leave resume() pending while activation is blocked.
        const retry = window.setTimeout(() => {
          this.blocked = this.context?.state !== 'running'
          this.unlocking = undefined
          this.changed()
        }, 650)
        const attempt = this.context.resume()
        this.unlocking = attempt
        void attempt.then(() => {
          this.blocked = this.context?.state !== 'running'
          this.startMusic()
        }, () => { this.blocked = true }).finally(() => {
          clearTimeout(retry)
          if (this.unlocking === attempt) this.unlocking = undefined
          this.changed()
        })
      }
    } catch {
      this.blocked = true
      this.changed()
    }
  }

  toggleMute() {
    this.muted = !this.muted
    if (this.master && this.context) this.master.gain.setValueAtTime(this.muted ? 0 : 1, this.context.currentTime)
    if (!this.muted) this.enable()
    this.changed()
  }

  effect(kind: keyof typeof EFFECTS) {
    const ctx = this.context
    if (ctx?.state !== 'running' || !this.master || this.muted) return
    const output = this.master
    const time = ctx.currentTime
    const duration = kind === 'pulse' ? .20 : .12
    EFFECTS[kind].forEach((frequency, i) => {
      const start = time + i * .058
      const tone = ctx.createOscillator()
      const volume = ctx.createGain()
      tone.type = 'triangle'
      tone.frequency.setValueAtTime(frequency, start)
      if (kind === 'pulse') tone.frequency.exponentialRampToValueAtTime(frequency * .42, start + duration)
      volume.gain.setValueAtTime(0, start)
      volume.gain.linearRampToValueAtTime(.065, start + .009)
      volume.gain.exponentialRampToValueAtTime(.001, start + duration)
      tone.connect(volume).connect(output)
      tone.onended = () => { tone.disconnect(); volume.disconnect() }
      tone.start(start)
      tone.stop(start + duration)
    })
  }

  private startMusic() {
    if (this.context?.state !== 'running' || !this.musicGain || !this.buffers.music || this.music) return
    const source = this.context.createBufferSource()
    source.buffer = this.buffers.music
    source.loop = true
    source.connect(this.musicGain)
    source.start()
    this.music = source
  }

  private setMusicVolume(value: number, duration: number) {
    if (!this.context || !this.musicGain) return
    const time = this.context.currentTime
    const gain = this.musicGain.gain
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(time)
    else {
      const current = gain.value
      gain.cancelScheduledValues(time)
      gain.setValueAtTime(current, time)
    }
    gain.linearRampToValueAtTime(value, time + duration)
  }

  caught(actor: CastId) {
    const ctx = this.context
    const buffer = this.buffers[actor] ?? this.buffers.hit
    if (ctx?.state !== 'running' || !buffer || !this.master || this.muted) return
    if (this.voice) {
      this.voice.stop()
      this.voice.disconnect()
    }

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = AUDIO.voiceVolume
    source.buffer = buffer
    source.connect(gain).connect(this.master)
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      if (this.voice === source) {
        this.voice = undefined
        this.setMusicVolume(AUDIO.musicVolume, .20)
      }
    }
    // Keep cleanup for a replaced clip without restoring music during the new clip.
    this.voice = source
    this.setMusicVolume(AUDIO.duckVolume, .025)
    source.start()
  }
}
