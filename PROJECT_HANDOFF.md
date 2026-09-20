# 飞书插件项目交接说明

## 1. 文档目的

本文用于向后续 AI 程序员或开发人员交接当前项目。开始开发前请完整阅读本文和 `README.md`，不要仅根据 `dist/` 判断项目架构。

项目目录：

```text
C:\Users\12254\Documents\trae_projects\字段捷径\feishu-id-to-user
```

GitHub 公共仓库：

```text
https://github.com/huntian0727/feishu-id-to-user
```

当前主分支：`main`

当前最新提交：

```text
30048c4 Fix false failures during local conversion
```

## 2. 项目目标

这是一个飞书多维表格边栏插件，用于将文本字段中的飞书 `user_id` 写入真正的人员字段。

用户操作流程：

```text
打开多维表格
→ 打开 ID 转人员插件
→ 完成飞书授权
→ 选择 User ID 文本字段
→ 选择目标人员字段
→ 开始转换
```

目前只处理飞书 `user_id`，不处理手机号、邮箱、姓名反查、部门 ID、`open_id` 或 `union_id`。

## 3. 已验证结论

### 3.1 Base JS SDK 不能直接写入 user_id

`IUserField.setValue()` 的人员对象虽然包含 `id`，但 SDK 没有提供 `user_id_type` 参数，会按 `open_id` 解释该值。

因此以下方式不能满足本项目：

```typescript
await userField.setValue(recordId, [{ id: userId }]);
```

### 3.2 Base OpenAPI 可以写入 user_id

已在真实测试 Base 中验证，调用 Base OpenAPI 并携带：

```text
user_id_type=user_id
```

可以把企业 User ID 正确写入人员字段。

当前使用的接口：

```text
POST /open-apis/bitable/v1/apps/:appToken/tables/:tableId/records/batch_update
```

### 3.3 OAuth 本地流程已验证

企业自建应用 OAuth 已完成本地验证：

- 用户点击“授权并登录”
- 服务端使用 Authorization Code + PKCE 换取用户令牌
- 服务端调用 Base OpenAPI
- 用户必须本身拥有目标 Base 的编辑权限
- User ID 能正确显示为人员

### 3.4 飞书静态托管不能运行当前后端

飞书插件平台只部署 `dist/` 静态文件，不会运行：

```text
server/index.mjs
```

当前线上版本点击授权会请求：

```text
/api/auth/start
```

飞书静态对象存储会将它当作文件查找，返回：

```json
{
  "Code": "NoSuchKey",
  "Key": "api/auth/start"
}
```

这不是 OAuth 配置错误，而是生产环境没有部署 API 服务。

## 4. 当前技术架构

### 4.1 前端

- React 18
- TypeScript
- Vite
- `@lark-base-open/js-sdk`
- 飞书 Base 边栏插件

### 4.2 当前本地后端

- Node.js
- Express
- OAuth PKCE + state
- OAuth Token 自动刷新
- Base OpenAPI 批量写入

### 4.3 本地开发请求链路

```text
飞书插件 iframe
→ http://localhost:5173
→ Vite /api 代理
→ http://localhost:3001
→ 飞书 OAuth / Base OpenAPI
```

执行：

```bash
npm install
npm run dev
```

本地地址：

```text
前端：http://localhost:5173/
后端：http://localhost:3001/
回调：http://localhost:3001/api/auth/callback
```

## 5. 当前功能

- 自动读取当前 Base 和当前数据表
- 只列出文本来源字段
- 只列出人员目标字段
- 支持创建新的多人人员字段
- 支持当前视图和全部记录
- 支持超过 200 条记录分页读取
- 支持最多 50 条一批写入
- 支持单个或多个 User ID
- 支持逗号、中文逗号、换行、JSON 风格和混合文本
- User ID 自动去重
- 支持跳过已有人员
- 显示转换进度与成功、跳过、失败统计
- 支持复制失败记录
- 转换前检查数据表是否切换
- OAuth 登录、状态检查和令牌刷新

User ID 当前允许字符：

```text
字母、数字、下划线、连字符
```

## 6. 关键代码入口

```text
src/App.tsx
```

插件主界面、OAuth 状态、字段刷新和转换状态。

```text
src/services/authService.ts
```

前端 OAuth 弹窗、授权消息、会话 ID 和授权状态。

```text
src/services/bitableService.ts
```

读取字段、分页读取记录、解析 User ID、批量写入和统计。

```text
src/utils/openIdParser.ts
```

历史命名未更新，实际负责解析 User ID。后续建议重命名为 `userIdParser.ts`。

```text
server/index.mjs
```

当前本地 OAuth 和 Base API 代理。该文件只适合本地 PoC，不是最终生产后端。

```text
vite.config.js
```

使用 `base: "./"` 保证 `dist/index.html` 引用相对资源；开发环境将 `/api` 代理到本地后端。

## 7. 构建与发布要求

执行：

```bash
npm run build
```

必须满足：

- `dist/index.html` 位于 `dist/` 根目录
- JS/CSS 使用 `./assets/...` 相对路径
- 每次构建只保留最新哈希产物
- GitHub 仓库保持 Public，或邀请 `bitable-open@bytedance.com`
- `.env.local`、App Secret、Access Token 和 Refresh Token 绝不能提交

Vite 默认会清理旧 `dist/`，构建后仍应检查：

```bash
git ls-files dist
```

## 8. 已修复问题

### 8.1 空人员字段导致 length 异常

空人员字段可能返回 `null`，不能直接读取 `.length`。

### 8.2 User ID 正则过窄

旧正则只允许部分十六进制字符，导致包含 `g-z` 的 User ID 被跳过。现已支持完整字母、数字、下划线和连字符。

### 8.3 写入成功但前端显示失败

本地后端曾使用：

```text
node --watch server/index.mjs
```

Node 错误监听到 `node_modules` 变化，在写入完成后重启，导致浏览器收到 `ECONNRESET/500`，但 Base 已实际写入。

默认开发命令现已改为稳定运行：

```text
node server/index.mjs
```

## 9. 当前限制与生产阻塞项

当前版本不能直接作为完整生产版本，原因如下：

1. 飞书只部署静态 `dist/`，没有生产 API 服务。
2. 前端 API 地址仍是相对路径 `/api`。
3. 前端 OAuth 消息来源仍包含本地地址假设。
4. OAuth 会话和令牌只存于 Node 进程内存。
5. 服务重启后所有用户必须重新授权。
6. 当前 Express 服务未配置生产 CORS allowlist。
7. 尚未配置生产 HTTPS OAuth 回调地址。
8. 此前 App Secret 曾出现在对话中，生产部署前必须重置。

## 10. 后续目标架构

在飞书妙搭创建一个可被多个插件复用的 Full Stack 应用，建议名称：

```text
飞书插件统一服务
```

目标结构：

```text
ID 转人员插件 ──┐
未来插件 A ─────┼→ 妙搭统一服务 → 飞书 OAuth / OpenAPI
未来插件 B ─────┘
```

不要为每个插件单独创建后端，也不要实现可任意转发飞书 OpenAPI 的通用代理。

## 11. 妙搭统一服务建议设计

### 11.1 应用类型

必须使用：

```text
full_stack
```

纯前端或 HTML 类型无法安全保存 App Secret、Refresh Token，也无法提供受控后端接口。

### 11.2 API 路由

建议提供版本化接口：

```text
GET  /api/v1/oauth/start?plugin=id-to-user
GET  /api/v1/oauth/callback
GET  /api/v1/session/status
POST /api/v1/session/logout

POST /api/v1/plugins/id-to-user/batch-update
```

未来插件使用独立业务路由：

```text
POST /api/v1/plugins/<plugin-key>/<action>
```

### 11.3 数据模型

建议至少包含：

#### plugin_clients

- `plugin_key`
- `name`
- `enabled`
- `allowed_origins`
- `allowed_actions`
- `created_at`
- `updated_at`

#### oauth_sessions

- `session_id_hash`
- `user_open_id` 或稳定用户标识
- 加密后的 `access_token`
- 加密后的 `refresh_token`
- `access_token_expires_at`
- `refresh_token_expires_at`
- `revoked_at`
- `created_at`
- `updated_at`

#### audit_logs

- `plugin_key`
- `user_id`
- `action`
- `base_token_masked`
- `table_id_masked`
- `record_count`
- `result`
- `error_code`
- `created_at`

禁止在日志中记录完整 Token、App Secret 或完整人员数据。

### 11.4 安全要求

- App Secret 仅存放于妙搭线上环境变量
- Token 必须服务端加密存储
- OAuth 必须校验 `state`
- 保留 PKCE
- CORS 必须按插件来源域名 allowlist
- 每个插件只能调用明确开放的业务接口
- 不允许客户端指定任意飞书 API URL
- 限制请求体大小、批次数量和调用频率
- 校验 `plugin_key`、来源域名和允许操作
- 错误响应不得包含 Token 或内部堆栈
- 记录必要的安全审计日志

### 11.5 多插件授权复用

同一个企业自建应用可以服务多个内部插件。OAuth 授权属于“用户 + 企业应用”，不是某一张 Base。

新插件如果只使用已有权限，可以复用已有授权；新增飞书权限时，需要管理员批准新权限，并可能要求用户重新授权。

为了跨多个插件复用登录，建议使用统一 OAuth 弹窗：

```text
插件
→ 打开妙搭统一登录页
→ 妙搭检查自身登录会话
→ 返回短期插件会话凭证
```

不要依赖第三方 iframe Cookie。现代浏览器可能阻止跨站 Cookie，建议通过顶层弹窗完成登录，再用严格校验来源的 `postMessage` 返回短期、受限会话凭证。

## 12. 建议实施顺序

### 阶段 1：安全处理

1. 在飞书开发者后台重置已暴露的 App Secret。
2. 不要把新 Secret 写入仓库或聊天记录。
3. 确认企业自建应用权限和可用范围。

### 阶段 2：创建妙搭统一服务

1. 创建妙搭 `full_stack` 应用。
2. 使用本地开发方式初始化妙搭项目。
3. 完整阅读妙搭生成项目中的 `.agents/skills/` 指引。
4. 确认妙搭后端 API、数据库和环境变量的实际框架。
5. 不要直接假设 Express 可以原样运行。

### 阶段 3：迁移 OAuth

1. 将 `server/index.mjs` 的 OAuth 逻辑迁移到妙搭后端 handler。
2. 将 OAuth state、会话和 Refresh Token 改为持久化存储。
3. 实现自动刷新和授权撤销处理。
4. 配置线上 App ID、App Secret 和正式回调 URL。

### 阶段 4：迁移 ID 转人员接口

1. 实现 `id-to-user/batch-update`。
2. 固定使用 `user_id_type=user_id`。
3. 限制单次最多 50 条。
4. 校验用户 OAuth 会话。
5. 禁止构造成任意 OpenAPI 代理。

### 阶段 5：修改插件前端

1. 增加生产环境变量 `VITE_API_BASE_URL`。
2. 本地环境仍使用 `/api` Vite 代理。
3. 生产环境请求妙搭 HTTPS 域名。
4. 动态校验 OAuth `postMessage` 来源，不再硬编码 localhost。
5. 处理会话过期、刷新失败和重新授权。

### 阶段 6：生产联调

1. 发布妙搭服务并获取正式 HTTPS 地址。
2. 在飞书开发者后台添加正式 OAuth 回调 URL。
3. 配置插件正式来源域名到 CORS allowlist。
4. 使用测试 Base 完成 OAuth、写入、刷新和重新登录测试。
5. 测试服务重启后会话仍有效。
6. 测试无权限 Base、失效 Token、非法来源和超限请求。

### 阶段 7：重新发布插件

1. 执行 `npm run build`。
2. 验证 `dist/index.html` 和相对资源路径。
3. 清理旧构建产物。
4. 更新 README 和本文档。
5. 提交并推送 GitHub。
6. 重新向飞书提交最新 `dist/`。

## 13. 生产验收标准

- 飞书托管插件点击授权不再出现 `NoSuchKey`
- OAuth 回调使用妙搭 HTTPS 地址
- 用户首次授权后可完成转换
- 刷新插件不要求立即重新授权
- 切换到用户有权限的其他 Base 不需要重新授权
- 妙搭服务重启后 OAuth 会话仍可恢复
- Access Token 到期后能自动刷新
- 用户无 Base 权限时明确提示
- 非 allowlist 来源不能调用 API
- App Secret 和 Token 不出现在前端、GitHub或日志
- Base 写入成功时统计正确
- 网络异常时不会把已成功写入长期误报为失败

## 14. 给后续 AI 程序员的约束

1. 先解决生产后端，不要继续只修改静态 `dist/`。
2. 以妙搭生成项目的实际 Skill、类型和框架为准。
3. 不要把当前 Express 文件机械复制到妙搭。
4. 不要在前端加入 App Secret。
5. 不要提交 `.env.local`。
6. 不要实现任意 OpenAPI 转发代理。
7. 不要删除或覆盖用户未提交的本地改动。
8. 每次修改后运行 TypeScript 检查和生产构建。
9. 每次构建确认 `dist/` 只保留最新资源。
10. 未完成妙搭线上联调前，不得宣称插件已经可生产发布。

## 15. 2026-09-20 接手进展

已创建妙搭 `full_stack` 应用：

```text
名称：飞书插件统一服务
App ID：app_17eg9rvtkzk
本地目录：C:\Users\12254\Documents\trae_projects\字段捷径\feishu-plugin-unified-service
工作分支：sprint/default
```

已在妙搭开发库建立：

- `plugin_client`
- `oauth_pending_authorization`
- `oauth_session`
- `audit_log`

本地后端已实现 OAuth PKCE、加密持久会话、Token 刷新、来源/动作白名单、CORS、批量写入、限流和审计日志。原插件已改为通过 `VITE_API_BASE_URL` 调用统一服务。

已通过的本地检查：

- 统一服务 TypeScript 检查
- 统一服务 ESLint
- NestJS 服务端构建
- React 客户端构建
- 插件生产构建
- 健康检查、合法/非法 CORS、请求校验和 OAuth 302 启动链路

当前仍未部署。正式联调前需要：

1. 重置此前暴露的飞书 App Secret。
2. 使用测试 Base 完成真实记录写入测试。
3. 通过缩短本地 Access Token 有效期或等待到期，完成自动刷新测试。
4. 测试通过后再提交、推送并创建妙搭 Release。

## 16. 2026-09-20 真实 OAuth 联调结果

本地回调地址已加入飞书开发者后台：

```text
http://localhost:8080/app/app_17eg9rvtkzk/api/v1/oauth/callback
```

真实用户授权、授权码交换和开发库持久化均已通过。最新会话检查结果：

- 操作者 `open_id` 已绑定
- Access Token 与 Refresh Token 均以 AES-256-GCM 密文保存
- Access Token 与 Refresh Token 有效期均已正确落库
- OAuth state + PKCE 校验成功
- 授权完成后没有遗留未过期的 pending state

真实联调中修复了两个问题：

1. 飞书 OAuth v2 Token 响应不返回 `open_id`，现改为在换取 Token 后调用官方 `GET /open-apis/authen/v1/user_info` 获取操作者 `open_id`。
2. Refresh Token 有效期的官方字段是 `refresh_token_expires_in`，已替换原错误字段名。

修复后重新通过：统一服务前后端 TypeScript 检查、ESLint、NestJS 构建、妙搭 React 构建、插件生产构建。插件 Vite 配置已区分开发与生产 base path：开发入口为 `http://localhost:5173/`，生产构建继续使用相对资源路径。当前本地服务入口为 `http://localhost:8080/app/app_17eg9rvtkzk`。

尚未完成的本地验收项是：在真实多维表格内打开自定义插件并执行一次测试记录转换，以及验证 Access Token 到期后的自动刷新。未完成这些测试前仍不得部署。

## 17. 2026-09-20 首次真实转换问题与修复

真实 Base 首次执行共 107 条，结果为成功 0、失败 107。服务端日志确认所有请求均在本地 DTO 校验阶段被拒绝，原因是插件把仅供界面显示的 `rawValue` 一并放入了写入请求，而后端按安全策略禁止未知字段。因此这些失败请求没有到达飞书 OpenAPI，也没有修改任何记录，可以安全重试。

已完成修复：

1. 插件发送批次时只序列化 `recordId` 与 `userIds`，不再传递 `rawValue`。
2. 插件可以解析后端校验详情，失败提示不再只显示笼统的 `Bad Request Exception`。
3. 统一服务现在会透传飞书批量更新接口返回的具体错误码与错误消息，便于后续定位权限、字段类型或记录数据问题。

验证结果：

- 带 `rawValue` 的测试请求仍按预期被 DTO 拒绝。
- 清理后的测试请求已通过 DTO 并进入鉴权层。
- 统一服务 TypeScript 检查、ESLint、NestJS 构建均通过。
- 插件生产构建通过。

下一步：刷新或重新打开本地插件，在同一测试 Base 中重新执行转换；确认真实写入与统计正确后，再进行 Token 自动刷新测试。仍未部署到妙搭云端。

## 18. 2026-09-20 Token 刷新与重启恢复验收

真实转换修复后，用户在同一测试 Base 中完成 107 条记录转换，三批写入均成功（50 + 50 + 7）。随后完成以下本地验收：

1. 将一条具有 Refresh Token 的本地 OAuth 会话的 Access Token 有效期临时调整为已过期。
2. 通过本地 `session/status` 接口触发真实自动刷新，接口返回 200；数据库中的 Access Token 密文指纹发生变化，有效期重新延长，Refresh Token 有效期同步更新，会话未撤销。
3. 完整停止并重新启动 NestJS 后端后，使用同一会话再次调用 `session/status`，仍返回 200，证明数据库持久化会话可跨进程重启恢复。
4. 重启后使用虚拟 Base、表和记录标识发送一条无真实写入风险的批量请求。请求通过本地鉴权并到达飞书 Base OpenAPI，飞书返回预期的资源不存在错误 `FEISHU_91402 / NOTEXIST`。因此审计日志中最新一条 `failed` 记录属于验收探针，不是实际业务故障。

至此，本地核心链路已经覆盖：真实 OAuth、加密会话持久化、真实 107 条批量写入、Access Token 自动刷新、服务重启后会话恢复、重启后飞书 API 调用。仍未部署到妙搭云端。

## 19. 2026-09-20 App Secret 轮换验证

用户已提供轮换后的飞书 App Secret。新值仅写入统一服务本地 `.env.local`，该文件继续被 Git 忽略；密钥值未写入源码、构建产物或本文档。

后端重启加载新配置后，再次将测试会话的 Access Token 标记为过期并触发自动刷新。接口返回 200，Access Token 密文指纹发生变化，有效期重新延长，Refresh Token 有效期同步更新，会话未撤销。这证明轮换后的 App Secret 与当前飞书 App ID 匹配并已被本地服务实际使用。

## 20. 2026-09-20 妙搭 ZIP 导入包

已参考飞书 Wiki《基于导入新建应用》及其子文档《从 ZIP 文件导入》生成源码包：

```text
feishu-plugin-unified-service-miaoda-import-20260920-225423.zip
```

压缩包位于工作区根目录，大小 441137 字节，SHA-256：`4297B8296A52D8312D0D284CCBE53BD4CA7796BE45F5E7466FE09E0A7DB4DD93`。ZIP 中只有一个 `feishu-plugin-unified-service/` 根目录，包含 `package.json`、锁文件、前后端源码、配置、迁移脚本及 `MIAODA_IMPORT.md`。

安全检查确认包内不含 `.env`、`.env.local`、`node_modules`、`dist`、日志、Git 数据或当前 App Secret。打包前已通过前后端 TypeScript 检查、ESLint、Stylelint、NestJS 构建和 React 生产构建。

文档明确说明 ZIP 导入不会迁移环境变量、数据库结构或数据库数据，并主要面向 React 前端项目。因此导入后必须确认妙搭创建的是具备后端和数据库能力的 full-stack 应用；如果只识别为前端应用，不得直接作为统一服务发布。仍未执行云端导入或部署。

## 21. 2026-09-21 妙搭生产部署与前端交付

妙搭统一服务已经部署并完成真实联调，生产入口为：

```text
https://baili-pharm.feishuapp.com/app/app_17egrpsja95
```

已确认：

- 应用运行时访问范围为公开，平台登录要求已关闭；业务接口仍由插件来源、插件 Key 和用户 OAuth 会话保护。
- 标准浏览器 OPTIONS 预检不要求实际携带 `X-Plugin-Key`，合法 Origin 返回 204。
- CORS 回显真实 Origin，并包含 `Vary: Origin`，不会用 `*` 作为业务响应来源。
- 空、`null`、非法协议或带路径的 Origin 被拒绝。
- 普通业务请求仍必须携带正确的 `X-Plugin-Key`。
- 本地插件指向妙搭生产后端后已完成测试，未再出现由预检失败导致的 `Failed to fetch`。

前端生产构建变量：

```text
VITE_API_BASE_URL=https://baili-pharm.feishuapp.com/app/app_17egrpsja95
```

前端属于纯静态托管产物。历史 `server/index.mjs`、Express 依赖和 Replit 配置已从仓库删除；不要把飞书 App Secret 或 Token 放入前端工程。最新源码、已构建 `dist/`、AI 部署任务和部署指南统一维护在 GitHub 仓库，具体步骤见 `AI_DEPLOY.md` 与 `DEPLOYMENT_GUIDE.md`。
