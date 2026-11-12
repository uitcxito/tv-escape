# 游戏音频文件

随项目提供的 `music.mp3` 是 MC Hammer 的《U Can't Touch This》完整专辑版，解码时长 4:17.36。[专辑帖](https://tunnel.ru/post-mc-hammer-1990-please-hammer-dont-hurt-em) · [MP3 来源](https://static.tunnel.ru/media/audio/2026-08/post/199218//02.-u-cant-touch-this.mp3) · [来源站规](https://tunnel.ru/site-rules) · [Apple Music 发行版](https://music.apple.com/us/song/724315201)

重新配置时，把完整原曲放到此目录，文件名用 `music.mp3`、`music.flac`、`music.m4a` 或 `music.wav`，扩展名按原文件格式填写。保留一份即可。按 WASD 开跑后，游戏从本地文件循环播放。被追上时会额外播放专辑版开头 0.50 至 1.31 秒的短句，背景音乐继续播放。使用其他剪辑版本时，可在 `src/audio.ts` 中调整片段时间。

角色语音在 `public/voices/` 随游戏提供。如果某个角色语音加载失败，游戏可以播放此目录里的可选备用音效 `hit.mp3`。

Vite 构建时会把此目录复制到生产包。替换本地音频后，重新加载开发页面或重新构建。
