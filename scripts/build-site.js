const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const imageSourceDir = path.join(root, "images");
const imageTargetDir = path.join(publicDir, "images");

const excludedDocs = new Set(["README.md", "账号密码信息.md"]);
const platformUrl = readPlatformUrl();

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
writeFile("index.html", renderPage(docs));
writeFile("assets/styles.css", styles());
writeFile("assets/app.js", appScript());
writeFile("search-index.json", JSON.stringify(buildSearchIndex(docs), null, 2));

console.log(`Built ${docs.length} public documents into ${publicDir}`);

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
  return { number, title: titles[number] || "其他文档" };
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
    return `<figure><button class="image-button" type="button" data-image="${escapeAttr(cleanSrc)}" data-alt="${escapeAttr(alt)}"><img src="${escapeAttr(cleanSrc)}" alt="${escapeAttr(alt)}" loading="lazy"></button><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
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

function renderPage(publicDocs) {
  const navItem = (doc, childLinks = "") => {
      const headingLinks = doc.headings
        .filter((heading) => heading.level === 3 || heading.level === 4)
        .slice(0, 14)
        .map((heading) => `<a class="toc-link level-${heading.level}" href="#${heading.id}">${escapeHtml(heading.text)}</a>`)
        .join("");
      return `<section class="nav-doc"><a class="doc-tab" href="#${doc.slug}" data-doc-target="${doc.slug}"><span>${escapeHtml(doc.subtitle || doc.title)}</span><b>›</b></a><div class="toc">${childLinks || headingLinks}</div></section>`;
    };

  const nav = Array.from(new Map(publicDocs.map((doc) => [doc.part.number, doc.part])).entries())
    .map(([partNumber]) => {
      const docs = publicDocs.filter((doc) => doc.part.number === partNumber);
      if (partNumber === "02") {
        const [overview, ...chapters] = docs;
        const chapterLinks = chapters
          .map((doc) => `<a class="toc-link part-chapter-link" href="#${doc.slug}" data-doc-target="${doc.slug}">${escapeHtml(doc.subtitle || doc.title)}</a>`)
          .join("");
        return `<section class="nav-group">${navItem(overview, chapterLinks)}</section>`;
      }
      return `<section class="nav-group">${docs.map(navItem).join("")}</section>`;
    })
    .join("");

  const articles = publicDocs
    .map((doc, index) => `<article class="doc-panel${index === 0 ? " active" : ""}" id="${doc.slug}" data-doc="${doc.slug}" tabindex="-1">${doc.html}</article>`)
    .join("");

  const cards = publicDocs
    .map((doc, index) => `<a class="quick-card" href="#${doc.slug}" data-doc-target="${doc.slug}"><span class="card-number">0${index + 1}</span><span class="card-title">${escapeHtml(doc.subtitle || doc.title)}</span><small>${escapeHtml(doc.summary)}</small><b>开始阅读 <i>→</i></b></a>`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI-PLAT 用户文档中心</title>
  <meta name="description" content="AI-PLAT 平台用户手册、核心功能操作指南和场景支持附录。">
  <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
  <div class="reading-progress" aria-hidden="true"><span id="readingProgress"></span></div>
  <header class="topbar">
    <button class="menu-button" id="menuButton" type="button" aria-label="打开文档目录" aria-expanded="false">☰</button>
    <a class="brand" href="#doc-1" data-doc-target="doc-1" aria-label="AI-PLAT 文档首页">
      <span class="brand-wordmark">AI-PLAT</span>
      <span class="brand-divider"></span>
      <span class="brand-label">用户文档</span>
    </a>
    <div class="top-actions">
      <label class="search" aria-label="搜索文档">
        <span class="search-icon">⌕</span>
        <input id="searchInput" type="search" placeholder="搜索文档">
        <kbd>⌘ K</kbd>
      </label>
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

      <section id="searchResults" class="search-results" hidden></section>

      <section class="docs">
        ${articles}
      </section>
    </main>
    <aside class="page-toc" aria-label="本页目录"><p>本页内容</p><nav id="pageToc"></nav></aside>
  </div>

  <div class="lightbox" id="lightbox" hidden>
    <button class="lightbox-close" type="button" aria-label="关闭图片预览">×</button>
    <img alt="">
    <p></p>
  </div>

  <script src="assets/app.js"></script>
</body>
</html>`;
}

function styles() {
  return `:root { --ink:#1d2432; --muted:#728095; --line:#e5e9ef; --panel:#fff; --canvas:#fff; --brand:#478ae5; --teal:#50b69f; --brand-soft:#eff8fb; --deep:#111827; --green:#50b69f; }
* { box-sizing:border-box; } html { scroll-behavior:smooth; } body { margin:0; color:var(--ink); background:var(--canvas); font-family:Inter,"PingFang SC","Microsoft YaHei",Arial,sans-serif; font-size:15px; line-height:1.78; } a { color:inherit; text-decoration:none; } button,input { font:inherit; }
.reading-progress { position:fixed; inset:0 0 auto; z-index:50; height:2px; background:transparent; } .reading-progress span { display:block; width:0; height:100%; background:var(--brand); transition:width .1s linear; }
.topbar { position:sticky; top:0; z-index:30; height:64px; display:flex; align-items:center; gap:18px; padding:0 32px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.9); backdrop-filter:blur(16px); }
.brand { display:flex; align-items:center; gap:10px; min-width:220px; } .brand-wordmark { display:inline-block; color:transparent; background:linear-gradient(90deg,var(--teal),var(--brand)); background-clip:text; -webkit-background-clip:text; font-size:17px; font-weight:800; letter-spacing:.15em; line-height:1; white-space:nowrap; } .brand-divider { width:1px; height:16px; background:#dce2ea; } .brand-label { color:#778195; font-size:12px; font-weight:600; white-space:nowrap; }
.menu-button,.sidebar-close { display:none; border:0; background:transparent; color:var(--ink); cursor:pointer; } .top-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex:1}.search{display:flex;align-items:center;gap:9px;width:min(440px,100%);height:38px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:#fafafa;transition:border-color .2s,box-shadow .2s}.search:focus-within{border-color:#9fb9fa;box-shadow:0 0 0 3px var(--brand-soft);background:#fff}.search-icon{color:var(--muted);font-size:21px;line-height:1}.search input{width:100%;min-width:0;border:0;outline:0;color:var(--ink);background:transparent;font-size:13px}.search kbd{padding:1px 5px;border:1px solid #d9dce3;border-radius:4px;color:var(--muted);background:#fff;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}.platform-link{display:inline-flex;align-items:center;height:38px;padding:0 13px;border:1px solid var(--line);border-radius:7px;background:#fff;font-size:13px;font-weight:650;white-space:nowrap}.platform-link:hover{border-color:#aabff4;color:var(--brand)}
.layout{display:grid;grid-template-columns:270px minmax(0,1fr) 210px;min-height:calc(100vh - 64px)}.sidebar{position:sticky;top:64px;height:calc(100vh - 64px);overflow:auto;padding:28px 16px 26px 24px;border-right:1px solid var(--line);background:#fff}.sidebar-heading{display:flex;align-items:center;justify-content:space-between;margin:0 8px 26px;color:#4b5563;font-size:12px;font-weight:700}.side-title{margin:0 8px 8px;color:#9ca3af;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.nav-doc{margin-bottom:17px}.doc-tab{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 9px;border-radius:6px;color:#334155;font-size:13px;font-weight:650;line-height:1.45}.doc-tab b{opacity:0;font-size:18px;font-weight:400;transition:opacity .2s}.doc-tab:hover b,.doc-tab.active b{opacity:1}.doc-tab.active,.doc-tab:hover{color:var(--brand);background:var(--brand-soft)}.toc{margin:5px 0 0 12px;padding-left:10px;border-left:1px solid #edf0f4}.toc-link{display:block;padding:3px 0;color:#788395;font-size:12px;line-height:1.45}.toc-link.level-3{padding-left:8px}.toc-link:hover{color:var(--brand)}.sidebar-footer{display:flex;align-items:center;gap:7px;margin:32px 8px 0;color:#9ca3af;font-size:11px}.status-dot{width:6px;height:6px;border-radius:99px;background:var(--green)}.sidebar-scrim{display:none}
.content{min-width:0;padding:66px clamp(28px,5vw,88px) 96px}.overview,.docs,.search-results{width:min(800px,100%);margin:0 auto}.overview{padding-top:5vh}.eyebrow{margin:0 0 16px;color:var(--brand);font-size:11px;font-weight:800;letter-spacing:.1em}.overview h1{max-width:650px;margin:0;color:#111827;font-size:44px;line-height:1.18;letter-spacing:0}.overview-copy{max-width:670px;margin:19px 0 42px;color:#657084;font-size:17px;line-height:1.8}.quick-grid{display:grid;grid-template-columns:1fr;gap:10px}.quick-card{position:relative;display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:5px 13px;align-items:center;min-height:96px;padding:18px 20px;border:1px solid var(--line);border-radius:8px;background:#fff;transition:transform .2s,border-color .2s,box-shadow .2s}.quick-card:hover{z-index:1;border-color:#b9cbfa;box-shadow:0 12px 30px rgba(37,99,235,.09);transform:translateY(-1px)}.card-number{grid-row:span 2;display:grid;place-items:center;width:38px;height:38px;border-radius:7px;color:var(--brand);background:var(--brand-soft);font-size:12px;font-weight:800}.card-title{font-weight:750}.quick-card small{grid-column:2;color:var(--muted);font-size:12px;line-height:1.55}.quick-card b{grid-column:3;grid-row:1 / span 2;color:var(--brand);font-size:12px;font-weight:650;white-space:nowrap}.quick-card i{font-size:15px;font-style:normal}.overview-note{display:flex;gap:14px;margin-top:34px;padding:13px 15px;border-radius:7px;background:#f8fafc;color:var(--muted);font-size:12px}.overview-note strong{color:#374151;white-space:nowrap}.search-results{margin-bottom:28px;padding:14px 18px;border:1px solid #cddafb;border-radius:8px;background:#f9fbff}.result-item{display:block;padding:12px 0;border-top:1px solid #e3eafc}.result-item:first-child{padding-top:8px;border-top:0}.result-item strong{display:block;color:#25375f;font-size:14px}.result-item span{color:var(--muted);font-size:12px}mark{padding:0 1px;background:#fff0a8}.docs{display:block}.doc-panel{display:none}.doc-panel.active{display:block}.doc-panel:focus{outline:0}.overview:has(+ .search-results:not([hidden])){display:none}.overview:has(~ .docs .doc-panel.active){display:none}
.doc-panel h1{margin:0 0 12px;color:#101828;font-size:38px;line-height:1.22;letter-spacing:0}.doc-panel h1 + p{margin-top:0;color:#667085;font-size:17px}.doc-panel h2{margin:52px 0 15px;padding-top:4px;color:#172033;font-size:25px;line-height:1.35;scroll-margin-top:82px}.doc-panel h3{margin:32px 0 10px;color:#27364a;font-size:18px;line-height:1.45;scroll-margin-top:82px}.doc-panel h4{margin:24px 0 8px;font-size:16px;scroll-margin-top:82px}.doc-panel p{margin:13px 0}.doc-panel ul,.doc-panel ol{padding-left:23px}.doc-panel li{margin:6px 0}.doc-panel a:not(.image-button){color:var(--brand);text-decoration:underline;text-underline-offset:3px}.doc-panel code{padding:2px 5px;border-radius:4px;color:#28457d;background:#f1f5ff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em}.doc-panel blockquote{margin:21px 0;padding:12px 16px;border-left:3px solid var(--brand);border-radius:0 6px 6px 0;background:#f6f8fc;color:#556070}.doc-panel hr{margin:34px 0;border:0;border-top:1px solid var(--line)}.table-wrap{margin:21px 0;overflow:auto;border:1px solid var(--line);border-radius:7px}table{width:100%;border-collapse:collapse;min-width:600px}th,td{padding:11px 13px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:#445069;background:#fafbfc;font-size:13px;font-weight:750;white-space:nowrap}tr:last-child td{border-bottom:0}figure{margin:22px 0 28px}.image-button{display:block;width:100%;padding:0;border:1px solid var(--line);border-radius:7px;overflow:hidden;background:#f8fafc;cursor:zoom-in}.image-button:hover{border-color:#adc2f7}figure img{display:block;width:100%;height:auto}figcaption{margin-top:7px;color:#8a94a5;font-size:12px;text-align:center}
.page-toc{position:sticky;top:64px;height:calc(100vh - 64px);padding:96px 22px 30px;border-left:1px solid var(--line);background:#fff}.page-toc p{margin:0 0 9px;color:#9ca3af;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.page-toc a{display:block;padding:4px 0;color:#778195;font-size:12px;line-height:1.45}.page-toc a:hover,.page-toc a.active{color:var(--brand)}.page-toc a.level-3{padding-left:9px}.lightbox{position:fixed;inset:0;z-index:60;display:grid;grid-template-rows:1fr auto;place-items:center;padding:56px 28px 28px;background:rgba(12,18,32,.9)}.lightbox[hidden]{display:none}.lightbox img{max-width:min(1360px,96vw);max-height:82vh;border-radius:7px;background:#fff}.lightbox p{margin:14px 0 0;color:#fff}.lightbox-close{position:absolute;top:16px;right:20px;width:38px;height:38px;border:0;border-radius:7px;color:#fff;background:rgba(255,255,255,.16);font-size:27px;cursor:pointer}
@media(max-width:1180px){.layout{grid-template-columns:254px minmax(0,1fr)}.page-toc{display:none}.content{padding-left:clamp(28px,6vw,70px);padding-right:clamp(28px,6vw,70px)}}
@media(max-width:820px){.topbar{height:58px;padding:0 16px;gap:12px}.menu-button{display:block;padding:6px;font-size:20px}.brand{min-width:auto}.brand small{display:none}.sidebar{position:fixed;z-index:45;top:0;bottom:0;left:0;width:min(300px,86vw);height:100vh;padding-top:24px;transform:translateX(-102%);box-shadow:12px 0 34px rgba(17,24,39,.16);transition:transform .24s}.sidebar.open{transform:translateX(0)}.sidebar-close{display:block;font-size:24px}.sidebar-scrim{position:fixed;inset:0;z-index:40;border:0;background:rgba(17,24,39,.35)}.sidebar-scrim.open{display:block}.layout{display:block;min-height:calc(100vh - 58px)}.content{padding:38px 20px 68px}.overview{padding-top:2vh}.overview h1{font-size:36px}.page-toc{display:none}.search{width:min(320px,100%)}.platform-link{display:none}.doc-panel h1{font-size:32px}.doc-panel h2{font-size:23px}.quick-card{grid-template-columns:40px minmax(0,1fr);padding:16px}.quick-card b{display:none}.quick-card small{grid-column:2}.overview-note{display:block}.overview-note span{display:block;margin-top:4px}}
@media(max-width:520px){.brand-wordmark{font-size:15px}.brand-divider,.brand-label{display:none}.search{width:auto;flex:1}.search kbd{display:none}.search input{font-size:12px}.overview h1{font-size:31px}.overview-copy{font-size:15px}.content{padding:30px 16px 58px}.doc-panel h1{font-size:29px}.doc-panel h2{font-size:21px}.doc-panel h3{font-size:17px}.doc-panel p,.doc-panel li{font-size:14px}}

/* Match the AI-PLAT platform's teal-to-blue wordmark and primary action treatment. */
.platform-link{border:0;background:linear-gradient(90deg,var(--teal),var(--brand));box-shadow:0 5px 12px rgba(71,138,229,.18);color:#fff}.platform-link:hover{border-color:transparent;color:#fff;box-shadow:0 7px 16px rgba(71,138,229,.28)}.search:focus-within{border-color:#9ed8d4}.doc-tab.active,.doc-tab:hover{color:#3486c9;background:linear-gradient(90deg,#effaf8,#f2f7ff)}.toc-link.active{color:var(--brand);font-weight:700}.part-chapter-link{padding:5px 0;font-size:13px}.eyebrow{color:var(--teal)}.quick-card:hover{border-color:#b9dcdf;box-shadow:0 12px 30px rgba(52,147,174,.09)}.card-number{color:#398ea6}.overview-note{background:#f7fbfb}.search-results{border-color:#cfe9eb;background:#f6fbfc}.result-item{border-color:#dfedf0}.result-item strong{color:#2e5868}.nav-group{margin:0 0 28px}
`;
}

function appScript() {
  return `const panels = Array.from(document.querySelectorAll("[data-doc]"));
const tabs = Array.from(document.querySelectorAll("[data-doc-target]"));
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const lightbox = document.getElementById("lightbox");
const pageToc = document.getElementById("pageToc");
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const sidebarClose = document.getElementById("sidebarClose");
const sidebarScrim = document.getElementById("sidebarScrim");
const readingProgress = document.getElementById("readingProgress");
let searchIndex = [];

function showDoc(slug, shouldFocus = false) {
  const target = panels.find((panel) => panel.dataset.doc === slug) || panels[0];
  panels.forEach((panel) => panel.classList.toggle("active", panel === target));
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.docTarget === target.dataset.doc));
  renderPageToc(target);
  closeSidebar();
  if (shouldFocus) target.focus({ preventScroll: true });
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

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const slug = tab.dataset.docTarget;
    showDoc(slug, true);
  });
});

function renderPageToc(panel) {
  if (!pageToc || !panel) return;
  const headings = Array.from(panel.querySelectorAll("h3, h4"));
  pageToc.innerHTML = headings.map((heading) => \`<a class="level-\${heading.tagName === "H4" ? "3" : "2"}" href="#\${heading.id}">\${escapeHtml(heading.textContent)}</a>\`).join("");
}

function setSidebar(open) {
  sidebar?.classList.toggle("open", open);
  sidebarScrim?.classList.toggle("open", open);
  menuButton?.setAttribute("aria-expanded", String(open));
}
function closeSidebar() { setSidebar(false); }
menuButton?.addEventListener("click", () => setSidebar(!sidebar.classList.contains("open")));
sidebarClose?.addEventListener("click", closeSidebar);
sidebarScrim?.addEventListener("click", closeSidebar);

fetch("search-index.json")
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
      const haystack = [doc.title, doc.subtitle, doc.summary, doc.text].join(" ").toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  searchResults.hidden = false;
  searchResults.innerHTML = matches.length
    ? "<strong>搜索结果</strong>" + matches.map(({ doc }) => \`<a class="result-item" href="#\${doc.slug}" data-doc-target="\${doc.slug}"><strong>\${escapeHtml(doc.subtitle || doc.title)}</strong><span>\${highlight(doc.summary, terms)}</span></a>\`).join("")
    : "<strong>未找到匹配结果</strong><p>可以尝试输入功能名称、页面入口或操作关键词。</p>";
});

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
});

window.addEventListener("scroll", () => {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  if (readingProgress) readingProgress.style.width = height > 0 ? \`\${Math.min(100, window.scrollY / height * 100)}%\` : "0";
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
