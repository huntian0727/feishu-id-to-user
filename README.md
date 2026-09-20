# 飞书多维表格 ID 转人员

这是一个飞书多维表格边栏插件，用于把文本字段中的飞书 `user_id` 写入真正的人员字段。插件使用 Base JS SDK 读取当前表格，并通过企业自建应用 OAuth 以当前用户身份调用 Base OpenAPI。

## 技术架构

- 前端：React、TypeScript、Vite、`@lark-base-open/js-sdk`
- 服务端：妙搭 `full_stack` 应用（NestJS、Postgres）
- 授权：飞书用户 OAuth，包含 PKCE 与 state 校验
- 写入接口：Base `batch_update`，指定 `user_id_type=user_id`

App Secret、`user_access_token` 和 `refresh_token` 只存在服务端。浏览器只持有随机会话 ID。

## 飞书应用配置

在飞书开发者后台为企业自建应用完成以下配置：

1. 在“安全设置”添加重定向 URL：

   `http://localhost:8080/app/app_17eg9rvtkzk/api/v1/oauth/callback`

2. 在“权限管理”开通：

   - `base:record:update`（更新记录）
   - `offline_access`（离线访问）

3. 在安全设置中开启刷新 `user_access_token`（如果后台显示该开关）。
4. 创建并发布一个应用版本。
5. 确保测试用户位于应用可用范围内。

权限或安全设置修改后，需要重新发布应用版本才能生效。

## 本地开发

在 `.env.local` 中配置 `VITE_API_BASE_URL`，指向妙搭统一服务（可使用本地开发地址或当前生产地址）。飞书 App Secret 只配置在统一服务中，不再提供给插件工程。

```bash
npm install
npm run dev:web
```

如果使用妙搭本地开发地址，需要另行启动 `feishu-plugin-unified-service`；如果使用当前生产地址，则只需启动本前端。插件工程不再包含或启动旧 Express PoC。

启动后：

- 插件地址：`http://localhost:5173/`
- 统一服务：`http://localhost:8080/app/app_17eg9rvtkzk`
- OAuth 回调：`http://localhost:8080/app/app_17eg9rvtkzk/api/v1/oauth/callback`

在测试 Base 的“自定义插件”中添加插件地址。首次打开点击“授权并登录”，之后即可转换。

OAuth 会话保存在妙搭开发数据库中，访问令牌和刷新令牌使用 AES-256-GCM 加密存储。

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

前端产物位于 `dist/`。生产环境通过 `VITE_API_BASE_URL` 请求独立部署的妙搭统一服务。

仓库根目录同时提供可直接上传飞书静态托管的成品包：

```text
feishu-id-to-user-feishu-hosting.zip
```

该 ZIP 根目录直接包含 `index.html`、`favicon.svg` 和 `assets/`。校验值见同名 `.sha256` 文件。

当前已验证的妙搭生产后端：

```text
https://baili-pharm.feishuapp.com/app/app_17egrpsja95
```

生产配置要求：

- 使用 HTTPS
- App Secret 通过服务端环境变量注入
- 设置生产构建变量 `VITE_API_BASE_URL` 为妙搭服务的正式 HTTPS 地址
- 将正式 OAuth 回调地址添加至飞书应用安全设置
- 妙搭数据库持久化 OAuth 会话，并加密保存访问令牌和刷新令牌
- 限制请求体大小并记录必要的安全审计日志

## 已知限制

- 应用必须已发布，且用户位于应用可用范围内。
- 用户必须同时拥有目标 Base 的编辑权限。
- 当前只处理 `user_id`，不处理手机号、邮箱或姓名反查。
- 妙搭后端目前允许来自任意合法 HTTP/HTTPS Origin 的已登记插件请求；取得最终飞书托管 Origin 后，建议改为精确白名单。

## V2 后续规划

- 分布式限流和审计检索页面
- `open_id`、`union_id`、邮箱和手机号转人员
- 失败记录重新转换
- 批量反向转换
