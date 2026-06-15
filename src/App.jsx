import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bell,
  Bookmark,
  BookmarkCheck,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Github,
  Headphones,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Sun,
  TrendingUp,
  Volume2,
  X,
} from "lucide-react";

const fallbackNews = [
  { id: "n1", category: "AI", time: "2 小时前", title: "OpenAI 发布新一代推理模型，进一步提升复杂任务规划能力", summary: "模型竞争正在从回答质量转向工具调用、长期任务与可靠交付。", accent: "red" },
  { id: "n2", category: "芯片", time: "4 小时前", title: "苹果开发者大会聚焦端侧 AI 与系统级智能体验", summary: "设备端推理成为隐私、延迟和产品体验的新战场。", accent: "orange" },
  { id: "n3", category: "开发者", time: "5 小时前", title: "微软持续扩展 AI 开发工具链与 Agent 工作流", summary: "开发工具开始围绕任务结果而非单次代码补全组织。", accent: "blue" },
  { id: "n4", category: "安全", time: "7 小时前", title: "企业开始重新审视 AI 应用中的权限与审计边界", summary: "可解释、可追踪与人工兜底逐渐成为上线标准。", accent: "black" },
  { id: "n5", category: "开源", time: "9 小时前", title: "开源小模型热度上升，端侧部署成本持续下降", summary: "更小、更专用的模型正在进入真实生产环境。", accent: "green" },
];

const fallbackRepos = [
  { rank: "01", name: "microsoft / markitdown", summary: "将文件转换为 Markdown，支持多种格式", language: "Python", stars: "28.4k", growth: "+1.2k", url: "https://github.com/microsoft/markitdown" },
  { rank: "02", name: "vercel / ai", summary: "构建 AI 应用的 TypeScript SDK 和工具包", language: "TypeScript", stars: "18.7k", growth: "+980", url: "https://github.com/vercel/ai" },
  { rank: "03", name: "anthropics / claude-code", summary: "Claude 的本地命令行开发代理", language: "TypeScript", stars: "15.2k", growth: "+745", url: "https://github.com/anthropics/claude-code" },
  { rank: "04", name: "grafana / k6", summary: "高性能开源负载测试工具", language: "Go", stars: "12.3k", growth: "+320", url: "https://github.com/grafana/k6" },
  { rank: "05", name: "open-webui / open-webui", summary: "可扩展的开源 AI 聊天界面", language: "Python", stars: "10.8k", growth: "+210", url: "https://github.com/open-webui/open-webui" },
];

const topics = [
  ["AI 大模型", "98 条更新", "topic-ai", "artificial intelligence"],
  ["芯片与硬件", "64 条更新", "topic-chip", "semiconductor chips"],
  ["云计算", "45 条更新", "topic-cloud", "cloud computing"],
  ["开发者工具", "72 条更新", "topic-dev", "developer tools"],
  ["网络安全", "38 条更新", "topic-security", "cybersecurity"],
  ["产品与设计", "26 条更新", "topic-design", "product design technology"],
];

const quickTools = [
  ["Hugging Face", "Trending", "+12", "blue", "https://huggingface.co/models?sort=trending"],
  ["ArXiv CS", "计算机科学最新论文", "+86", "red", "https://arxiv.org/list/cs/new"],
  ["NPM Trending", "今日热门 npm 包", "+24", "orange", "https://www.npmjs.com/"],
  ["Vercel", "Deployments", "正常", "green", "https://vercel.com/dashboard"],
  ["OpenAI", "Status", "正常", "green", "https://status.openai.com/"],
];

function clean(value, fallback = "") {
  if (!value || /[锟斤拷鈥藞瑟]/.test(String(value))) return fallback;
  return value;
}

function IconButton({ label, children, active, onClick }) {
  return <button className={`icon-btn ${active ? "active" : ""}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function SectionTitle({ icon, children, action, onAction, actionHref }) {
  return (
    <div className="section-title">
      <span>{icon}{children}</span>
      {action && actionHref ? <a href={actionHref} target="_blank" rel="noreferrer">{action}<ArrowRight size={14} /></a> : null}
      {action && !actionHref ? <button type="button" onClick={onAction}>{action}<ArrowRight size={14} /></button> : null}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const [answerOpen, setAnswerOpen] = useState(true);
  const [saved, setSaved] = useState(new Set());
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [wordHistoryOpen, setWordHistoryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState("");
  const searchRef = useRef(null);

  const loadDaily = async (live = false) => {
    setRefreshing(true);
    setRefreshNotice("");
    try {
      if (live) {
        const liveResponse = await fetch(`/api/live?ts=${Date.now()}`, { cache: "no-store" });
        if (!liveResponse.ok) throw new Error((await liveResponse.json()).error || "实时更新失败");
        const liveData = await liveResponse.json();
        setData((current) => ({
          ...current,
          generatedAt: liveData.generatedAt,
          ...(liveData.globalNews?.length ? { globalNews: liveData.globalNews } : {}),
          ...(liveData.githubRepos?.length ? { githubRepos: liveData.githubRepos } : {}),
        }));
        setRefreshNotice(liveData.warnings?.length ? `部分更新成功：${liveData.warnings.join("；")}` : "实时新闻与 GitHub 热点已更新");
      } else {
        const response = await fetch(`/daily.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("每日数据读取失败");
        setData(await response.json());
      }
    } catch (error) {
      setRefreshNotice(error.message || "更新失败，请稍后重试");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDaily();
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const news = data?.globalNews?.length ? data.globalNews : fallbackNews;
  const repos = data?.githubRepos?.length ? data.githubRepos : fallbackRepos;
  const filteredNews = useMemo(() => news.filter((item) => {
    const text = `${item.title} ${item.summary} ${item.category}`.toLowerCase();
    const aliases = {
      AI: ["ai", "人工智能"],
      开发者: ["开发者", "编程", "开源"],
      云计算: ["云计算", "cloud"],
      芯片: ["芯片", "半导体", "chip"],
      产品: ["产品", "product"],
      安全: ["安全", "security"],
    };
    const matchesFilter = filter === "全部" || (aliases[filter] || [filter]).some((keyword) => text.includes(keyword.toLowerCase()));
    return matchesFilter && text.includes(query.toLowerCase());
  }), [news, query, filter]);

  const toggleSave = (id) => setSaved((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const visibleNews = filteredNews.length ? filteredNews : filter === "全部" && !query ? fallbackNews : [];
  const heroItems = visibleNews.length ? visibleNews : fallbackNews;
  const hero = heroItems[heroIndex % heroItems.length];
  const word = data?.word || {};
  const interview = data?.interview || {};
  const dateLabel = clean(data?.dateLabel, "2026年6月14日 · 星期日");

  return (
    <div className={dark ? "app dark" : "app"}>
      <header className="topbar">
        <button className="mobile-menu" aria-label={menuOpen ? "关闭导航" : "打开导航"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        <a className="brand" href="#top" aria-label="今日脉冲首页">
          <span><TrendingUp /></span><strong>今日脉冲<small>科技资讯 · 每日必读</small></strong>
        </a>
        <label className="search">
          <Search size={17} /><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索新闻、项目、技术、工具..." /><kbd>⌘K</kbd>
        </label>
        <nav className={menuOpen ? "open" : ""}>
          {["全部", "AI", "开发者", "云计算", "芯片", "产品", "安全"].map((item) => (
            <button key={item} className={filter === item ? "active" : ""} onClick={() => { setFilter(item); setMenuOpen(false); }}>{item}</button>
          ))}
          <button onClick={() => setMoreOpen(!moreOpen)}>更多<ChevronDown size={13} /></button>
        </nav>
        {moreOpen ? <div className="more-menu">
          <a href="https://github.com/trending" target="_blank" rel="noreferrer">GitHub Trending</a>
          <a href="https://arxiv.org/list/cs.AI/recent" target="_blank" rel="noreferrer">AI 最新论文</a>
          <a href="https://news.ycombinator.com/" target="_blank" rel="noreferrer">Hacker News</a>
        </div> : null}
        <div className="date-status">
          <strong>{dateLabel}</strong><span><Circle fill="currentColor" size={8} />自动更新 · {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }) : "08:32"}</span>
        </div>
        <div className="top-actions">
          <IconButton label="实时刷新" onClick={() => loadDaily(true)}><RefreshCw className={refreshing ? "spin" : ""} /></IconButton>
          <IconButton label="切换主题" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</IconButton>
          <IconButton label="通知" active={notificationOpen} onClick={() => setNotificationOpen(!notificationOpen)}><Bell /></IconButton>
        </div>
        {notificationOpen ? <div className="notification-panel"><strong>更新通知</strong><p>今日简报已于 {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }) : "08:32"} 更新完成。</p><button onClick={() => setNotificationOpen(false)}>知道了</button></div> : null}
        {refreshNotice ? <button className="refresh-notice" type="button" onClick={() => setRefreshNotice("")}>{refreshNotice}<X size={13} /></button> : null}
      </header>

      <main id="top">
        <section className="lead-grid">
          <article className="hero-card">
            <img src="/assets/hero-spacecraft.png" alt="航天器飞越地球云层" />
            <div className="hero-overlay">
              <span>今日焦点</span>
              <h1>{clean(hero.title, "SpaceX 星舰完成关键试飞：下一代航天商业化迎来新节点")}</h1>
              <p>{clean(hero.summary, "从重复使用到更低发射成本，商业航天正在进入新的竞争周期。")}</p>
              <div><small>{clean(hero.category, "全球科技")} · {clean(hero.time, "2 小时前")}</small><b>{String((heroIndex % heroItems.length) + 1).padStart(2, "0")} / {String(heroItems.length).padStart(2, "0")} <button aria-label="上一条头条" onClick={() => setHeroIndex((heroIndex - 1 + heroItems.length) % heroItems.length)}><ChevronLeft size={15} /></button><button aria-label="下一条头条" onClick={() => setHeroIndex((heroIndex + 1) % heroItems.length)}><ChevronRight size={15} /></button></b></div>
            </div>
          </article>

          <section className="hot-list">
            <SectionTitle action={newsExpanded ? "收起" : "查看全部"} onAction={() => setNewsExpanded(!newsExpanded)}>全球科技热点</SectionTitle>
            {visibleNews.slice(0, newsExpanded ? visibleNews.length : 5).map((item, index) => (
              <a key={item.id || index} href={item.url || `https://news.google.com/search?q=${encodeURIComponent(item.title)}`} target="_blank" rel="noreferrer">
                <b className={`rank rank-${index}`}>{index + 1}</b>
                <span><strong>{clean(item.title, fallbackNews[index % fallbackNews.length].title)}</strong><small>{clean(item.category, "科技资讯")} · {clean(item.time, `${index + 2} 小时前`)}</small></span>
                <em><TrendingUp size={12} />{128 - index * 13}</em>
              </a>
            ))}
            {!visibleNews.length ? <div className="no-results">当前分类暂无新闻，请切换分类或清空搜索。</div> : null}
          </section>

          <aside className="learning-stack">
            <section className="word-card">
              <SectionTitle icon={<Sparkles size={16} />} action={wordHistoryOpen ? "关闭历史" : "查看历史"} onAction={() => setWordHistoryOpen(!wordHistoryOpen)}>每日一词（科技）</SectionTitle>
              <h2>{clean(word.term, "Tokenization")}<Volume2 size={17} /></h2>
              <p className="phonetic">{clean(word.phonetic, "/ ˌtəʊkənaɪˈzeɪʃn /")} <span>名词</span></p>
              <strong>定义</strong><p>{clean(word.definition, "将文本、数据或序列拆分为更小单位（token）的过程，以便模型或系统能够处理。")}</p>
              <strong>例句</strong><p>{clean(word.example, "大语言模型在处理文本前，需要先进行 tokenization。")}</p>
              <a href="https://huggingface.co/docs/tokenizers" target="_blank" rel="noreferrer">延伸阅读：Hugging Face Tokenizers <ExternalLink size={12} /></a>
              {wordHistoryOpen ? <div className="word-history"><strong>往期词汇</strong><a href="https://en.wikipedia.org/wiki/Retrieval-augmented_generation" target="_blank" rel="noreferrer">RAG</a><a href="https://en.wikipedia.org/wiki/AI_agent" target="_blank" rel="noreferrer">AI Agent</a><a href="https://en.wikipedia.org/wiki/Inference" target="_blank" rel="noreferrer">Inference</a></div> : null}
            </section>

            <section className="interview-card">
              <SectionTitle icon={<Bot size={17} />}>每日 AI 面试一题 <em>中等</em></SectionTitle>
              <h3>{clean(interview.question, "某机构要搭建 AI 交易场景的实时风险预警系统，核心工程设计要点有哪些？")}</h3>
              <ul>{(interview.points || ["场景需求拆解能力", "低延迟实时系统架构设计", "端侧 AI 推理性能优化"]).map((point) => <li key={point}>{clean(point, "工程能力与可靠性设计")}</li>)}</ul>
              <button className="answer-toggle" onClick={() => setAnswerOpen(!answerOpen)}>{answerOpen ? "收起参考答案" : "查看参考答案"}<ChevronDown /></button>
              {answerOpen && <div className="answer"><strong>参考答案（要点）</strong><ol>{(interview.answer || ["明确延迟阈值、风险判定规则与可解释性要求。", "采用流式计算与特征预计算，缩短数据处理链路。", "量化并压缩模型，在靠近数据源的位置部署。", "增加决策溯源与人工兜底，降低误判风险。"]).map((step) => <li key={step}>{clean(step, "建立可测试、可追踪、可回滚的工程方案。")}</li>)}</ol></div>}
            </section>
          </aside>
        </section>

        <section className="github-section">
          <SectionTitle icon={<Github size={20} />} action="查看 GitHub Trending" actionHref="https://github.com/trending">GitHub 每日热点</SectionTitle>
          <div className="repo-table">
            {repos.slice(0, 5).map((repo, index) => (
              <article key={repo.name}>
                <b>{index + 1}</b><em><ArrowDown size={12} />{clean(repo.growth, `+${1200 - index * 210}`)}</em>
                <span><a href={repo.url} target="_blank" rel="noreferrer">{clean(repo.name, fallbackRepos[index].name)}</a><small>{clean(repo.summary, fallbackRepos[index].summary)}</small></span>
                <i>{clean(repo.language, fallbackRepos[index].language)}</i><label><Star size={13} />{clean(repo.stars, fallbackRepos[index].stars)}</label>
                <IconButton label="收藏" active={saved.has(repo.name)} onClick={() => toggleSave(repo.name)}>{saved.has(repo.name) ? <BookmarkCheck /> : <Bookmark />}</IconButton>
              </article>
            ))}
          </div>
        </section>

        <section className="bottom-grid">
          <div className="topic-section">
            <SectionTitle>今日精选速览</SectionTitle>
            <div className="topic-grid">{topics.map(([title, count, className, term]) => <a className={className} key={title} href={`https://news.google.com/search?q=${encodeURIComponent(term)}`} target="_blank" rel="noreferrer"><strong>{title}</strong><span>{count}</span><ArrowRight /></a>)}</div>
          </div>
          <aside className="tools-panel">
            <SectionTitle icon={<TrendingUp size={17} />} action="查看更多" actionHref="https://www.producthunt.com/">趋势 / 工具速览</SectionTitle>
            <div>{quickTools.map(([title, sub, status, color, url]) => <a href={url} target="_blank" rel="noreferrer" key={title}><span className={color}>{title.slice(0, 1)}</span><strong>{title}<small>{sub}</small></strong><em>{status}</em></a>)}</div>
          </aside>
        </section>
      </main>

      <footer><span>数据来源：gnews · GitHub Trending · arXiv · 更多</span><span>关于今日脉冲　意见反馈</span></footer>
    </div>
  );
}
