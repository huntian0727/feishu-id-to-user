# AI 程序员部署任务

请部署本仓库中的飞书多维表格“ID 转人员”插件前端。

开始前完整阅读：

- `README.md`
- `DEPLOYMENT_GUIDE.md`
- `PROJECT_HANDOFF.md`

目标和约束：

1. 这是纯前端静态项目，生产后端已经运行在 `https://baili-pharm.feishuapp.com/app/app_17egrpsja95`。
2. 使用 Node.js 18 或 20 LTS，执行 `npm ci`。
3. 从 `.env.production.example` 创建不提交的 `.env.production`。
4. 执行 `npm run build`，不得忽略 TypeScript 或 Vite 错误。
5. 确认 `dist/index.html` 使用 `./assets/...` 相对路径。
6. 扫描仓库和 `dist/`，确保不含 App Secret、Access Token、Refresh Token、`.env.local`、`.env.production` 或 `node_modules/`。
7. 将 `dist/` 里面的内容上传到飞书插件静态托管，托管根目录直接包含 `index.html`。
8. 不要创建或启动另一个后端，也不要把任何服务端密钥放进前端。
9. 在真实测试 Base 中完成页面加载、OAuth、字段读取、1～3 条记录转换和刷新后会话恢复测试。

完成后汇报：构建环境、构建结果、上传目录结构、发布版本或地址、OAuth 与小批量转换结果，以及是否出现 CORS、404、Mixed Content 或 `Failed to fetch`。
