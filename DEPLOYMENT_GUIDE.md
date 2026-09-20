# 前端部署指南

本仓库是飞书多维表格“ID 转人员”边栏插件的纯前端工程。生产后端已经部署到妙搭：

```text
https://baili-pharm.feishuapp.com/app/app_17eg9rvtkzk
```

## 1. 环境要求

- Git
- Node.js 18 或 20 LTS
- npm 9 或更高版本
- 可访问 npm 软件源

## 2. 获取和构建

```bash
git clone https://github.com/huntian0727/feishu-id-to-user.git
cd feishu-id-to-user
npm ci
```

创建本地生产配置：

Windows PowerShell：

```powershell
Copy-Item .env.production.example .env.production
```

macOS / Linux：

```bash
cp .env.production.example .env.production
```

确认 `.env.production` 中只有公开的后端地址：

```text
VITE_API_BASE_URL=https://baili-pharm.feishuapp.com/app/app_17eg9rvtkzk
```

执行生产构建：

```bash
npm run build
```

构建产物位于 `dist/`。仓库也提交了已验证的最新 `dist/`，但在修改源码后必须重新构建并提交新的哈希文件。

## 3. 上传到飞书静态托管

可以直接下载仓库根目录的 `feishu-id-to-user-feishu-hosting.zip` 上传。其 SHA-256 校验值记录在 `feishu-id-to-user-feishu-hosting.zip.sha256`。

上传 `dist/` 内的全部内容。托管根目录必须直接包含：

```text
index.html
favicon.svg
assets/
```

如果平台要求 ZIP，请压缩 `dist/` 里面的内容，不要把 `dist` 目录本身再套一层。ZIP 根目录必须直接看到 `index.html`。

## 4. 构建后检查

1. `dist/index.html` 存在。
2. JS/CSS 路径使用 `./assets/...`，不是 `/assets/...`。
3. `dist/assets/` 只包含本次构建的哈希文件。
4. 静态资源中包含正确的妙搭后端地址。
5. 仓库和构建产物不含 `.env.local`、`.env.production`、App Secret、Access Token、Refresh Token、`node_modules/`。

Windows PowerShell 检查后端地址：

```powershell
Get-ChildItem dist -Recurse -File |
  Select-String "baili-pharm.feishuapp.com/app/app_17eg9rvtkzk"
```

## 5. 生产验收

必须在真实飞书多维表格的自定义插件环境中测试：

1. 页面加载正常，无静态资源 404。
2. 点击“授权并登录”能够完成 OAuth。
3. 能读取文本字段和人员字段。
4. 先选择 1～3 条测试记录进行转换。
5. 人员字段写入正确，成功/跳过/失败统计与实际一致。
6. 刷新插件后会话仍然可用。
7. 浏览器控制台没有 CORS、Mixed Content 或 `Failed to fetch`。

## 6. 排障

- 页面白屏或资源 404：检查托管根目录和 `./assets/...` 相对路径。
- `Failed to fetch`：检查对妙搭域名的 OPTIONS 请求；正常应返回 204 并回显插件页面的真实 Origin。
- OAuth 回调失败：检查飞书开发者后台的正式回调地址、权限和已发布应用版本。
- 读不到字段：必须从真实 Base 自定义插件环境打开，普通浏览器页面没有 Base SDK 上下文。

## 7. 安全约束

- 不要在前端加入飞书 App Secret 或 Token。
- 不要恢复已删除的历史 Express PoC 后端。
- 不要把接口改造成可指定任意飞书 OpenAPI URL 的通用代理。
- 修改 `VITE_API_BASE_URL` 后必须重新构建，因为 Vite 会在构建时写入该值。
