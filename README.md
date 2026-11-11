# 小电视大逃亡 · TV Escape

电脑浏览器里的八关弹射追逐游戏。打开页面就是第一关，第一次按 WASD 开始追逐。躲开弹射的头像，进入绿门；被追上会回到本关起点，复活后有 1 秒闪烁保护。

第 4 关起增加追捕人数和速度。第 7 关是 7 人、345 单位/秒，第 8 关是 9 人、390 单位/秒，小电视的速度为 260 单位/秒。

## 启动

需要 Node.js 20.19+（20.x）或 22.12+。

```powershell
cd D:\Codex\Game1
npm ci
npm run dev
```

打开终端显示的本地地址（默认 `http://127.0.0.1:5173/`）。**WASD** 移动，**Esc** 暂停或继续，**M** 静音或取消静音。切到别的窗口会暂停，回到游戏后可手动继续。

```powershell
npm run build
npm run preview
```

生产文件在 `dist/`，用静态 HTTP 服务即可运行。

## 本地素材

九张真人照片位于 [`public/portraits/`](public/portraits)，[署名页](public/portraits/credits.html)注明出处。游戏从本地加载头像和碰撞配音。

碰撞时，最先接触小电视的角色会触发自己的音效、普通话合成配音和字幕。录音位于 [`public/voices/`](public/voices)，字幕为游戏台词。

背景原曲仍需单独接入。[Audio.com 候选](https://audio.com/josh-hamilton/audio/mc-hammer-u-can-t-touch-this-kc10122018)由 Josh Hamilton 上传，页面未确认游戏使用授权。取得音源后，按 [音频目录说明](public/audio/README.md)放入 `public/audio/music.mp3` 并重新加载页面。生产包需重新构建。

声音在第一次操作后启用。如果浏览器阻止播放，可点地图右下角的“开启声音”。音量和文件路径在 `src/audio.ts`，关卡和台词在 `src/levels.ts`。

## 验证

```powershell
npm test
npm run build
```

单元测试覆盖移动速度、斜板和墙角反弹、滑行、高速防穿透、复活保护，以及八关的出生点、出口和难度配置。

浏览器验收使用 Python Playwright。安装 Playwright 和 Chromium 后，在另一个终端启动开发服务，再运行：

```powershell
python tests/browser.py
```

可用 `GAME_URL` 指定其他地址，用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向已有的 Chromium。脚本使用实际键盘输入走完八关，并检查暂停、失焦、缩放、重复复活和重新开局。配音测试检查三条指定台词是否匹配实际播放文件。混音测试用临时 WAV 信号验证循环、短句替换、背景压低与恢复、静音，以及加载或播放被阻止时的表现。
