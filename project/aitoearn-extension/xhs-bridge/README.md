# AitoBee XHS Bridge Chrome Extension

本扩展用于把 AitoBee 本地后端内置的 XHS Bridge 和用户已登录的小红书 Chrome 页面连接起来。

## 安装

1. 启动 AitoBee 本地后端，确认 `ws://127.0.0.1:9333` 可用。
2. Chrome 打开 `chrome://extensions`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择本目录：`project/aitoearn-extension/xhs-bridge`。
6. 在同一个 Chrome 中登录 `https://www.xiaohongshu.com`。

## 当前能力

- 连接 AitoBee 本地 WebSocket Bridge。
- 接收 AitoBee 发出的 `navigate`、`wait_for_load`、`wait_dom_stable`、`evaluate` 命令。
- 在小红书页面中执行只读数据提取，用于作品详情和评论抓取。

## 注意

- 当前扩展只用于本地开发者模式加载，没有发布到 Chrome Web Store。
- 后端 WebSocket 只监听 `127.0.0.1:9333`，不要暴露到公网。
- 该扩展不会绕过小红书登录；必须使用用户自己已登录的浏览器会话。
