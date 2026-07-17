const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const legacyName = "AI-PLAT用户手册-02核心功能操作指南.md";
const legacyPath = path.join(root, legacyName);
const archivePath = path.join(root, "source", legacyName);
const sourcePath = fs.existsSync(legacyPath) ? legacyPath : archivePath;
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");

function section(number) {
  const heading = new RegExp(`^### ${number.replace(".", "\\.")} [^\\n]+$`, "m");
  const start = source.search(heading);
  if (start < 0) throw new Error(`Section ${number} was not found.`);
  const afterHeading = source.slice(start).replace(heading, "").replace(/^\n+/, "");
  const end = afterHeading.search(/\n### \d+\.\d+ |\n## 下一步阅读/);
  return (end < 0 ? afterHeading : afterHeading.slice(0, end)).trim();
}

function document(title, intro, body, next) {
  return `# AI-PLAT 用户手册\n\n## ${title}\n\n${intro}\n\n---\n\n${body.trim()}\n\n---\n\n## 下一步操作\n\n${next}\n`;
}

function replaceHeading(body, from, to) {
  return body.replace(new RegExp(`^### ${from.replace(".", "\\.")} [^\\n]+`, "m"), `### ${to}`);
}

const project = section("1.1");
const component = section("1.2");
const dataset = section("1.3");
const model = section("1.4");
const download = section("1.5");
const labelTask = section("1.6");
const labeling = section("1.7");
const imageWorkflow = section("1.8");
const training = section("1.9");
const prediction = section("1.10");
const runConfig = section("1.11");
const publish = section("1.12");
const quickDeploy = section("1.13");
const production = section("1.14");

const [projectSetup, memberSetup = ""] = project.split("\n添加成员入口：");
const [componentGet, componentCheck = ""] = component.split("\n查看项目组件：");

const docs = [
  {
    file: "AI-PLAT用户手册-02-01项目与组件准备.md",
    title: "01 项目与组件准备",
    intro: "本章用于完成进入 AI-PLAT 后的项目初始化。完成项目、成员、算力和组件准备后，即可开始管理数据与模型资源。",
    body: `### 1.1 本章目标与使用角色\n\n适用对象：项目管理员、AI 生产工程师和需要参与项目协作的成员。开始前请确认账号已完成登录，并已获得项目创建或加入项目的权限。\n\n### 1.2 新建项目与分配资源\n\n${projectSetup.trim()}\n\n### 1.3 添加成员与角色管理\n\n添加成员入口：${memberSetup.trim()}\n\n### 1.4 从资产广场获取组件\n\n${componentGet.trim()}\n\n### 1.5 检查项目可用组件\n\n查看项目组件：${componentCheck.trim()}\n\n### 1.6 结果检查\n\n完成后，项目中应已具备可用成员、算力资源和后续标注、工作流或部署所需的算法组件。`,
    next: "继续阅读《02 数据与模型资源管理》，上传训练、测试或标注所需的数据和模型。"
  },
  {
    file: "AI-PLAT用户手册-02-02数据与模型资源管理.md",
    title: "02 数据与模型资源管理",
    intro: "本章说明如何将业务数据和已有模型纳入项目，并完成版本、预览、下载等资源管理操作。",
    body: `### 2.1 数据集概览与创建方式\n\n${dataset.replace(/^功能用途：[\s\S]*?(?=#### 上传图片数据集)/m, (value) => value.replace(/^功能用途：/, "功能用途：")).replace(/^#### 上传图片数据集/m, "### 2.2 创建图片数据集").replace(/^#### 上传表格数据集/m, "### 2.3 创建表格数据集").replace(/^#### 上传文本数据集/m, "### 2.4 创建文本数据集")}\n\n### 2.5 上传模型与创建模型版本\n\n${model}\n\n### 2.6 下载、复制与删除资源\n\n${download}\n\n### 2.7 结果检查\n\n确认目标数据集或模型已出现在项目列表中，并核对资源名称、版本、来源、预览内容和访问权限。`,
    next: "如需要人工标注图片，请继续阅读《03 数据标注与审核》；如数据已准备完成，可进入工作流和训练章节。"
  },
  {
    file: "AI-PLAT用户手册-02-03数据标注与审核.md",
    title: "03 数据标注与审核",
    intro: "本章用于将图片数据转化为可训练的标注数据，并说明标注任务分派、在线标注、提交和结果检查的完整流程。",
    body: `### 3.1 标注前准备\n\n开始前请确认：待标注图片已上传；项目已获取标签标注组件；已明确任务类型、标签名称和负责人。标签名称应与后续训练使用的类别保持一致。\n\n### 3.2 创建标签标注任务\n\n${labelTask}\n\n### 3.3 使用 Labeling 工具标注与提交\n\n${labeling}\n\n### 3.4 审核与结果检查\n\n提交后，请在数据集详情或任务状态中确认标注结果已生成，并抽查图片、标签类别和标注区域是否符合预期。`,
    next: "标注结果确认无误后，可继续阅读《04 工作流编排与运行》或直接进入模型训练。"
  },
  {
    file: "AI-PLAT用户手册-02-04工作流编排与运行.md",
    title: "04 工作流编排与运行",
    intro: "本章介绍通用工作流的创建、组件连接、输入输出配置与运行管理方法，是数据处理、训练和预测操作的共同基础。",
    body: `### 4.1 工作流与组件关系说明\n\n工作流通过组件、资源和连线串联具体任务。开始前请确认输入数据、目标输出和所需组件均已准备完成。\n\n### 4.2 创建图像处理工作流\n\n${imageWorkflow}\n\n### 4.3 立即运行、预约运行与设备选择\n\n${runConfig}\n\n### 4.4 结果检查\n\n运行结束后，请查看工作流状态、元件日志和输出资源；异常时优先核对组件参数、资源格式和算力设备。`,
    next: "需要生成新模型时，请继续阅读《05 模型训练与预测验证》。"
  },
  {
    file: "AI-PLAT用户手册-02-05模型训练与预测验证.md",
    title: "05 模型训练与预测验证",
    intro: "本章将训练数据、训练组件和测试资源串成完整模型生产链路，并通过预测结果检查模型效果。",
    body: `### 5.1 训练前检查清单\n\n请确认训练数据、标签类别、训练组件、算力资源和输出模型命名规则均已准备完成。\n\n### 5.2 创建并运行模型训练工作流\n\n${training}\n\n### 5.3 创建模型预测工作流\n\n${prediction}\n\n### 5.4 结果检查\n\n训练完成后，在模型列表确认新模型及其版本；预测完成后，在输出数据集预览画框、标签和评估报告。`,
    next: "模型验证通过后，请继续阅读《06 模型发布与快速部署》。"
  },
  {
    file: "AI-PLAT用户手册-02-06模型发布与快速部署.md",
    title: "06 模型发布与快速部署",
    intro: "本章用于将验证通过的模型发布为可选资产，并通过临时 Demo 或 API 部署进行展示、联调和效果验证。",
    body: `### 6.1 发布前检查\n\n发布前请确认模型版本、标签类别、适用场景和适用范围准确，并确认模型已完成必要的效果验证。\n\n### 6.2 发布模型与查看状态\n\n${publish}\n\n### 6.3 创建快速 Demo 或 API 部署\n\n${quickDeploy.replace(/^#### 新建快速 Demo/m, "#### 6.3.1 新建快速 Demo").replace(/^#### 新建 API 部署/m, "#### 6.3.2 新建 API 部署")}\n\n### 6.4 验证、终止与释放临时部署\n\n完成展示或接口联调后，请核对部署状态、访问结果和剩余时长；不再使用时及时终止临时部署，释放算力资源。`,
    next: "如需为业务系统长期稳定提供服务，请继续阅读《07 生产部署与运维管理》。"
  },
  {
    file: "AI-PLAT用户手册-02-07生产部署与运维管理.md",
    title: "07 生产部署与运维管理",
    intro: "本章面向长期运行的业务服务，说明部署准备、服务创建、首次验证、状态监控、更新回退和安全注意事项。",
    body: `### 7.1 生产部署适用场景与角色\n\n生产部署适用于已完成模型验证、需要稳定对外提供接口的场景。AI 生产工程师负责准备模型和部署方案，运维人员负责资源、日志和运行状态，项目管理员负责权限与变更管理。\n\n### 7.2 部署前准备与产品获取\n\n${production.replace(/^功能用途：[\s\S]*?(?=#### 获取产品至项目)/m, (value) => value.replace(/^功能用途：/, "功能用途：")).replace(/^#### 获取产品至项目/m, "### 7.3 获取产品至项目").replace(/^#### 新建生产部署/m, "### 7.4 新建或更新生产部署").replace(/^#### 生产部署管理/m, "### 7.5 监控、更新与回退")}`,
    next: "完成生产服务上线后，可继续阅读《AI-PLAT 用户手册 · 第三部分：场景教程与支持附录》，获取场景化实践与问题排查支持。"
  }
];

for (const doc of docs) {
  fs.writeFileSync(path.join(root, doc.file), document(doc.title, doc.intro, doc.body, doc.next), "utf8");
}

const archiveDir = path.join(root, "source");
fs.mkdirSync(archiveDir, { recursive: true });
if (fs.existsSync(legacyPath)) fs.renameSync(legacyPath, path.join(archiveDir, legacyName));
console.log(`Created ${docs.length} core guide chapters.`);
