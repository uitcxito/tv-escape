# 本地音频文件

本机的 `music.mp3` 是 MC Hammer 的《U Can't Touch This》完整专辑版。解码时长 4:17.36，与 Apple Music 的原版试听一致。来源网站允许下载用户分享的内容，限制商业使用。[专辑帖](https://tunnel.ru/post-mc-hammer-1990-please-hammer-dont-hurt-em) · [MP3 下载](https://static.tunnel.ru/media/audio/2026-08/post/199218//02.-u-cant-touch-this.mp3) · [来源站规](https://tunnel.ru/site-rules) · [Apple Music 发行版](https://music.apple.com/us/song/724315201)

重新配置时，把完整原曲放到此目录，文件名用 `music.mp3`、`music.flac`、`music.m4a` 或 `music.wav`，扩展名按原文件格式填写。保留一份即可。按 WASD 开跑后，游戏从本地文件循环播放，每次被追上复活都从曲首重播。

角色语音在 `public/voices/` 随游戏提供。如果某个角色语音加载失败，游戏可以播放此目录里的可选备用音效 `hit.mp3`。

放入文件后重新加载页面。生成生产包前需要把文件放在此目录。此目录中的音频文件默认不纳入 Git。
