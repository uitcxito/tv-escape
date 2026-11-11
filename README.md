# 小电视大逃亡 · TV Escape

电脑浏览器里的八关弹射追逐游戏。打开页面就是第一关，第一次按 WASD 开始追逐。躲开弹射的头像，进入绿门；被追上会回到本关起点，复活后有 1 秒闪烁保护。

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

三张真人照片位于 [`public/portraits/`](public/portraits)，[署名页](public/portraits/credits.html)注明原图、作者、裁切和许可。游戏运行不需要加载远程头像。

**原曲与指定碰撞短句尚未交付。** [Audio.com 候选](https://audio.com/josh-hamilton/audio/mc-hammer-u-can-t-touch-this-kc10122018)标注 4 分 15 秒、192 kbps，由 Josh Hamilton 上传；[站点条款](https://audio.com/legal/terms-of-use)对内容用途有限制，页面无法证明上传者授权将录音用于本游戏。[101 Soundboards 候选](https://www.101soundboards.com/sounds/4487158-you-cant-touch-this)列出了同名短句及下载选项，[站点条款](https://www.101soundboards.com/pages/terms_and_privacy)说明声音保留原版权。未取得并核实可用于本游戏的两份录音。游戏包默认无声，可正常完成八关。

取得可用于本游戏的音源后，按 [音频目录说明](public/audio/README.md)分别放入 `public/audio/music.mp3` 和 `public/audio/hit.mp3`，重新加载页面即可；生产包需重新构建。声音在第一次操作后启用；如果浏览器阻止播放，可点地图右下角的“开启声音”。音量和文件路径集中在 `src/audio.ts`，关卡在 `src/levels.ts`。

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

可用 `GAME_URL` 指定其他地址，用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指向已有的 Chromium。脚本使用实际键盘输入走完八关，并检查暂停、失焦、缩放、重复复活和重新开局。声音测试使用临时生成的 WAV 信号测量实际 Web Audio 输出，检查循环、短句替换、背景压低与恢复、静音，以及文件损坏或被阻止时的表现。
