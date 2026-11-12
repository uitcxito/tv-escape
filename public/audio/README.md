# 本地音频文件

把 MC Hammer 的《U Can't Touch This》完整原曲放到此目录，文件名用 `music.mp3`、`music.flac`、`music.m4a` 或 `music.wav`，扩展名按原文件格式填写。保留一份即可。按 WASD 开跑后，游戏从这个本地文件循环播放。

角色语音在 `public/voices/` 随游戏提供。如果某个角色语音加载失败，游戏可以播放此目录里的可选备用音效 `hit.mp3`。

放入文件后重新加载页面。生成生产包前需要把文件放在此目录。此目录中的音频文件默认不纳入 Git。
