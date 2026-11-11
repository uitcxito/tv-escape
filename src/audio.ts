const AUDIO = {
  music: 'audio/music.mp3',
  hit: 'audio/hit.mp3',
  musicVolume: .42,
  duckVolume: .10,
  voiceVolume: .95,
} as const

type Track = 'music' | 'hit'
export type Availability = 'loading' | 'ready' | 'missing'

export class Sound {
  muted = false
  blocked = false
  status: Record<Track, Availability> = { music: 'loading', hit: 'loading' }
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

  private async preload() {
    let decoder: OfflineAudioContext
    try { decoder = new OfflineAudioContext(2, 1, 44100) }
    catch {
      this.status = { music: 'missing', hit: 'missing' }
      this.changed()
      return
    }
    await Promise.all((['music', 'hit'] as const).map(async track => {
      try {
        const url = new URL(import.meta.env.BASE_URL + AUDIO[track], document.baseURI)
        const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
        if (!response.ok || response.headers.get('Content-Type')?.includes('text/html')) {
          throw new Error('Audio asset missing')
        }
        const data = await response.arrayBuffer()
        this.buffers[track] = await decoder.decodeAudioData(data)
        this.status[track] = 'ready'
        this.startMusic()
      } catch { this.status[track] = 'missing' }
      this.changed()
    }))
  }

  enable() {
    if (Object.values(this.status).every(s => s === 'missing')) return
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

  caught() {
    const ctx = this.context
    if (ctx?.state !== 'running' || !this.buffers.hit || !this.master || this.muted) return
    if (this.voice) {
      this.voice.stop()
      this.voice.disconnect()
    }

    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = AUDIO.voiceVolume
    source.buffer = this.buffers.hit
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
