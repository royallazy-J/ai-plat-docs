const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const imageSourceDir = path.join(root, "images");
const imageTargetDir = path.join(publicDir, "images");

const excludedDocs = new Set(["README.md", "账号密码信息.md"]);
const platformUrl = process.env.PLATFORM_URL || readPlatformUrl() || "http://117.143.89.78:30000/";

const docs = fs
  .readdirSync(root)
  .filter((file) => file.endsWith(".md") && !excludedDocs.has(file))
  .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
  .map((file, index) => readDoc(file, index));

if (!docs.length) {
  throw new Error("No public Markdown documents found.");
}

resetDir(publicDir);
copyDir(imageSourceDir, imageTargetDir);
writeFile("index.html", renderLandingPage());
writeFile("documentation/index.html", renderDocumentationNavigation(docs));
writeFile("docs/index.html", renderPage(docs));
writeFile("assets/styles.css", styles());
writeFile("assets/landing.css", landingStyles());
writeFile("assets/app.js", appScript());
writeFile("search-index.json", JSON.stringify(buildSearchIndex(docs), null, 2));

console.log(`Built landing page and ${docs.length} public documents into ${publicDir}`);

function readPlatformUrl() {
  const accountFile = path.join(root, "账号密码信息.md");
  if (!fs.existsSync(accountFile)) return "";
  const text = fs.readFileSync(accountFile, "utf8");
  const match = text.match(/https?:\/\/[^\s)）]+/);
  return match ? match[0] : "";
}

function readDoc(file, index) {
  const source = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
  const title = firstMatch(source, /^#\s+(.+)$/m) || file.replace(/\.md$/, "");
  const subtitle = firstMatch(source, /^##\s+(.+)$/m) || "";
  const slug = `doc-${index + 1}`;
  const headings = extractHeadings(source, slug);
  const html = markdownToHtml(source, slug);
  const summary = plainText(source).slice(0, 170);

  return {
    file,
    part: partInfo(file),
    slug,
    title,
    subtitle,
    summary,
    headings,
    html,
    text: plainText(source)
  };
}

function partInfo(file) {
  const match = file.match(/^AI-PLAT用户手册-(\d{2})/);
  const number = match ? match[1] : "";
  const titles = {
    "01": "第一部分 · 试用准备与平台入门",
    "02": "第二部分 · 核心功能操作指南",
    "03": "第三部分 · 场景教程与支持附录"
  };
  return {
    number,
    title: titles[number] || "其他文档",
    isOverview: new RegExp(`-${number}-00`).test(file)
  };
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

function extractHeadings(markdown, docSlug) {
  return markdown
    .split("\n")
    .map((line) => line.match(/^(#{2,4})\s+(.+)$/))
    .filter(Boolean)
    .map((match) => {
      const level = match[1].length;
      const text = cleanInline(match[2]);
      return { level, text, id: headingId(docSlug, text) };
    });
}

function markdownToHtml(markdown, docSlug) {
  const lines = markdown.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push("<hr>");
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 4);
      const text = cleanInline(heading[2]);
      const id = level > 1 ? ` id="${headingId(docSlug, text)}"` : "";
      blocks.push(`<h${level}${id}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (isTableStart(lines, i)) {
      const tableLines = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        tableLines.push(lines[i]);
        i += 1;
      }
      blocks.push(renderTable(tableLines));
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    if (/^\s*>\s+/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(`<blockquote>${quoteLines.map(inline).join("<br>")}</blockquote>`);
      continue;
    }

    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !isTableStart(lines, i) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return blocks.join("\n");
}

function isTableStart(lines, index) {
  return (
    /^\s*\|.+\|\s*$/.test(lines[index] || "") &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] || "")
  );
}

function renderTable(lines) {
  const rows = lines
    .filter((line, index) => index !== 1)
    .map((line) => splitTableRow(line).map((cell) => inline(cell.trim())));
  const [head = [], ...body] = rows;

  return `<div class="table-wrap"><table><thead><tr>${head
    .map((cell) => `<th>${cell}</th>`)
    .join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
}

function inline(value) {
  let html = escapeHtml(value);

  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const cleanSrc = src.replace(/^\.?\//, "");
    const publicSrc = /^(https?:|data:)/.test(cleanSrc) ? cleanSrc : `/${cleanSrc}`;
    return `<figure><button class="image-button" type="button" data-image="${escapeAttr(publicSrc)}" data-alt="${escapeAttr(alt)}"><img src="${escapeAttr(publicSrc)}" alt="${escapeAttr(alt)}" loading="lazy"></button><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener">$1</a>`);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  return html;
}

function cleanInline(value) {
  return value.replace(/!\[[^\]]*\]\([^)]+\)/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*`]/g, "").trim();
}

function headingId(docSlug, text) {
  const normalized = cleanInline(text)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${docSlug}-${normalized || "section"}`;
}

function plainText(markdown) {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*`|_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchIndex(publicDocs) {
  return publicDocs.map(({ slug, title, subtitle, summary, headings, text }) => ({
    slug,
    title,
    subtitle,
    summary,
    headings,
    text
  }));
}

function renderLandingPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="AI-PLAT 文档与平台入口。">
  <title>AI-PLAT 帮助中心</title>
  <link rel="stylesheet" href="/assets/landing.css">
</head>
<body>
  <header class="landing-header">
    <div class="landing-brand" aria-label="AI-PLAT">
      <span class="landing-mark">AI-PLAT</span>
      <span class="landing-divider"></span>
      <span class="landing-label">帮助中心</span>
    </div>
  </header>
  <main>
    <section class="landing-hero landing-home-hero" aria-labelledby="landing-title">
      <p class="landing-eyebrow">AI-PLAT SUPPORT</p>
      <h1 id="landing-title">需要去往哪里？</h1>
      <p>选择入口，继续查阅操作手册或进入 AI-PLAT 平台。</p>
    </section>
    <nav class="entry-list" aria-label="AI-PLAT 导航入口">
      <a class="entry-link docs-entry" href="/documentation/">
        <span class="entry-icon" aria-hidden="true">01</span>
        <span class="entry-copy"><strong>AI-PLAT 使用文档</strong><small>查阅平台功能说明、操作步骤与常见问题</small></span>
        <span class="entry-arrow" aria-hidden="true">›</span>
      </a>
      <a class="entry-link platform-entry" href="${escapeAttr(platformUrl)}" target="_blank" rel="noopener">
        <span class="entry-icon" aria-hidden="true">02</span>
        <span class="entry-copy"><strong>进入 AI-PLAT 平台</strong><small>打开平台，开始项目与 AI 生产工作</small></span>
        <span class="entry-arrow" aria-hidden="true">›</span>
      </a>
    </nav>
  </main>
  <footer>AI-PLAT · 用户文档中心</footer>
  <script>if (location.hash) location.replace("/docs/" + location.hash);</script>
</body>
</html>`;
}

function renderDocumentationNavigation(publicDocs) {
  const groups = Array.from(new Map(publicDocs.map((doc) => [doc.part.number, doc.part])).keys())
    .map((partNumber, index) => {
      const docs = publicDocs.filter((doc) => doc.part.number === partNumber);
      const [overview, ...chapters] = docs;
      const chapterLinks = chapters.map((doc) => {
        return `<section class="document-map-chapter"><a class="document-map-chapter-title" href="/docs/#${doc.slug}">${escapeHtml(doc.subtitle || doc.title)}<span aria-hidden="true">›</span></a></section>`;
      }).join("");
      return `<section class="document-map-group"><a class="document-map-part" href="/docs/#${overview.slug}"><span class="document-map-number">0${index + 1}</span><span>${escapeHtml(overview.subtitle || overview.title)}</span><b aria-hidden="true">›</b></a><div class="document-map-tree">${chapterLinks}</div></section>`;
    }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="AI-PLAT 使用文档目录。">
  <title>AI-PLAT 使用文档</title>
  <link rel="stylesheet" href="/assets/landing.css">
</head>
<body>
  <header class="landing-header">
    <div class="landing-brand" aria-label="AI-PLAT">
      <span class="landing-mark">AI-PLAT</span>
      <span class="landing-divider"></span>
      <span class="landing-label">使用文档</span>
    </div>
  </header>
  <main>
    <section class="landing-hero document-map-hero" aria-labelledby="document-map-title">
      <p class="landing-eyebrow">AI-PLAT DOCUMENTATION</p>
      <h1 id="document-map-title">选择要阅读的内容</h1>
      <p>按部分和章节快速定位。点击任一项，即可直接进入对应文档内容。</p>
    </section>
    <nav class="document-map" aria-label="AI-PLAT 文档目录">${groups}</nav>
  </main>
  <footer>AI-PLAT · 用户文档中心</footer>
</body>
</html>`;
}

function renderPage(publicDocs) {
  const navToggle = (controls, label) => `<button class="nav-toggle" type="button" aria-expanded="true" aria-controls="${controls}" data-nav-toggle="${controls}" aria-label="${label}"><span>⌄</span></button>`;
  const navItem = (doc, childLinks = "") => {
      const headingLinks = doc.headings
        .filter((heading) => {
          const isDocumentTitle = heading.level === 2 && heading.text === doc.subtitle;
          const isClosingSection = /^下一步阅读|^下一步操作|^手册结束说明/.test(heading.text);
          return !isDocumentTitle && !isClosingSection && (heading.level === 2 || heading.level === 3 || heading.level === 4);
        })
        .slice(0, 14)
        .map((heading) => {
          const className = heading.level === 2 ? "toc-section-link" : `toc-link level-${heading.level}`;
          return `<a class="${className}" href="#${heading.id}" data-doc-target="${doc.slug}" data-section-target="${heading.id}">${escapeHtml(heading.text)}</a>`;
        })
        .join("");
      const children = childLinks || headingLinks;
      const childrenId = `nav-${doc.slug}-children`;
      return `<section class="nav-doc"><div class="nav-row"><a class="doc-tab" href="#${doc.slug}" data-doc-target="${doc.slug}"><span>${escapeHtml(doc.subtitle || doc.title)}</span></a>${children ? navToggle(childrenId, `折叠 ${escapeAttr(doc.subtitle || doc.title)}`) : ""}</div>${children ? `<div class="toc nav-children" id="${childrenId}">${children}</div>` : ""}</section>`;
    };

  const nav = Array.from(new Map(publicDocs.map((doc) => [doc.part.number, doc.part])).entries())
    .map(([partNumber]) => {
      const docs = publicDocs.filter((doc) => doc.part.number === partNumber);
      if (docs[0]?.part.isOverview) {
        const [overview, ...chapters] = docs;
        const chapterLinks = chapters
          .map((doc) => {
            const sectionLinks = doc.headings
              .filter((heading) => {
                const isDocumentTitle = heading.level === 2 && heading.text === doc.subtitle;
                const isClosingSection = /^下一步阅读|^下一步操作|^手册结束说明/.test(heading.text);
                return !isDocumentTitle && !isClosingSection && (heading.level === 3 || heading.level === 4);
              })
              .slice(0, 14)
              .map((heading) => `<a class="toc-link level-${heading.level}" href="#${heading.id}" data-doc-target="${doc.slug}" data-section-target="${heading.id}">${escapeHtml(heading.text)}</a>`)
              .join("");
            const childrenId = `nav-${doc.slug}-children`;
            return `<section class="nav-chapter"><div class="nav-row"><a class="toc-section-link part-chapter-link" href="#${doc.slug}" data-doc-target="${doc.slug}">${escapeHtml(doc.subtitle || doc.title)}</a>${sectionLinks ? navToggle(childrenId, `折叠 ${escapeAttr(doc.subtitle || doc.title)}`) : ""}</div>${sectionLinks ? `<div class="toc nav-children nav-subsections" id="${childrenId}">${sectionLinks}</div>` : ""}</section>`;
          })
          .join("");
        return `<section class="nav-group">${navItem(overview, chapterLinks)}</section>`;
      }
      return `<section class="nav-group">${docs.map(navItem).join("")}</section>`;
    })
    .join("");

  const guideDocs = publicDocs.filter((doc) => ["01", "02", "03"].includes(doc.part.number));
  const nextGuideDoc = new Map(guideDocs.map((doc, index) => [doc.slug, guideDocs[index + 1]]));

  const articles = publicDocs
    .map((doc, index) => {
      const next = nextGuideDoc.get(doc.slug);
      const nextLink = next
        ? `<nav class="doc-pagination" aria-label="下一小节"><a href="#${next.slug}" data-doc-target="${next.slug}"><span>下一小节</span><strong>${escapeHtml(next.subtitle || next.title)}</strong><b>→</b></a></nav>`
        : "";
      return `<article class="doc-panel${index === 0 ? " active" : ""}" id="${doc.slug}" data-doc="${doc.slug}" tabindex="-1">${doc.html}${nextLink}</article>`;
    })
    .join("");

  const cards = publicDocs
    .filter((doc) => doc.part.isOverview)
    .map((doc, index) => `<a class="quick-card" href="#${doc.slug}" data-doc-target="${doc.slug}"><span class="card-number">0${index + 1}</span><span class="card-title">${escapeHtml(doc.subtitle || doc.title)}</span><small>${escapeHtml(doc.summary)}</small><b>开始阅读 <i>→</i></b></a>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI-PLAT 用户文档中心</title>
  <meta name="description" content="AI-PLAT 平台用户手册、核心功能操作指南和场景支持附录。">
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body>
  <div class="reading-progress" aria-hidden="true"><span id="readingProgress"></span></div>
  <header class="topbar">
    <button class="menu-button" id="menuButton" type="button" aria-label="打开文档目录" aria-expanded="false">☰</button>
    <a class="brand" href="/documentation/" aria-label="返回文档目录">
      <span class="brand-wordmark">AI-PLAT</span>
      <span class="brand-divider"></span>
      <span class="brand-label">用户文档</span>
    </a>
    <div class="top-actions">
      <div class="search-wrap">
        <label class="search" aria-label="搜索文档">
          <span class="search-icon">⌕</span>
          <input id="searchInput" type="search" placeholder="搜索文档">
          <kbd>⌘ K</kbd>
        </label>
        <section id="searchResults" class="search-results" hidden></section>
      </div>
      ${platformUrl ? `<a class="platform-link" href="${escapeAttr(platformUrl)}" target="_blank" rel="noopener">进入平台</a>` : ""}
    </div>
  </header>

  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-heading"><span>AI-PLAT 用户手册</span><button class="sidebar-close" id="sidebarClose" type="button" aria-label="关闭目录">×</button></div>
      <div class="side-title">开始使用</div>
      ${nav}
      <div class="sidebar-footer"><span class="status-dot"></span> 文档持续更新中</div>
    </aside>
    <button class="sidebar-scrim" id="sidebarScrim" type="button" aria-label="关闭目录"></button>

    <main class="content">
      <section class="overview" id="overview">
        <p class="eyebrow">AI-PLAT DOCUMENTATION</p>
        <h1>从这里开始使用<br>AI-PLAT</h1>
        <p class="overview-copy">围绕试用准备、数据管理、模型训练、工作流与部署，为客户试用、交付培训和日常支持准备的一站式操作文档。</p>
        <section class="quick-grid" aria-label="快速入口">${cards}</section>
        <div class="overview-note"><strong>快速提示</strong><span>使用顶部搜索，或从左侧目录直接进入对应操作步骤。</span></div>
      </section>

      <section class="docs">
        ${articles}
      </section>
    </main>
  </div>

  <div class="lightbox" id="lightbox" hidden>
    <button class="lightbox-close" type="button" aria-label="关闭图片预览">×</button>
    <img alt="">
    <p></p>
  </div>

  <script src="/assets/app.js"></script>
</body>
</html>`;
}

function styles() {
  return `:root { --ink:#1d2432; --muted:#728095; --line:#e5e9ef; --panel:#fff; --canvas:#fff; --brand:#478ae5; --teal:#50b69f; --brand-soft:#eff8fb; --deep:#111827; --green:#50b69f; }
* { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Inter,"PingFang SC","Microsoft YaHei",Arial,sans-serif; font-size:15px; line-height:1.78; } a { color:inherit; text-decoration:none; } button,input { font:inherit; }
.reading-progress { position:fixed; inset:0 0 auto; z-index:50; height:2px; background:transparent; } .reading-progress span { display:block; width:0; height:100%; background:var(--brand); transition:width .1s linear; }
.topbar { position:sticky; top:0; z-index:30; height:64px; display:flex; align-items:center; gap:18px; padding:0 32px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.9); backdrop-filter:blur(16px); }
.brand { display:flex; align-items:center; gap:10px; min-width:220px; } .brand-wordmark { display:inline-block; color:transparent; background:linear-gradient(90deg,var(--teal),var(--brand)); background-clip:text; -webkit-background-clip:text; font-size:17px; font-weight:800; letter-spacing:.15em; line-height:1; white-space:nowrap; } .brand-divider { width:1px; height:16px; background:#dce2ea; } .brand-label { color:#778195; font-size:12px; font-weight:600; white-space:nowrap; }
.menu-button,.sidebar-close { display:none; border:0; background:transparent; color:var(--ink); cursor:pointer; } .top-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:1}.search-wrap{position:relative;width:min(440px,100%)}.search{display:flex;align-items:center;gap:9px;width:100%;height:38px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:#fafafa;transition:border-color .2s,box-shadow .2s}.search:focus-within{border-color:#9fb9fa;box-shadow:0 0 0 3px var(--brand-soft);background:#fff}.search-icon{color:var(--muted);font-size:21px;line-height:1}.search input{width:100%;min-width:0;border:0;outline:0;color:var(--ink);background:transparent;font-size:13px}.search kbd{padding:1px 5px;border:1px solid #d9dce3;border-radius:4px;color:var(--muted);background:#fff;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.platform-link{display:inline-flex;align-items:center;height:38px;padding:0 13px;border:1px solid var(--line);border-radius:7px;background:#fff;font-size:13px;font-weight:650;white-space:nowrap}.platform-link:hover{border-color:#aabff4;color:var(--brand)}
.layout{display:grid;grid-template-columns:270px minmax(0,1fr);min-height:calc(100vh - 64px)}.sidebar{position:sticky;top:64px;height:calc(100vh - 64px);overflow:auto;padding:28px 16px 26px 24px;border-right:1px solid var(--line);background:#fff}.sidebar-heading{display:flex;align-items:center;justify-content:space-between;margin:0 8px 26px;color:#4b5563;font-size:12px;font-weight:700}.side-title{margin:0 8px 8px;color:#9ca3af;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.nav-doc{margin-bottom:17px}.doc-tab{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 9px;border-radius:6px;color:#334155;font-size:13px;font-weight:650;line-height:1.45}.doc-tab b{opacity:0;font-size:18px;font-weight:400;transition:opacity .2s}.doc-tab:hover b,.doc-tab.active b{opacity:1}.doc-tab.active,.doc-tab:hover{color:var(--brand);background:var(--brand-soft)}.toc{margin:5px 0 0 12px;padding-left:10px;border-left:1px solid #edf0f4}.toc-link{display:block;padding:3px 0;color:#788395;font-size:12px;line-height:1.45}.toc-link.level-3{padding-left:8px}.toc-link:hover{color:var(--brand)}.sidebar-footer{display:flex;align-items:center;gap:7px;margin:32px 8px 0;color:#9ca3af;font-size:11px}.status-dot{width:6px;height:6px;border-radius:99px;background:var(--green)}.sidebar-scrim{display:none}
.content{min-width:0;padding:66px clamp(28px,5vw,88px) 96px}.overview,.docs{width:min(800px,100%);margin:0 auto}.overview{padding-top:5vh}.eyebrow{margin:0 0 16px;color:var(--brand);font-size:11px;font-weight:800;letter-spacing:.1em}.overview h1{max-width:650px;margin:0;color:#111827;font-size:44px;line-height:1.18;letter-spacing:0}.overview-copy{max-width:670px;margin:19px 0 42px;color:#657084;font-size:17px;line-height:1.8}.quick-grid{display:grid;grid-template-columns:1fr;gap:10px}.quick-card{position:relative;display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:5px 13px;align-items:center;min-height:96px;padding:18px 20px;border:1px solid var(--line);border-radius:8px;background:#fff;transition:transform .2s,border-color .2s,box-shadow .2s}.quick-card:hover{z-index:1;border-color:#b9cbfa;box-shadow:0 12px 30px rgba(37,99,235,.09);transform:translateY(-1px)}.card-number{grid-row:span 2;display:grid;place-items:center;width:38px;height:38px;border-radius:7px;color:var(--brand);background:var(--brand-soft);font-size:12px;font-weight:800}.card-title{font-weight:750}.quick-card small{grid-column:2;color:var(--muted);font-size:12px;line-height:1.55}.quick-card b{grid-column:3;grid-row:1 / span 2;color:var(--brand);font-size:12px;font-weight:650;white-space:nowrap}.quick-card i{font-size:15px;font-style:normal}.overview-note{display:flex;gap:14px;margin-top:34px;padding:13px 15px;border-radius:7px;background:#f8fafc;color:var(--muted);font-size:12px}.overview-note strong{color:#374151;white-space:nowrap}.search-results{position:absolute;z-index:55;top:46px;left:0;width:100%;max-height:336px;overflow-y:auto;padding:10px 14px;border:1px solid #cddafb;border-radius:8px;background:#fff;box-shadow:0 16px 34px rgba(24,53,78,.16)}.search-results > strong{display:block;padding:2px 0 7px;color:#68788a;font-size:11px;font-weight:800;letter-spacing:.06em}.result-item{display:block;padding:10px 2px;border-top:1px solid #e3eafc}.result-item:first-of-type{border-top:0}.result-item:hover{color:inherit;background:#f5fbfb}.result-item strong{display:block;color:#25375f;font-size:13px}.result-item span{display:block;overflow:hidden;color:var(--muted);font-size:12px;line-height:1.5;text-overflow:ellipsis;white-space:nowrap}mark{padding:0 1px;background:#fff0a8}.docs{display:block}.doc-panel{display:none}.doc-panel.active{display:block}.doc-panel:focus{outline:0}.overview:has(~ .docs .doc-panel.active){display:none}
.doc-panel h1{margin:0 0 12px;color:#101828;font-size:38px;line-height:1.22;letter-spacing:0}.doc-panel h1 + p{margin-top:0;color:#667085;font-size:17px}.doc-panel h2{margin:52px 0 15px;padding-top:4px;color:#172033;font-size:25px;line-height:1.35;scroll-margin-top:82px}.doc-panel h3{margin:32px 0 10px;color:#27364a;font-size:18px;line-height:1.45;scroll-margin-top:82px}.doc-panel h4{margin:24px 0 8px;font-size:16px;scroll-margin-top:82px}.doc-panel p{margin:13px 0}.doc-panel ul,.doc-panel ol{padding-left:23px}.doc-panel li{margin:6px 0}.doc-panel a:not(.image-button){color:var(--brand);text-decoration:underline;text-underline-offset:3px}.doc-panel code{padding:2px 5px;border-radius:4px;color:#28457d;background:#f1f5ff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em}.doc-panel blockquote{margin:21px 0;padding:12px 16px;border-left:3px solid var(--brand);border-radius:0 6px 6px 0;background:#f6f8fc;color:#556070}.doc-panel hr{margin:34px 0;border:0;border-top:1px solid var(--line)}.table-wrap{margin:21px 0;overflow:auto;border:1px solid var(--line);border-radius:7px}table{width:100%;border-collapse:collapse;min-width:600px}th,td{padding:11px 13px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:#445069;background:#fafbfc;font-size:13px;font-weight:750;white-space:nowrap}tr:last-child td{border-bottom:0}figure{margin:22px 0 28px}.image-button{display:block;width:100%;padding:0;border:1px solid var(--line);border-radius:7px;overflow:hidden;background:#f8fafc;cursor:zoom-in}.image-button:hover{border-color:#adc2f7}figure img{display:block;width:100%;height:auto}figcaption{margin-top:7px;color:#8a94a5;font-size:12px;text-align:center}
.doc-panel h1{margin:0 0 12px;color:#101828;font-size:38px;line-height:1.22;letter-spacing:0}.doc-panel h1 + p{margin-top:0;color:#667085;font-size:17px}.doc-panel h2{margin:52px 0 15px;padding-top:4px;color:#172033;font-size:25px;line-height:1.35;scroll-margin-top:82px}.doc-panel h3{margin:32px 0 10px;color:#27364a;font-size:18px;line-height:1.45;scroll-margin-top:82px}.doc-panel h4{margin:24px 0 8px;font-size:16px;scroll-margin-top:82px}.doc-panel p{margin:13px 0}.doc-panel ul,.doc-panel ol{padding-left:23px}.doc-panel li{margin:6px 0}.doc-panel a:not(.image-button){color:var(--brand);text-decoration:underline;text-underline-offset:3px}.doc-panel code{padding:2px 5px;border-radius:4px;color:#28457d;background:#f1f5ff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em}.doc-panel blockquote{margin:21px 0;padding:12px 16px;border-left:3px solid var(--brand);border-radius:0 6px 6px 0;background:#f6f8fc;color:#556070}.doc-panel hr{margin:34px 0;border:0;border-top:1px solid var(--line)}.doc-pagination{margin-top:52px;padding-top:22px;border-top:1px solid var(--line)}.doc-pagination a{display:grid;grid-template-columns:1fr auto;gap:2px 16px;padding:15px 17px!important;border:1px solid #cfe9eb;border-radius:8px;background:#f7fbfb;text-decoration:none!important}.doc-pagination a:hover{border-color:#99d5d1;background:#f2fbfa}.doc-pagination span{color:#6e8594;font-size:12px}.doc-pagination strong{grid-column:1;color:#2f687b;font-size:14px}.doc-pagination b{grid-column:2;grid-row:1 / span 2;align-self:center;color:var(--brand);font-size:20px}.table-wrap{margin:21px 0;overflow:auto;border:1px solid var(--line);border-radius:7px}table{width:100%;border-collapse:collapse;min-width:600px}th,td{padding:11px 13px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:#445069;background:#fafbfc;font-size:13px;font-weight:750;white-space:nowrap}tr:last-child td{border-bottom:0}figure{margin:22px 0 28px}.image-button{display:block;width:100%;padding:0;border:1px solid var(--line);border-radius:7px;overflow:hidden;background:#f8fafc;cursor:zoom-in}.image-button:hover{border-color:#adc2f7}figure img{display:block;width:100%;height:auto}figcaption{margin-top:7px;color:#8a94a5;font-size:12px;text-align:center}
.page-toc{position:sticky;top:64px;height:calc(100vh - 64px);padding:96px 22px 30px;border-left:1px solid var(--line);background:#fff}.page-toc p{margin:0 0 9px;color:#9ca3af;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.page-toc a{display:block;padding:4px 0;color:#778195;font-size:12px;line-height:1.45}.page-toc a:hover,.page-toc a.active{color:var(--brand)}.page-toc a.level-3{padding-left:9px}.lightbox{position:fixed;inset:0;z-index:60;display:grid;grid-template-rows:1fr auto;place-items:center;padding:56px 28px 28px;background:rgba(12,18,32,.9)}.lightbox[hidden]{display:none}.lightbox img{max-width:min(1360px,96vw);max-height:82vh;border-radius:7px;background:#fff}.lightbox p{margin:14px 0 0;color:#fff}.lightbox-close{position:absolute;top:16px;right:20px;width:38px;height:38px;border:0;border-radius:7px;color:#fff;background:rgba(255,255,255,.16);font-size:27px;cursor:pointer}
@media(max-width:1180px){.layout{grid-template-columns:254px minmax(0,1fr)}.content{padding-left:clamp(28px,6vw,70px);padding-right:clamp(28px,6vw,70px)}}
@media(max-width:820px){.topbar{height:58px;padding:0 16px;gap:12px}.menu-button{display:block;padding:6px;font-size:20px}.brand{min-width:auto}.brand small{display:none}.sidebar{position:fixed;z-index:45;top:0;bottom:0;left:0;width:min(300px,86vw);height:100vh;padding-top:24px;transform:translateX(-102%);box-shadow:12px 0 34px rgba(17,24,39,.16);transition:transform .24s}.sidebar.open{transform:translateX(0)}.sidebar-close{display:block;font-size:24px}.sidebar-scrim{position:fixed;inset:0;z-index:40;border:0;background:rgba(17,24,39,.35)}.sidebar-scrim.open{display:block}.layout{display:block;min-height:calc(100vh - 58px)}.content{padding:38px 20px 68px}.overview{padding-top:2vh}.overview h1{font-size:36px}.page-toc{display:none}.search-wrap{width:min(320px,100%)}.platform-link{display:none}.doc-panel h1{font-size:32px}.doc-panel h2{font-size:23px}.quick-card{grid-template-columns:40px minmax(0,1fr);padding:16px}.quick-card b{display:none}.quick-card small{grid-column:2}.overview-note{display:block}.overview-note span{display:block;margin-top:4px}}
@media(max-width:520px){.brand-wordmark{font-size:15px}.brand-divider,.brand-label{display:none}.search-wrap{width:auto;flex:1}.search kbd{display:none}.search input{font-size:12px}.overview h1{font-size:31px}.overview-copy{font-size:15px}.content{padding:30px 16px 58px}.doc-panel h1{font-size:29px}.doc-panel h2{font-size:21px}.doc-panel h3{font-size:17px}.doc-panel p,.doc-panel li{font-size:14px}}

/* Match the AI-PLAT platform's teal-to-blue wordmark and primary action treatment. */
.platform-link{border:0;background:linear-gradient(90deg,var(--teal),var(--brand));box-shadow:0 5px 12px rgba(71,138,229,.18);color:#fff}.platform-link:hover{border-color:transparent;color:#fff;box-shadow:0 7px 16px rgba(71,138,229,.28)}.search:focus-within{border-color:#9ed8d4}.doc-tab.active,.doc-tab:hover{color:#3486c9;background:linear-gradient(90deg,#effaf8,#f2f7ff)}.toc-section-link{display:block;margin:11px 0 4px;color:#3c4b61;font-size:12px;font-weight:800;line-height:1.45}.toc-section-link:hover,.toc-section-link.active{color:var(--brand)}.toc-link.active{color:var(--brand);font-weight:700}.part-chapter-link{padding:0;font-size:12px}.page-toc a.level-1{margin-top:10px;color:#4b5565;font-weight:750}.page-toc a.level-2{padding-left:8px}.eyebrow{color:var(--teal)}.quick-card:hover{border-color:#b9dcdf;box-shadow:0 12px 30px rgba(52,147,174,.09)}.card-number{color:#398ea6}.overview-note{background:#f7fbfb}.search-results{border-color:#cfe9eb;background:#f6fbfc}.result-item{border-color:#dfedf0}.result-item strong{color:#2e5868}.nav-group{margin:0 0 28px}
.nav-row{display:flex;align-items:center;gap:2px}.nav-row .doc-tab{flex:1;min-width:0}.nav-row .toc-section-link{flex:1;min-width:0;margin:11px 0 4px}.nav-toggle{display:grid;flex:0 0 26px;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:5px;color:#8090a3;background:transparent;cursor:pointer}.nav-toggle:hover{color:var(--brand);background:var(--brand-soft)}.nav-toggle span{font-size:15px;line-height:1;transition:transform .18s}.nav-toggle[aria-expanded="false"] span{transform:rotate(-90deg)}.nav-children[hidden]{display:none}.nav-chapter{margin:0}.nav-subsections{margin-top:2px;margin-bottom:8px}.nav-group{margin:0 0 28px}
`;
}

function landingStyles() {
  return `:root{--ink:#1d2432;--muted:#6e7c90;--line:#e3e8ee;--teal:#50b69f;--blue:#478ae5;--canvas:#f8fafb}*{box-sizing:border-box}body{min-height:100vh;margin:0;color:var(--ink);background:var(--canvas);font-family:Inter,"PingFang SC","Microsoft YaHei",Arial,sans-serif}.landing-header{height:72px;display:flex;align-items:center;padding:0 clamp(24px,7vw,112px);border-bottom:1px solid var(--line);background:#fff}.landing-brand{display:flex;align-items:center;gap:11px}.landing-mark{color:#328ba0;font-size:17px;font-weight:800;letter-spacing:.12em}.landing-divider{width:1px;height:18px;background:#dbe2e8}.landing-label{color:#667386;font-size:13px;font-weight:650}main{width:min(800px,calc(100% - 40px));margin:0 auto}.landing-hero{padding:clamp(80px,15vh,152px) 0 46px}.landing-eyebrow{margin:0 0 14px;color:#3d9d93;font-size:11px;font-weight:800;letter-spacing:.12em}.landing-hero h1{margin:0;color:#172033;font-size:clamp(36px,5vw,52px);line-height:1.16;letter-spacing:0}.landing-hero p:not(.landing-eyebrow){max-width:500px;margin:18px 0 0;color:var(--muted);font-size:17px;line-height:1.75}.landing-home-hero{padding-bottom:26px}.landing-home-hero h1{font-size:clamp(30px,4vw,42px);line-height:1.22}.entry-list{border-top:1px solid var(--line);background:#fff}.entry-link{display:grid;grid-template-columns:54px minmax(0,1fr) 28px;align-items:center;gap:18px;min-height:108px;padding:22px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;transition:background .18s,border-color .18s}.entry-link:hover{background:#f3faf9}.entry-link:focus-visible{position:relative;z-index:1;outline:3px solid #bde4df;outline-offset:-3px}.entry-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:7px;color:#33879a;background:#edf8f7;font-size:12px;font-weight:800}.platform-entry .entry-icon{color:#377ec9;background:#f0f5ff}.entry-copy{min-width:0}.entry-copy strong{display:block;color:#26354a;font-size:16px;line-height:1.45}.entry-copy small{display:block;margin-top:4px;color:var(--muted);font-size:13px;line-height:1.55}.entry-arrow{justify-self:end;color:#4b9eaf;font-size:28px;font-weight:400;line-height:.8;transition:transform .18s}.platform-entry .entry-arrow{color:var(--blue)}.entry-link:hover .entry-arrow{transform:translateX(4px)}.document-map-hero{padding:clamp(52px,8vh,82px) 0 24px}.document-map-hero h1{font-size:clamp(28px,3.3vw,38px);line-height:1.24}.document-map{border-top:1px solid var(--line);background:#fff}.document-map-group{border-bottom:1px solid var(--line)}.document-map-part{display:grid;grid-template-columns:54px minmax(0,1fr) 28px;align-items:center;gap:18px;padding:19px 22px;color:#24364b;font-size:16px;font-weight:780;line-height:1.45;text-decoration:none}.document-map-part:hover{background:#f3faf9}.document-map-number{display:grid;place-items:center;width:42px;height:42px;border-radius:7px;color:#33879a;background:#edf8f7;font-size:12px;font-weight:800}.document-map-part b{justify-self:end;color:#439ba8;font-size:28px;font-weight:400;line-height:.8}.document-map-tree{margin:0 22px 20px 43px;padding:2px 0 4px 21px;border-left:1px solid #dce8ea}.document-map-chapter{padding:9px 0}.document-map-chapter-title{display:flex;align-items:center;justify-content:space-between;gap:15px;color:#34465c;font-size:14px;font-weight:760;line-height:1.5;text-decoration:none}.document-map-chapter-title span{color:#5ba5b0;font-size:22px;font-weight:400;line-height:.8}.document-map-chapter-title:hover,.document-map-link:hover{color:#358cad}.document-map-sections{margin:5px 0 0 12px;padding-left:14px;border-left:1px solid #edf1f3}.document-map-link{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 0;color:#748195;font-size:13px;line-height:1.5;text-decoration:none}.document-map-link span{color:#9aa9b6;font-size:14px}.document-map-link.level-4{padding-left:12px;font-size:12px}footer{width:min(800px,calc(100% - 40px));margin:46px auto 34px;color:#98a3b1;font-size:12px}@media(max-width:560px){.landing-header{height:62px;padding:0 20px}.landing-label{font-size:12px}.landing-hero{padding:76px 0 36px}.landing-home-hero{padding-bottom:22px}.landing-home-hero h1{font-size:32px}.document-map-hero{padding:50px 0 22px}.document-map-hero h1{font-size:30px}.landing-hero p:not(.landing-eyebrow){font-size:15px}.entry-link{grid-template-columns:42px minmax(0,1fr) 20px;gap:13px;min-height:96px;padding:17px}.entry-icon{width:36px;height:36px}.entry-copy strong{font-size:15px}.entry-copy small{font-size:12px}.entry-arrow{font-size:25px}.document-map-part{grid-template-columns:42px minmax(0,1fr) 20px;gap:13px;padding:16px}.document-map-number{width:36px;height:36px}.document-map-tree{margin:0 16px 17px 30px;padding-left:16px}.document-map-chapter-title{font-size:13px}.document-map-link{font-size:12px}}`;
}

function appScript() {
  return `const panels = Array.from(document.querySelectorAll("[data-doc]"));
const navDocTabs = Array.from(document.querySelectorAll(".sidebar .doc-tab[data-doc-target]"));
const navChapterLinks = Array.from(document.querySelectorAll(".sidebar .part-chapter-link[data-doc-target]"));
const navSectionLinks = Array.from(document.querySelectorAll(".sidebar .toc-link[data-section-target]"));
const docLinks = Array.from(document.querySelectorAll("[data-doc-target]"));
const navToggles = Array.from(document.querySelectorAll("[data-nav-toggle]"));
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const lightbox = document.getElementById("lightbox");
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const sidebarClose = document.getElementById("sidebarClose");
const sidebarScrim = document.getElementById("sidebarScrim");
const readingProgress = document.getElementById("readingProgress");
let searchIndex = [];
let activeSidebarTarget = "";

function setNavExpanded(children, expanded) {
  if (!children) return;
  children.hidden = !expanded;
  navToggles.find((toggle) => toggle.dataset.navToggle === children.id)
    ?.setAttribute("aria-expanded", String(expanded));
}

function revealNavLink(link) {
  let parent = link?.parentElement;
  while (parent) {
    if (parent.classList?.contains("nav-children")) setNavExpanded(parent, true);
    parent = parent.parentElement;
  }
}

function showDoc(slug, shouldFocus = false) {
  const target = panels.find((panel) => panel.dataset.doc === slug) || panels[0];
  panels.forEach((panel) => panel.classList.toggle("active", panel === target));
  navDocTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.docTarget === target.dataset.doc));
  navChapterLinks.forEach((link) => link.classList.toggle("active", link.dataset.docTarget === target.dataset.doc));
  syncSidebarSection();
  closeSidebar();
  if (shouldFocus) target.focus({ preventScroll: true });
}

function syncSidebarSection() {
  const activePanel = panels.find((panel) => panel.classList.contains("active"));
  if (!activePanel) return;

  const hash = decodeURIComponent(location.hash.replace("#", ""));
  const hashHeading = document.getElementById(hash);
  const headings = Array.from(activePanel.querySelectorAll("h2[id], h3[id], h4[id]"));
  const currentHeading = hashHeading?.closest("[data-doc]") === activePanel && hashHeading.matches("h2, h3, h4")
    ? hashHeading
    : headings.filter((heading) => heading.getBoundingClientRect().top <= 132).at(-1);

  navSectionLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.sectionTarget === currentHeading?.id);
  });

  const activeLink = currentHeading
    ? navSectionLinks.find((link) => link.dataset.sectionTarget === currentHeading.id)
    : navChapterLinks.find((link) => link.classList.contains("active"));
  revealNavLink(activeLink);
  const targetId = activeLink?.dataset.sectionTarget || activeLink?.dataset.docTarget || "";
  if (activeLink && targetId !== activeSidebarTarget) {
    activeSidebarTarget = targetId;
    activeLink.scrollIntoView({ block: "nearest" });
  }
}

function currentHashDoc() {
  const hash = decodeURIComponent(location.hash.replace("#", ""));
  if (!hash) return panels[0]?.dataset.doc;
  const exactDoc = panels.find((panel) => panel.dataset.doc === hash);
  if (exactDoc) return exactDoc.dataset.doc;
  const section = document.getElementById(hash);
  return section?.closest("[data-doc]")?.dataset.doc || panels[0]?.dataset.doc;
}

window.addEventListener("hashchange", () => showDoc(currentHashDoc()));
showDoc(currentHashDoc());

docLinks.forEach((tab) => {
  tab.addEventListener("click", () => {
    const slug = tab.dataset.docTarget;
    showDoc(slug, true);
  });
});

navToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const children = document.getElementById(toggle.dataset.navToggle);
    setNavExpanded(children, children?.hidden);
  });
});

function setSidebar(open) {
  sidebar?.classList.toggle("open", open);
  sidebarScrim?.classList.toggle("open", open);
  menuButton?.setAttribute("aria-expanded", String(open));
}
function closeSidebar() { setSidebar(false); }
menuButton?.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
sidebarClose?.addEventListener("click", closeSidebar);
sidebarScrim?.addEventListener("click", closeSidebar);

fetch("/search-index.json")
  .then((response) => response.json())
  .then((data) => {
    searchIndex = data;
  })
  .catch(() => {
    searchIndex = [];
  });

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  const terms = query.split(/\\s+/).filter(Boolean);
  const matches = searchIndex
    .map((doc) => {
      const headingMatch = doc.headings
        .map((heading) => ({ heading, score: scoreText(heading.text, terms) * 7 }))
        .sort((a, b) => b.score - a.score)[0];
      const score = Math.max(
        scoreText(doc.subtitle || doc.title, terms) * 9,
        headingMatch?.score || 0,
        scoreText(doc.summary, terms) * 4,
        scoreText(doc.text, terms)
      );
      return { doc, score, heading: headingMatch?.score ? headingMatch.heading : null };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  searchResults.hidden = false;
  searchResults.innerHTML = matches.length
    ? "<strong>搜索结果</strong>" + matches.map(({ doc, heading }) => {
      const target = heading?.id || doc.slug;
      const preview = heading ? \`章节：\${heading.text}\` : searchPreview(doc.summary || doc.text, terms);
      return \`<a class="result-item" href="#\${target}" data-doc-target="\${doc.slug}" data-section-target="\${heading?.id || ""}"><strong>\${escapeHtml(doc.subtitle || doc.title)}</strong><span>\${highlight(preview, terms)}</span></a>\`;
    }).join("")
    : "<strong>未找到匹配结果</strong><p>可以尝试输入功能名称、页面入口或操作关键词。</p>";

  searchResults.querySelectorAll(".result-item").forEach((result) => {
    result.addEventListener("click", () => {
      const target = result.dataset.sectionTarget || result.dataset.docTarget;
      showDoc(result.dataset.docTarget, true);
      requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
      searchInput.value = "";
      searchResults.hidden = true;
      searchResults.innerHTML = "";
    });
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-wrap")) {
    searchResults.hidden = true;
  }
});

function scoreText(text, terms) {
  const source = normalizeSearch(text);
  if (!source) return 0;

  let total = 0;
  for (const term of terms) {
    const score = fuzzyScore(source, normalizeSearch(term));
    if (!score) return 0;
    total += score;
  }
  return total;
}

function fuzzyScore(source, term) {
  if (!term) return 0;
  const directIndex = source.indexOf(term);
  if (directIndex >= 0) return 100 + term.length * 8 - Math.min(directIndex, 80) / 8;

  let cursor = 0;
  let gaps = 0;
  for (const character of term) {
    const foundAt = source.indexOf(character, cursor);
    if (foundAt < 0) return 0;
    gaps += foundAt - cursor;
    cursor = foundAt + 1;
  }
  return Math.max(12, 50 + term.length * 5 - Math.min(gaps, 38));
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^\\p{Letter}\\p{Number}]+/gu, "");
}

function searchPreview(text, terms) {
  const source = String(text || "").replace(/\\s+/g, " ").trim();
  const lowered = source.toLowerCase();
  const position = terms.map((term) => lowered.indexOf(term)).find((index) => index >= 0) || 0;
  const start = Math.max(0, position - 26);
  const end = Math.min(source.length, position + 92);
  return \`\${start ? "…" : ""}\${source.slice(start, end)}\${end < source.length ? "…" : ""}\`;
}

document.addEventListener("click", (event) => {
  const imageButton = event.target.closest(".image-button");
  if (imageButton) {
    lightbox.hidden = false;
    lightbox.querySelector("img").src = imageButton.dataset.image;
    lightbox.querySelector("img").alt = imageButton.dataset.alt || "";
    lightbox.querySelector("p").textContent = imageButton.dataset.alt || "";
  }

  if (event.target.closest(".lightbox-close") || event.target === lightbox) {
    lightbox.hidden = true;
    lightbox.querySelector("img").src = "";
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput?.focus();
  }
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
    event.preventDefault();
    searchInput?.focus();
  }
  if (event.key === "Escape" && !lightbox.hidden) {
    lightbox.hidden = true;
    lightbox.querySelector("img").src = "";
  }
  if (event.key === "Escape" && !searchResults.hidden) {
    searchResults.hidden = true;
    searchInput?.blur();
  }
});

window.addEventListener("scroll", () => {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  if (readingProgress) readingProgress.style.width = height > 0 ? \`\${Math.min(100, window.scrollY / height * 100)}%\` : "0";
  syncSidebarSection();
}, { passive: true });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function highlight(text, terms) {
  let safe = escapeHtml(text);
  terms.forEach((term) => {
    const escaped = escapeRegex(term);
    safe = safe.replace(new RegExp(escaped, "gi"), (match) => \`<mark>\${match}</mark>\`);
  });
  return safe;
}

function escapeRegex(value) {
  return String(value).replace(/[\\\\^$.*+?()[\\]{}|]/g, "\\\\$&");
}`;
}

function writeFile(relativePath, content) {
  const target = path.join(publicDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
