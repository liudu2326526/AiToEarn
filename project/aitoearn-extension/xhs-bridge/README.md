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
- 接收 AitoBee 发出的 `navigate`、`wait_for_load`、`wait_dom_stable`、`evaluate`、`post_comment_reply` 命令。
- 在小红书页面中执行只读数据提取，用于作品详情和评论抓取。
- 在用户已登录的小红书页面中按后端任务指令发布公开评论回复。

## 自动回复边界

- `post_comment_reply` 只负责浏览器侧执行，不生成回复内容，也不决定是否允许执行。
- 后端负责线索校验、回复生成、安全拦截、任务状态、审计日志、限流和重试。
- 扩展不会读取或保存小红书 Cookie；请求依赖当前 Chrome 内用户自己的登录会话。
- 扩展可能把失败截图以 `screenshotDataUrl` 临时返回给本地后端，后端上传到对象存储后只保存 URL。
- 如果小红书返回 `406`、`461`、`x-s`、`x-t` 或签名相关错误，不要继续批量执行，需要先切换到 DOM 自动化或复用现有签名通道。

## 手动验证

1. 启动本地后端和 XHS Bridge，确认扩展弹窗显示已连接。
2. 在同一个 Chrome 里登录 `https://www.xiaohongshu.com`。
3. 选择一条包含 `noteId`、`commentId`、`postUrl` 且 `postUrl` 带 `xsec_token` 的测试线索。
4. 从后端触发 `post_comment_reply`，只发送低风险测试文案。
5. 如果返回成功，确认小红书页面中出现回复；如果失败，检查返回的 `message` 和后端上传后的截图 URL。

## 注意

- 当前扩展只用于本地开发者模式加载，没有发布到 Chrome Web Store。
- 后端 WebSocket 只监听 `127.0.0.1:9333`，不要暴露到公网。
- 该扩展不会绕过小红书登录；必须使用用户自己已登录的浏览器会话。
