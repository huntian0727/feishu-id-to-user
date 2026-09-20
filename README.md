# 飞书多维表格 ID 转人员

这是一个飞书多维表格边栏插件，用于把文本字段中的飞书 `user_id` 写入真正的人员字段。插件使用 Base JS SDK 读取当前表格，并通过企业自建应用 OAuth 以当前用户身份调用 Base OpenAPI。

## 技术架构

- 前端：React、TypeScript、Vite、`@lark-base-open/js-sdk`
- 服务端：Node.js、Express
- 授权：飞书用户 OAuth，包含 PKCE 与 state 校验
- 写入接口：Base `batch_update`，指定 `user_id_type=user_id`

App Secret、`user_access_token` 和 `refresh_token` 只存在服务端。浏览器只持有随机会话 ID。

## 飞书应用配置

在飞书开发者后台为企业自建应用完成以下配置：

1. 在“安全设置”添加重定向 URL：

   `http://localhost:3001/api/auth/callback`

2. 在“权限管理”开通：

   - `base:record:update`（更新记录）
   - `offline_access`（离线访问）

3. 在安全设置中开启刷新 `user_access_token`（如果后台显示该开关）。
4. 创建并发布一个应用版本。
5. 确保测试用户位于应用可用范围内。

权限或安全设置修改后，需要重新发布应用版本才能生效。

## 本地开发

复制 `.env.example` 为 `.env.local`，填写企业自建应用凭证。`.env.local` 已被 Git 忽略，禁止提交。

```bash
npm install
npm run dev
```

为避免 OAuth 内存会话在转换过程中因文件监听误重启，默认开发命令不会自动重启服务端。修改 `server/` 后请重启 `npm run dev`；仅在不执行转换时可单独使用 `npm run dev:server:watch`。

启动后：

- 插件地址：`http://localhost:5173/`
- OAuth 回调：`http://localhost:3001/api/auth/callback`

在测试 Base 的“自定义插件”中添加插件地址。首次打开点击“授权并登录”，之后即可转换。

本地 OAuth 会话保存在服务端内存中。重启服务后需要重新授权，生产环境应改为数据库或加密会话存储。

## 使用方式

1. 完成飞书授权。
2. 选择保存 User ID 的文本字段。
3. 选择已有人员字段，或新建一个人员字段。
4. 选择当前视图或全部记录。
5. 点击“开始转换”，核对成功、跳过和失败记录。

支持字母、数字、下划线和连字符组成的 User ID，以及逗号、中文逗号、换行和 JSON 风格的多值内容。

## 构建与生产部署

```bash
npm run build
```

前端产物位于 `dist/`。生产环境还必须部署 `server/index.mjs`，不能只部署静态文件。

生产配置要求：

- 使用 HTTPS
- App Secret 通过服务端环境变量注入
- 将 `/api/` 反向代理到 Node.js 服务
- 将正式 OAuth 回调地址添加至飞书应用安全设置
- 使用数据库或加密存储保存 OAuth 会话与刷新令牌
- 限制请求体大小并记录必要的安全审计日志

## 已知限制

- 本地开发服务重启后 OAuth 会话失效。
- 应用必须已发布，且用户位于应用可用范围内。
- 用户必须同时拥有目标 Base 的编辑权限。
- 当前只处理 `user_id`，不处理手机号、邮箱或姓名反查。

## V2 后续规划

- 持久化 OAuth 会话
- `open_id`、`union_id`、邮箱和手机号转人员
- 失败记录重新转换
- 批量反向转换
