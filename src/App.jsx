import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Activity,
  Bell,
  Bookmark,
  BookmarkCheck,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  Eye,
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
import "./author-card.css";

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
  ["Hugging Face", "热门模型榜", "+12", "blue", "https://huggingface.co/models?sort=trending"],
  ["ArXiv CS", "计算机科学最新论文", "+86", "red", "https://arxiv.org/list/cs/new"],
  ["NPM 热门榜", "今日热门软件包", "+24", "orange", "https://www.npmjs.com/"],
  ["Vercel", "部署管理", "正常", "green", "https://vercel.com/dashboard"],
  ["OpenAI", "服务状态", "正常", "green", "https://status.openai.com/"],
];

function clean(value, fallback = "") {
  if (!value || /[锟斤拷鈥藞瑟]/.test(String(value))) return fallback;
  return value;
}

function localizeLanguage(language) {
  return language === "Other" ? "其他" : language;
}

function formatUpdateTime(value) {
  if (!value) return "等待首次更新";
  const date = new Date(value);
  const today = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short" }).format(new Date());
  const target = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short" }).format(date);
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" });
  return `${today === target ? "今天" : target} ${time}`;
}

function IconButton({ label, children, active, onClick }) {
  return <button className={`icon-btn ${active ? "active" : ""}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function SectionTitle({ icon, children, action, onAction, actionHref }) {
  return (
    <div className="section-title">
      <span>{icon}{children}</span>
      {action && actionHref ? <a href={actionHref} target="_blank" rel="noreferrer"><span>{action}</span><ArrowRight size={14} /></a> : null}
      {action && !actionHref ? <button type="button" onClick={onAction}><span>{action}</span><ArrowRight size={14} /></button> : null}
    </div>
  );
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(number);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function repoFullName(repo) {
  const fromUrl = String(repo?.url || "").match(/github\.com\/([^/#?]+\/[^/#?]+)/)?.[1];
  return (fromUrl || String(repo?.name || "")).replace(/\s+/g, "").replace(/^https:\/\/github\.com\//, "");
}

function Sparkline({ values = [], positive = true }) {
  const cleanValues = values.map(Number).filter(Number.isFinite);
  const width = 132;
  const height = 42;
  if (cleanValues.length < 2) return <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" />;
  const min = Math.min(...cleanValues);
  const max = Math.max(...cleanValues);
  const range = max - min || 1;
  const step = width / (cleanValues.length - 1);
  const path = cleanValues.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return <svg className={positive ? "sparkline up" : "sparkline down"} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><path d={path} /></svg>;
}

function GitHubMark({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.82 1.1.82 2.22v3.3c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [market, setMarket] = useState(null);
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
  const [interviewHistoryOpen, setInterviewHistoryOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState("");
  const [visitStats, setVisitStats] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authConfigured, setAuthConfigured] = useState(true);
  const [starLoading, setStarLoading] = useState(new Set());
  const searchRef = useRef(null);

  const loadDaily = async (live = false) => {
    setRefreshing(true);
    setRefreshNotice("");
    try {
      if (live) {
        const liveResponse = await fetch(`/api/live?ts=${Date.now()}`, { cache: "no-store" });
        if (!liveResponse.ok) throw new Error((await liveResponse.json()).error || "实时更新失败");
        const liveData = await liveResponse.json();
        const chineseNews = liveData.globalNews?.filter((item) => /[\u4e00-\u9fff]/.test(item.title || "")) || [];
        const shouldReplaceNews = chineseNews.length >= Math.ceil((liveData.globalNews?.length || 0) / 2);
        setData((current) => ({
          ...current,
          generatedAt: liveData.generatedAt,
          ...(shouldReplaceNews ? { globalNews: liveData.globalNews } : {}),
          ...(liveData.githubRepos?.length ? { githubRepos: liveData.githubRepos } : {}),
        }));
        setRefreshNotice(liveData.warnings?.length
          ? `部分更新成功：${liveData.warnings.join("；")}`
          : shouldReplaceNews ? "实时新闻与 GitHub 热点已更新" : "GitHub 热点已刷新；中文新闻按每日简报更新");
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

  const loadVisits = async () => {
    try {
      const response = await fetch(`/api/visits?ts=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("访问统计读取失败");
      setVisitStats(await response.json());
    } catch {
      setVisitStats({ enabled: false, total: 0, today: 0 });
    }
  };

  const loadMarket = async () => {
    try {
      const response = await fetch(`/market.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("市场数据读取失败");
      setMarket(await response.json());
    } catch {
      setMarket(null);
    }
  };

  const loadAuth = async () => {
    try {
      const response = await fetch(`/api/auth/me?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("auth failed");
      const result = await response.json();
      setAuthConfigured(result.configured !== false);
      setAuthUser(result.authenticated ? result.user : null);
      if (result.favorites?.length) {
        setSaved(new Set(result.favorites.map((item) => item.repo_full_name)));
      }
    } catch {
      setAuthConfigured(false);
      setAuthUser(null);
    }
  };

  const logoutGitHub = async () => {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => null);
    setAuthUser(null);
    setSaved(new Set());
    setRefreshNotice("已退出 GitHub 登录");
  };

  useEffect(() => {
    loadDaily();
    loadVisits();
    loadMarket();
    loadAuth();
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
      人工智能: ["ai", "人工智能"],
      开发者: ["开发者", "编程", "开源"],
      云计算: ["云计算", "cloud"],
      芯片: ["芯片", "半导体", "chip"],
      产品: ["产品", "product"],
      安全: ["安全", "security"],
    };
    const matchesFilter = filter === "全部" || (aliases[filter] || [filter]).some((keyword) => text.includes(keyword.toLowerCase()));
    return matchesFilter && text.includes(query.toLowerCase());
  }), [news, query, filter]);

  const toggleSave = async (repo) => {
    const fullName = repoFullName(repo);
    if (!fullName) return;
    if (!authConfigured) {
      setRefreshNotice("GitHub 登录尚未配置：请先在 Cloudflare 设置 OAuth 环境变量");
      return;
    }
    if (!authUser) {
      window.location.href = "/api/auth/github/login";
      return;
    }

    const nextStar = !saved.has(fullName);
    setStarLoading((current) => new Set(current).add(fullName));
    try {
      const response = await fetch("/api/github/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ repo: fullName, star: nextStar }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "GitHub Star 操作失败");
      setSaved((current) => {
        const next = new Set(current);
        nextStar ? next.add(fullName) : next.delete(fullName);
        return next;
      });
      setRefreshNotice(nextStar ? `已 Star ${fullName}` : `已取消 Star ${fullName}`);
    } catch (error) {
      setRefreshNotice(error.message || "GitHub Star 操作失败");
    } finally {
      setStarLoading((current) => {
        const next = new Set(current);
        next.delete(fullName);
        return next;
      });
    }
  };

  const visibleNews = filteredNews.length ? filteredNews : filter === "全部" && !query ? fallbackNews : [];
  const heroItems = visibleNews.length ? visibleNews : fallbackNews;
  const hero = heroItems[heroIndex % heroItems.length];
  const word = data?.word || {};
  const interview = data?.interview || {};
  const dateLabel = clean(data?.dateLabel, "2026年6月14日 · 星期日");
  const visitorText = visitStats?.enabled
    ? `累计 ${Intl.NumberFormat("zh-CN").format(visitStats.total)} 次访问 · 今日 ${Intl.NumberFormat("zh-CN").format(visitStats.today)}`
    : "访问统计待启用";
  const wordHistory = (data?.learningHistory || [])
    .filter((entry) => entry?.word?.term && entry.word.term !== word.term)
    .slice(0, 6);
  const interviewHistory = (data?.learningHistory || [])
    .filter((entry) => entry?.interview?.question && entry.interview.question !== interview.question)
    .slice(0, 5);
  const marketData = market || {};
  const marketTemp = marketData.marketTemperature || {};
  const marketIndices = marketData.indices || [];
  const marketSectors = marketData.sectors || [];
  const gold = marketData.gold || {};
  const goldPositive = Number(gold.changePct) >= 0;

  return (
    <div className={`${dark ? "app dark" : "app"} layout-terminal`}>
      <header className="topbar">
        <button className="mobile-menu" aria-label={menuOpen ? "关闭导航" : "打开导航"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        <a className="brand" href="#top" aria-label="今日脉冲首页">
          <span><img src="/favicon.png" alt="" /></span><strong>今日脉冲<small>科技资讯 · 每日必读</small></strong>
        </a>
        <label className="search">
          <Search size={17} /><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索新闻、项目、技术、工具..." /><kbd>⌘K</kbd>
        </label>
        <nav className={menuOpen ? "open" : ""}>
          {["全部", "人工智能", "开发者", "云计算", "芯片", "产品", "安全"].map((item) => (
            <button key={item} className={filter === item ? "active" : ""} onClick={() => { setFilter(item); setMenuOpen(false); }}>{item}</button>
          ))}
          <button onClick={() => setMoreOpen(!moreOpen)}>更多<ChevronDown size={13} /></button>
        </nav>
        {moreOpen ? <div className="more-menu">
          <a href="https://github.com/trending" target="_blank" rel="noreferrer">GitHub 热门项目</a>
          <a href="https://arxiv.org/list/cs.AI/recent" target="_blank" rel="noreferrer">AI 最新论文</a>
          <a href="https://news.ycombinator.com/" target="_blank" rel="noreferrer">Hacker News 技术社区</a>
        </div> : null}
        <div className="date-status">
          <strong>{dateLabel}</strong><span><Circle fill="currentColor" size={8} />每日简报 · {formatUpdateTime(data?.generatedAt)}更新</span>
          <span><Eye size={11} />{visitorText}</span>
        </div>
        <div className="top-actions">
          {authUser ? <button className="auth-chip" type="button" title={`GitHub: ${authUser.login}`}>
            {authUser.avatar_url ? <img src={authUser.avatar_url} alt="" /> : <GitHubMark size={15} />}
            <span>{authUser.login}</span>
          </button> : <button className="github-login" type="button" onClick={() => authConfigured ? window.location.href = "/api/auth/github/login" : setRefreshNotice("GitHub 登录尚未配置：请先设置 OAuth 环境变量")}>
            <GitHubMark size={15} /><span>GitHub 登录</span>
          </button>}
          {authUser ? <button className="logout-link" type="button" onClick={logoutGitHub}>退出</button> : null}
          <IconButton label="实时刷新" onClick={() => loadDaily(true)}><RefreshCw className={refreshing ? "spin" : ""} /></IconButton>
          <IconButton label="切换主题" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</IconButton>
          <IconButton label="通知" active={notificationOpen} onClick={() => setNotificationOpen(!notificationOpen)}><Bell /></IconButton>
        </div>
        {notificationOpen ? <div className="notification-panel"><strong>更新通知</strong><p>今日简报已于 {formatUpdateTime(data?.generatedAt)} 更新完成。右上角刷新按钮可单独更新新闻与 GitHub 热点。</p><button onClick={() => setNotificationOpen(false)}>知道了</button></div> : null}
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
                <span><strong>{clean(item.title, fallbackNews[index % fallbackNews.length].title)}</strong><p>{clean(item.summary, fallbackNews[index % fallbackNews.length].summary)}</p><small>{clean(item.category, "科技资讯")} · {clean(item.time, `${index + 2} 小时前`)}</small></span>
                <em><TrendingUp size={12} />{128 - index * 13}</em>
              </a>
            ))}
            {!visibleNews.length ? <div className="no-results">当前分类暂无新闻，请切换分类或清空搜索。</div> : null}
          </section>

          <aside className="learning-stack">
            <section className="word-card">
              <SectionTitle icon={<Sparkles size={16} />} action={wordHistoryOpen ? "收起往期" : "查看往期"} onAction={() => setWordHistoryOpen(!wordHistoryOpen)}>每日科技词汇</SectionTitle>
              <h2>{clean(word.term, "Tokenization")}<Volume2 size={17} /></h2>
              <p className="phonetic">{clean(word.phonetic, "/ ˌtəʊkənaɪˈzeɪʃn /")} <span>名词</span></p>
              <strong>中文释义</strong><p>{clean(word.definition, "将文本、数据或序列拆分为更小单位（token）的过程，以便模型或系统能够处理。")}</p>
              <strong>通俗理解</strong><p>{clean(word.example, "大语言模型在处理文本前，需要先进行 tokenization。")}</p>
              <a href="https://huggingface.co/docs/tokenizers" target="_blank" rel="noreferrer">查看相关术语资料 <ExternalLink size={12} /></a>
              {wordHistoryOpen ? <div className="word-history"><strong>往期词汇</strong>{wordHistory.length ? wordHistory.map((entry) => <article key={`${entry.dateLabel}-${entry.word.term}`}><span>{clean(entry.dateLabel, "往期")}</span><h4>{entry.word.term}</h4><p>{clean(entry.word.definition, "暂无中文释义")}</p>{entry.word.example ? <small>{entry.word.example}</small> : null}</article>) : <p>暂无历史</p>}</div> : null}
            </section>

            <section className="interview-card">
              <SectionTitle icon={<Bot size={17} />} action={interviewHistoryOpen ? "收起往期" : "查看往期"} onAction={() => setInterviewHistoryOpen(!interviewHistoryOpen)}>每日 AI 面试题 <em>{clean(interview.category, "AI 应用工程")} · {clean(interview.difficulty, "中等")}</em></SectionTitle>
              <h3>{clean(interview.question, "某机构要搭建 AI 交易场景的实时风险预警系统，核心工程设计要点有哪些？")}</h3>
              <ul>{(interview.points || ["场景需求拆解能力", "低延迟实时系统架构设计", "端侧 AI 推理性能优化"]).map((point) => <li key={point}>{clean(point, "工程能力与可靠性设计")}</li>)}</ul>
              <button className="answer-toggle" onClick={() => setAnswerOpen(!answerOpen)}>{answerOpen ? "收起参考答案" : "查看参考答案"}<ChevronDown /></button>
              {answerOpen && <div className="answer"><strong>参考答案（要点）</strong><ol>{(interview.answer || ["明确延迟阈值、风险判定规则与可解释性要求。", "采用流式计算与特征预计算，缩短数据处理链路。", "量化并压缩模型，在靠近数据源的位置部署。", "增加决策溯源与人工兜底，降低误判风险。"]).map((step) => <li key={step}>{clean(step, "建立可测试、可追踪、可回滚的工程方案。")}</li>)}</ol></div>}
              {interviewHistoryOpen ? <div className="interview-history"><strong>往期面试题</strong>{interviewHistory.length ? interviewHistory.map((entry) => <article key={`${entry.dateLabel}-${entry.interview.question}`}><span>{clean(entry.dateLabel, "往期")} · {clean(entry.interview.category, "AI 应用工程")}</span><p>{entry.interview.question}</p>{entry.interview.answer?.length ? <ol>{entry.interview.answer.slice(0, 4).map((step) => <li key={step}>{step}</li>)}</ol> : <small>暂无答案记录，后续生成会自动保存。</small>}</article>) : <p>暂无历史题目</p>}</div> : null}
            </section>
          </aside>
        </section>

        <section className="market-section">
          <SectionTitle icon={<Activity size={18} />}>市场脉冲 <em>{marketData.sourceLabel || "免费行情"}</em></SectionTitle>
          <div className="market-grid">
            <div className="market-curves">
              {marketIndices.slice(0, 4).map((item) => {
                const positive = Number(item.changePct) >= 0;
                return <article key={item.id || item.name}>
                  <span>{item.name}</span>
                  <strong>{formatNumber(item.price)}</strong>
                  <em className={positive ? "up" : "down"}>{formatPercent(item.changePct)}</em>
                  <Sparkline values={item.trend} positive={positive} />
                </article>;
              })}
            </div>
            <article className="gold-card">
              <span>{"\u6bcf\u65e5\u91d1\u4ef7"} <small>{gold.sourceLabel || "\u514d\u8d39\u91d1\u4ef7"}</small></span>
              <strong>{"$"}{formatNumber(gold.priceUsdOz, 2)}<small>{"/\u76ce\u53f8"}</small></strong>
              <em className={goldPositive ? "up" : "down"}>{formatPercent(gold.changePct)}</em>
              <Sparkline values={gold.trend} positive={goldPositive} />
              <p>{"\u7ea6 \u00a5"}{formatNumber(gold.priceCnyGram, 2)}{"/\u514b"}</p>
              <small>{gold.note || "\u6309\u514d\u8d39\u884c\u60c5\u4f30\u7b97\uff0c\u4ec5\u4f9b\u53c2\u8003"}</small>
            </article>
            <aside className="market-temp">
              <span>市场温度</span>
              <strong>{formatNumber(marketTemp.score, 0)}<small>/100</small></strong>
              <div><i style={{ width: `${Math.max(4, Number(marketTemp.score || 0))}%` }} /></div>
              <b>{marketTemp.label || "等待数据"}</b>
              <p>{marketTemp.summary || "正在等待免费行情源生成市场温度。"}</p>
            </aside>
          </div>
          <div className="sector-head">
            <strong>热门板块</strong>
            <span>{marketData.generatedAt ? `更新于 ${new Date(marketData.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
          </div>
          <div className="sector-strip">
            {marketSectors.slice(0, 8).map((sector) => <article key={sector.code || sector.name}>
              <b>{sector.rank}</b>
              <span>{sector.name}<small>{sector.capitalFlow}</small></span>
              <em className={Number(sector.changePct) >= 0 ? "up" : "down"}>{formatPercent(sector.changePct)}</em>
            </article>)}
          </div>
        </section>

        <section className="github-section">
          <SectionTitle icon={<GitHubMark size={20} />} action="前往 GitHub 热门榜" actionHref="https://github.com/trending">GitHub 每日热点</SectionTitle>
          <div className="repo-table">
            {repos.slice(0, 5).map((repo, index) => {
              const fullName = repoFullName(repo);
              const starred = saved.has(fullName);
              const loading = starLoading.has(fullName);
              return <article key={repo.name}>
                <b>{index + 1}</b><em title="近 7 日新增关注数"><ArrowDown size={12} />{clean(repo.growth, `+${1200 - index * 210}`)}</em>
                <span><a href={repo.url} target="_blank" rel="noreferrer">{clean(repo.name, fallbackRepos[index].name)}</a><small>{clean(repo.summary, fallbackRepos[index].summary)}</small></span>
                <i>{localizeLanguage(clean(repo.language, fallbackRepos[index].language))}</i><label title="累计关注数"><Star size={13} />{clean(repo.stars, fallbackRepos[index].stars)}</label>
                <IconButton label={authUser ? (starred ? "取消 GitHub Star" : "Star 到 GitHub") : "登录 GitHub 后 Star"} active={starred || loading} onClick={() => toggleSave(repo)}>{starred ? <BookmarkCheck /> : <Bookmark />}</IconButton>
              </article>;
            })}
          </div>
        </section>

        <section className="bottom-grid">
          <div className="topic-section">
            <SectionTitle>今日精选速览</SectionTitle>
            <div className="topic-grid">{topics.map(([title, count, className, term]) => <a className={className} key={title} href={`https://news.google.com/search?q=${encodeURIComponent(term)}`} target="_blank" rel="noreferrer"><strong>{title}</strong><span>{count}</span><ArrowRight /></a>)}</div>
          </div>
          <aside className="tools-panel">
            <SectionTitle icon={<TrendingUp size={17} />} action="查看更多工具" actionHref="https://www.producthunt.com/">趋势与工具速览</SectionTitle>
            <div className="tools-list">{quickTools.map(([title, sub, status, color, url]) => <a href={url} target="_blank" rel="noreferrer" key={title}><span className={color}>{title.slice(0, 1)}</span><strong>{title}<small>{sub}</small></strong><em>{status}</em></a>)}</div>
          </aside>
        </section>
        <section className="author-card" aria-labelledby="author-name">
          <div className="author-avatar" aria-hidden="true">史</div>
          <div className="author-copy">
            <span>网站作者</span>
            <h2 id="author-name">史迪仔</h2>
            <p>关注人工智能、开发工具与全球科技动态，持续维护今日脉冲。</p>
          </div>
          <a href="https://github.com/Frank-debug666" target="_blank" rel="noreferrer" aria-label="访问史迪仔的 GitHub 主页">
            <GitHubMark size={18} />
            <span>访问 GitHub</span>
            <ExternalLink size={14} />
          </a>
        </section>
      </main>

      <footer><span>数据来源：GNews · GitHub 热门榜 · arXiv · Hacker News</span><span>{visitorText}</span><span>每日自动整理，仅供学习与资讯参考</span></footer>
    </div>
  );
}
