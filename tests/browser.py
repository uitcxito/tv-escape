"""Headless browser acceptance checks. Run against a Vite dev or preview server."""
import array
import io
import json
import math
import os
from pathlib import Path
import re
import wave

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("GAME_URL", "http://127.0.0.1:5173")
ROUTES = json.loads(Path(__file__).with_name("routes.json").read_text(encoding="utf-8-sig"))
# Advance only the browser's animation clock. The page uses its real controls,
# collision code, Canvas rendering, and Web Audio clock. No game state is injected.
CLOCK = """
(() => {
  let frame = 0, queued = [];
  Object.defineProperty(performance, 'now', { value: () => frame * (1000 / 120) });
  window.requestAnimationFrame = cb => (queued.push(cb), queued.length);
  window.stepFrames = n => {
    for (let i = 0; i < n; i += 6) {
      frame += Math.min(6, n - i);
      const run = queued; queued = [];
      run.forEach(fn => fn(performance.now()));
    }
  };
})();
"""

AUDIO_PROBE = """
(() => {
  const Audio = window.AudioContext;
  window.audioProbe = { starts: [], stops: [], effects: 0, spectrum: () => null, deny: true };
  window.AudioContext = class extends Audio {
    get state() { return audioProbe.deny ? 'suspended' : super.state }
    resume() {
      if (audioProbe.deny) return Promise.reject(new DOMException('Test blocked autoplay', 'NotAllowedError'));
      return super.resume();
    }
    createBufferSource() {
      const source = super.createBufferSource();
      const start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...args) => {
        audioProbe.starts.push({ loop: source.loop, time: this.currentTime, duration: source.buffer.duration });
        return start(...args);
      };
      source.stop = (...args) => {
        audioProbe.stops.push({ loop: source.loop, time: this.currentTime });
        return stop(...args);
      };
      return source;
    }
    createOscillator() {
      const tone = super.createOscillator();
      const start = tone.start.bind(tone);
      tone.start = (...args) => { audioProbe.effects++; return start(...args) };
      return tone;
    }
    createGain() {
      const gain = super.createGain(), connect = gain.connect.bind(gain);
      gain.connect = (target, ...args) => {
        if (target === this.destination) {
          const meter = this.createAnalyser();
          meter.fftSize = 2048;
          meter.smoothingTimeConstant = 0;
          connect(meter);
          audioProbe.spectrum = () => {
            const fft = new Float32Array(meter.frequencyBinCount);
            meter.getFloatFrequencyData(fft);
            const at = hz => Math.max(...fft.slice(Math.round(hz / this.sampleRate * meter.fftSize) - 1,
              Math.round(hz / this.sampleRate * meter.fftSize) + 2));
            return [at(440), at(990)];
          };
        }
        return connect(target, ...args);
      };
      return gain;
    }
  };
})();
"""


def wav(frequency, duration):
    """Test signals served through request interception only, never shipped."""
    hz = 44100
    samples = array.array("h", (
        int(math.sin(2 * math.pi * frequency * i / hz) * 8000)
        for i in range(round(hz * duration))
    ))
    data = io.BytesIO()
    with wave.open(data, "wb") as file:
        file.setparams((1, 2, hz, 0, "NONE", "not compressed"))
        file.writeframes(samples.tobytes())
    return data.getvalue()


def open_game(browser, audio=None):
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(CLOCK)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    if audio:
        page.add_init_script(AUDIO_PROBE)
    if audio == "signals":
        signals = {"music": wav(440, .2), "hit": wav(990, 1.4)}
        for track, payload in signals.items():
            page.route(f"**/audio/{track}.mp3",
                       lambda route, _request=None, body=payload: route.fulfill(body=body, content_type="audio/wav"))
    if audio is None:
        page.route("**/audio/music.mp3", lambda route: route.fulfill(status=404, body="missing"))
        page.route("**/audio/hit.mp3", lambda route: route.fulfill(body="corrupt", content_type="audio/mpeg"))
    if audio != "voices":
        page.route("**/voices/*.wav", lambda route: route.fulfill(status=404, body="missing"))
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    frames(page, 1)
    return page, errors


def frames(page, count):
    page.evaluate("n => stepFrames(n)", count)


def drive(page, actions):
    previous = ""
    for keys, ticks in actions:
        for key in previous:
            if key not in keys:
                page.keyboard.up(key.lower())
        for key in keys:
            if key not in previous:
                page.keyboard.down(key.lower())
        frames(page, ticks)
        previous = keys
    for key in previous:
        page.keyboard.up(key.lower())


def stage(page, index):
    expect(page.locator("#level-count")).to_have_text(f"第 {index} / 8 关")


def player_x(page):
    """Read the blue shell of the TV from the rendered map."""
    return page.locator("canvas").evaluate("""c => {
      const bytes = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let total = 0, count = 0;
      for (let p = 0; p < bytes.length; p += 4) {
        if (bytes[p] === 135 && bytes[p+1] === 170 && bytes[p+2] === 255) {
          total += (p / 4) % c.width; count++;
        }
      }
      return total / count;
    }""")


def playthrough(browser):
    page, errors = open_game(browser)
    stage(page, 1)
    expect(page.locator("#hint")).to_have_text("WASD 移动")
    expect(page.locator("#audio-note")).to_have_text("本地音频未加载")
    frames(page, 120)
    expect(page.locator("#hint")).to_have_text("WASD 移动")
    # Pause before the first key preserves the ready state.
    page.keyboard.press("Escape")
    expect(page.get_by_role("heading", name="游戏暂停")).to_be_visible()
    page.get_by_role("button", name="继续游戏").click()
    expect(page.locator("#hint")).to_have_text("WASD 移动")
    page.locator("#feedback").evaluate("""node => {
      window.catches = 0;
      new MutationObserver(() => {
        if (node.textContent.includes('重新出发')) window.catches++;
      }).observe(node, { childList: true, characterData: true, subtree: true });
    }""")
    for i, route in enumerate(ROUTES["stages"], 1):
        stage(page, i)
        roster = page.locator("#roster img")
        expect(roster).to_have_count([1, 1, 2, 3, 4, 5, 7, 9][i - 1])
        page.wait_for_function("Array.from(document.querySelectorAll('#roster img')).every(i => i.naturalWidth > 0)",
                               polling=25)
        if i == 8:
            expect(page.locator("#roster-count")).to_have_text("追捕者 · 9 人")
            expect(page.locator("#roster-speed")).to_have_text("232 单位/秒")
            if os.environ.get("GAME_QA_DIR"):
                page.screenshot(path=str(Path(os.environ["GAME_QA_DIR"]) / "stage-8.png"))
            page.set_viewport_size({"width": 1100, "height": 600})
            assert page.evaluate("document.querySelector('#hud').scrollWidth === document.querySelector('#hud').clientWidth")
            page.set_viewport_size({"width": 1440, "height": 900})
        if i == 1:
            page.keyboard.down("d")
            frames(page, 1)
            expect(page.locator("#hint")).to_have_text("躲开头像，注意反弹")
            frames(page, route[0][1] - 1)
            page.keyboard.up("d")
            drive(page, route[1:3])
            expect(page.locator("#hint")).to_have_text("进入绿门过关")
            drive(page, route[3:])
        else:
            drive(page, route)
        if i == 1:
            expect(page.locator("#hint")).to_contain_text("释放干扰")
        else:
            expect(page.locator("#hint")).to_be_hidden()

    expect(page.get_by_role("heading", name="成功逃出！")).to_be_visible()
    expect(page.locator("#result-description")).to_have_text(re.compile(r"八关全部完成 · 电池 \d+ / 15"))
    assert page.evaluate("window.catches") == 0
    if os.environ.get("GAME_QA_DIR"):
        page.screenshot(path=str(Path(os.environ["GAME_QA_DIR"]) / "win.png"))
    page.get_by_role("button", name="再玩一次").click()
    stage(page, 1)
    expect(page.locator("#hint")).to_have_text("WASD 移动")
    assert not errors, errors
    page.close()
    print("Browser: WASD tutorial, real keyboard playthrough of all eight stages, portraits, win, replay, failed audio")


def pause_and_resize(browser):
    page, errors = open_game(browser)
    page.keyboard.down("d")
    frames(page, 24)
    x = player_x(page)
    assert x > 160
    page.keyboard.press("Escape")
    frames(page, 24)
    assert abs(player_x(page) - x) < 1
    page.keyboard.press("Escape")
    # Repeated keydown for a key that was held through pause cannot start movement.
    page.keyboard.down("d")
    frames(page, 24)
    assert abs(player_x(page) - x) < 1
    page.keyboard.up("d")
    page.keyboard.down("d")
    frames(page, 12)
    assert player_x(page) > x + 20
    # Fire the same event delivered by switching away from the focused window.
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    expect(page.get_by_role("heading", name="游戏暂停")).to_be_visible()
    x = player_x(page)
    page.keyboard.press("Escape")
    frames(page, 18)
    assert abs(player_x(page) - x) < 1
    page.keyboard.up("d")
    page.keyboard.press("m")
    expect(page.get_by_role("button", name="取消静音")).to_have_attribute("aria-pressed", "true")
    page.keyboard.press("m")
    expect(page.get_by_role("button", name="静音")).to_have_attribute("aria-pressed", "false")
    page.set_viewport_size({"width": 850, "height": 600})
    frames(page, 1)
    rect = page.locator("canvas").bounding_box()
    assert rect and abs(rect["width"] / rect["height"] - 2) < .02
    assert page.evaluate("document.documentElement.scrollWidth === innerWidth")
    assert not errors, errors
    page.close()
    print("Browser: pause, resume, blur, held keys cleared, resize, M shortcut")


def sound_and_retries(browser):
    page, errors = open_game(browser, audio="signals")
    page.keyboard.down("s")
    page.keyboard.down("d")
    expect(page.get_by_role("button", name="开启声音")).to_be_visible()
    page.evaluate("audioProbe.deny = false")
    page.get_by_role("button", name="开启声音").click()
    expect(page.get_by_role("button", name="开启声音")).to_be_hidden()
    page.wait_for_function("audioProbe.starts.length === 1 && audioProbe.starts[0].loop", polling=25)
    # Wait past several wraps of the 200ms signal, then measure actual audio samples.
    page.wait_for_function("audioProbe.spectrum()?.[0] > -42", polling=25)
    page.wait_for_timeout(700)
    music = page.evaluate("audioProbe.spectrum()[0]")
    assert music > -42, music
    frames(page, ROUTES["catch"][0][1])
    expect(page.locator("#feedback")).to_contain_text("重新出发 · 1")
    page.wait_for_function("audioProbe.starts.length === 2 && audioProbe.spectrum()?.[1] > -40", polling=25)
    page.wait_for_function(f"audioProbe.spectrum()?.[0] < {music - 8}", polling=25)
    frames(page, ROUTES["catch"][0][1])
    expect(page.locator("#feedback")).to_contain_text("重新出发 · 2")
    assert page.evaluate("audioProbe.starts.filter(s => !s.loop).length") == 2
    assert page.evaluate("audioProbe.stops.filter(s => !s.loop).length") == 1
    stage(page, 1)
    page.keyboard.up("s")
    page.keyboard.up("d")
    page.wait_for_function(f"audioProbe.spectrum()?.[0] > {music - 3} && audioProbe.spectrum()?.[1] < -90", polling=25)
    page.keyboard.press("m")
    page.wait_for_function("audioProbe.spectrum()?.every(x => x < -90)", polling=25)
    page.keyboard.press("m")
    page.wait_for_function("audioProbe.spectrum()?.[0] > -42", polling=25)
    assert not errors, errors
    page.close()
    print("Browser: denied audio activation/retry, repeated catches, loop, duck, voice replacement, restore and mute")


def batteries_and_pulse(browser):
    page, errors = open_game(browser, audio="voices")
    page.evaluate("audioProbe.deny = false")
    page.get_by_role("button", name="开启游戏声音").click()
    pulse = page.get_by_role("button", name="干扰脉冲（空格）")
    expect(pulse).to_have_attribute("aria-disabled", "true")
    drive(page, [("D", 90)])
    expect(page.locator("#power-count")).to_have_text("剩余 2 次")
    expect(page.locator("#feedback")).to_contain_text("电池 +1")
    assert page.evaluate("audioProbe.effects") == 3
    drive(page, [("SD", 96)])
    page.keyboard.press("Space")
    expect(page.locator("#feedback")).to_have_text("干扰命中 1 名 · 快溜！")
    expect(page.locator("#power-count")).to_have_text("剩余 1 次")
    assert page.evaluate("audioProbe.effects") == 5
    page.keyboard.press("Space")
    expect(page.locator("#power-count")).to_have_text("剩余 1 次")
    drive(page, [("D", 72)])
    expect(page.locator("#feedback")).to_contain_text("快溜")
    pulse.click()
    expect(page.locator("#power-count")).to_have_text("剩余 0 次")
    expect(pulse).to_have_attribute("aria-disabled", "true")
    assert page.evaluate("audioProbe.effects") == 7
    assert not errors, errors
    page.close()
    print("Browser: collected a battery, pushed away a chaser with Space, escaped, and used the pulse control")


def character_voices(browser):
    page, errors = open_game(browser, audio="voices")
    page.evaluate("audioProbe.deny = false")
    page.get_by_role("button", name="开启游戏声音").click()
    expect(page.get_by_role("button", name="静音", exact=True)).to_have_attribute("aria-pressed", "false")
    fixtures = [
        (1, "catch", "zhang", "张一鸣：「不要让跳动停下来！」"),
        (3, "ma", "ma", "马云：「996！」"),
        (5, "pony", "pony", "马化腾：「你要不要 Q 币呀？」"),
    ]
    current_stage = 1
    for n, (level, route, actor, caption) in enumerate(fixtures, 1):
        while current_stage < level:
            drive(page, ROUTES["stages"][current_stage - 1])
            current_stage += 1
            stage(page, current_stage)
        drive(page, ROUTES[route])
        expect(page.locator("#feedback")).to_contain_text(caption)
        page.wait_for_function("n => audioProbe.starts.filter(s => !s.loop).length === n", arg=n, polling=25)
        path = Path(__file__).parents[1] / "public" / "voices" / f"{actor}.wav"
        with wave.open(str(path), "rb") as file:
            expected = file.getnframes() / file.getframerate()
        actual = page.evaluate("audioProbe.starts.filter(s => !s.loop).at(-1).duration")
        assert abs(actual - expected) < .002, (actor, actual, expected)
    assert not errors, errors
    page.close()
    print("Browser: each requested collision selects its own packaged voice and matching caption")


if __name__ == "__main__":
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        )
        try:
            playthrough(browser)
            pause_and_resize(browser)
            sound_and_retries(browser)
            batteries_and_pulse(browser)
            character_voices(browser)
        finally:
            browser.close()
