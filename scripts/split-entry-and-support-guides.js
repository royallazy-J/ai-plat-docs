const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const archiveDir = path.join(root, "source");

function readGuide(file) {
  const sourcePath = fs.existsSync(path.join(root, file))
    ? path.join(root, file)
    : path.join(archiveDir, file);
  return fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
}

function section(source, number) {
  const heading = new RegExp(`^## ${number.replace(".", "\\.")} [^\\n]+$`, "m");
  const start = source.search(heading);
  if (start < 0) throw new Error(`Section ${number} was not found.`);
  const afterHeading = source.slice(start).replace(heading, "").replace(/^\n+/, "");
  const end = afterHeading.search(/\n## /);
  return (end < 0 ? afterHeading : afterHeading.slice(0, end)).trim();
}

function namedSection(source, title) {
  const heading = new RegExp(`^## ${title}$`, "m");
  const start = source.search(heading);
  if (start < 0) return "";
  return source.slice(start).replace(heading, "").replace(/^\n+/, "").trim();
}

function document(title, intro, body) {
  return `# AI-PLAT 用户手册\n\n## ${title}\n\n${intro}\n\n---\n\n${body.trim()}\n`;
}

const entryName = "AI-PLAT用户手册-01试用准备与平台入门.md";
const supportName = "AI-PLAT用户手册-03场景教程与支持附录.md";
const entry = readGuide(entryName);
const support = readGuide(supportName);

const docs = [
  {
    file: "AI-PLAT用户手册-01-00试用准备与平台入门总览.md",
    title: "第一部分：使用准备与平台入门",
    intro: "本部分帮助首次使用 AI-PLAT 的用户完成阅读定位、账号准备、平台登录和项目进入。可按顺序完成，也可根据当前问题直接进入对应小节。",
    body: `### 推荐阅读顺序\n\n了解平台与适用对象 -> 完成账号、浏览器和数据准备 -> 登录并配置账号 -> 认识平台首页和项目入口。\n\n### 本部分包含\n\n| 子章节 | 适用任务 |\n| --- | --- |\n| 01 文档说明与平台概览 | 了解平台定位、核心能力和适用场景 |\n| 02 适用对象 | 确认不同角色的职责和权限范围 |\n| 03 使用前准备 | 完成账号、浏览器、数据和权限检查 |\n| 04 平台登录与账号配置 | 注册、登录、修改用户名和找回密码 |\n| 05 平台首页与项目介绍 | 认识首页布局、项目概念并加入项目 |\n\n### 开始前检查\n\n请准备可用的网络环境、平台账号或注册邮箱；如需要进入已有项目，请提前联系项目管理员获取邀请或权限。`
  },
  { file: "AI-PLAT用户手册-01-01文档说明与平台概览.md", title: "01 文档说明与平台概览", intro: "了解 AI-PLAT 的定位、核心能力和适用场景。", body: section(entry, "1.") },
  { file: "AI-PLAT用户手册-01-02适用对象.md", title: "02 适用对象", intro: "确认不同平台角色在项目中的典型职责。", body: section(entry, "2.") },
  { file: "AI-PLAT用户手册-01-03使用前准备.md", title: "03 使用前准备", intro: "在正式操作前完成账号、环境、数据和权限检查。", body: section(entry, "3.") },
  { file: "AI-PLAT用户手册-01-04平台登录与账号配置.md", title: "04 平台登录与账号配置", intro: "完成注册、登录和常用账号信息配置。", body: section(entry, "4.") },
  { file: "AI-PLAT用户手册-01-05平台首页与项目介绍.md", title: "05 平台首页与项目介绍", intro: "认识工作台与项目空间，为后续核心功能操作做好准备。", body: section(entry, "5.") },
  {
    file: "AI-PLAT用户手册-03-00场景教程与支持附录总览.md",
    title: "第三部分：场景教程与支持附录",
    intro: "本部分用于培训演示、交付复盘和日常支持。通过典型场景、常见问题、检查清单和支持方式，帮助用户完成核心操作后的验证与收尾。",
    body: `### 推荐阅读顺序\n\n按典型场景完成一次完整操作验证 -> 根据 FAQ 排查问题 -> 使用检查清单复核交付 -> 通过支持方式提交问题。\n\n### 本部分包含\n\n| 子章节 | 适用任务 |\n| --- | --- |\n| 01 典型场景操作教程 | 按真实业务链路完成训练、预测和部署验证 |\n| 02 常见问题 FAQ | 快速定位账号、资源、工作流和部署问题 |\n| 03 使用检查清单 | 交付或验收前逐项复核 |\n| 04 联系支持方式 | 明确问题反馈所需信息和联系渠道 |\n| 05 后续可补充内容 | 规划后续高级文档扩展 |\n| 06 版本记录与手册结束 | 查看文档版本并完成阅读收尾 |\n\n### 使用建议\n\n遇到具体问题时可直接进入 FAQ；进行培训、交付或验收时，建议按典型场景和检查清单顺序阅读。`
  },
  { file: "AI-PLAT用户手册-03-01典型场景操作教程.md", title: "01 典型场景操作教程", intro: "通过典型任务串联项目、资源、训练、预测和部署操作。", body: section(support, "1.") },
  { file: "AI-PLAT用户手册-03-02常见问题FAQ.md", title: "02 常见问题 FAQ", intro: "针对常见的登录、资源、标注、工作流和部署问题提供排查方向。", body: section(support, "2.") },
  { file: "AI-PLAT用户手册-03-03使用检查清单.md", title: "03 使用检查清单", intro: "在培训、交付或验收前复核关键操作是否完成。", body: section(support, "3.") },
  { file: "AI-PLAT用户手册-03-04联系支持方式.md", title: "04 联系支持方式", intro: "整理问题现象和必要信息后，通过合适渠道获取支持。", body: section(support, "4.") },
  { file: "AI-PLAT用户手册-03-05后续可补充内容.md", title: "05 后续可补充内容", intro: "了解后续可扩展的高级使用文档方向。", body: section(support, "5.") },
  { file: "AI-PLAT用户手册-03-06版本记录与手册结束.md", title: "06 版本记录与手册结束", intro: "查看版本信息，并完成本套用户手册的阅读。", body: `${section(support, "6.")}\n\n### 手册结束说明\n\n${namedSection(support, "手册结束说明")}` }
];

for (const doc of docs) {
  fs.writeFileSync(path.join(root, doc.file), document(doc.title, doc.intro, doc.body), "utf8");
}

fs.mkdirSync(archiveDir, { recursive: true });
for (const name of [entryName, supportName]) {
  const original = path.join(root, name);
  if (fs.existsSync(original)) fs.renameSync(original, path.join(archiveDir, name));
}

console.log(`Created ${docs.length} entry and support guide chapters.`);
