# 小电视大逃亡 · TV Escape

电脑浏览器里的八关弹射追逐游戏。打开页面就是第一关，第一次按 WASD 开始追逐。躲开弹射的头像，进入绿门。被追上会回到本关起点，复活后有 1 秒闪烁保护。

遇到追捕者逼近时，按**空格**释放干扰，击退附近的头像，并获得短暂保护。每关至少有一次干扰，第 7、8 关至少有两次。路上的黄色电池可以补充干扰，最多存三次。重试保留已捡的电池，通关时可以看收集数。

第 5 关可以抄中间的近路，第 7 关可以从上下两边绕行。后几关的追捕者会分批出发。第 8 关有 9 人，速度为 232 单位/秒，小电视是 260 单位/秒。

## 启动

需要 Node.js 20.19+（20.x）或 22.12+。

```powershell
cd D:\Codex\Game1
npm ci
npm run dev
```

打开终端显示的本地地址（默认 `http://127.0.0.1:5173/`）。**WASD** 移动，**空格**干扰，**Esc** 暂停或继续，**M** 静音或取消静音。切到别的窗口会暂停，回到游戏后可手动继续。

```powershell
npm run build
npm run preview
```

生产文件在 `dist/`，用静态 HTTP 服务即可运行。

## 本地素材

九张真人照片位于 [`public/portraits/`](public/portraits)，[署名页](public/portraits/credits.html)注明出处。游戏从本地加载头像和碰撞配音。

碰撞时，最先接触小电视的角色会触发自己的音效、普通话合成配音和字幕。录音位于 [`public/voices/`](public/voices)，字幕为游戏台词。

本机已安装 MC Hammer 的完整原曲《U Can't Touch This》，时长 4:17，文件在 `public/audio/music.mp3`。换电脑或重新克隆项目时，按 [音频目录说明](public/audio/README.md)放入本地文件。

第一次按 WASD 或点击顶部的“开启声音”会启用声音。按 WASD 开始追逐后，背景原曲从头循环播放。每次被追上复活，音乐从曲首重新播放，角色配音期间会压低背景音。点“再玩一次”后，下次开跑会重新从曲首播放。如果浏览器阻止播放，可点地图右下角的“开启声音”重试。音量和文件路径在 `src/audio.ts`，关卡和台词在 `src/levels.ts`。

## 验证

```powershell
npm test
npm run build
```

单元测试覆盖移动与碰撞、复活保护、干扰与追捕者待机，以及八关的出生点、出口和电池可达性。

浏览器验收使用 Python Playwright。安装 Playwright 和 Chromium 后，在另一个终端启动开发服务，再运行：

```powershell
python tests/browser.py
```

可用 `GAME_URL` 指定其他地址，用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向已有的 Chromium。脚本只用 WASD 走完八关，并单独测试拾取电池、释放干扰、暂停和重试。配音测试检查三条指定台词是否匹配实际播放文件。混音测试用临时 WAV 信号验证循环、复活后从曲首重播、短句替换、背景压低与恢复、静音，以及加载或播放被阻止时的表现。
