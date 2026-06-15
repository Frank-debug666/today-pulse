# 今日脉冲

每日自动更新的中文科技资讯网页，部署于 Vercel。

## 自动更新

GitHub Actions 每小时检查一次；当天成功生成后，后续检查会自动跳过：

1. 获取近一周快速增长的 GitHub 项目。
2. 从 GNews 获取中文科技新闻。
3. 使用火山方舟完成新闻与项目简介的中文改写，并生成每日科技词汇和 AI 面试题。
4. 更新 `public/daily.json` 并提交到 `main`。
5. Vercel 检测到提交后自动重新部署。

也可以进入仓库的 **Actions → Daily technology briefing → Run workflow** 手动更新。

## GitHub Actions Secrets

在仓库 **Settings → Secrets and variables → Actions** 中配置：

| Secret | 必需 | 用途 |
| --- | --- | --- |
| `GNEWS_API_KEY` | 推荐 | 获取每日中文科技新闻 |
| `ARK_API_KEY` | 推荐 | 火山方舟 API Key，也兼容 `AI_API_KEY` |
| `ARK_MODEL_ID` | 推荐 | 火山方舟推理接入点 ID 或模型 ID |

火山方舟配置也兼容 `AI_API`、`ARK_ENDPOINT_ID` 和自定义 `ARK_BASE_URL`。

缺少新闻或 AI 配置时，更新任务会使用备用新闻源和按日期轮换的学习题库，不会导致网站无法部署或内容长期不变。

## 本地开发

```bash
npm install
npm run dev
```

手动生成每日数据：

```bash
npm run update:daily
```
