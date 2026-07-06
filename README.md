# AI-PLAT 用户文档网页服务

这是一个面向 AI-PLAT 使用手册的轻量文档站。当前会自动收录根目录下的公开 Markdown 手册，并复制 `images/` 中的截图资源，生成可部署的静态网页。

## 当前能力

- 专业简约的文档首页、左侧目录和章节导航
- 全文搜索
- Markdown 表格、列表、引用、代码和图片渲染
- 截图点击放大预览
- “进入平台”快捷入口
- 账号密码文件默认不发布，避免凭据出现在公网文档中

## 本地构建与启动

```bash
npm run build
npm start
```

默认监听：

```text
http://0.0.0.0:8080
```

如需指定端口：

```bash
PORT=3000 npm start
```

如只在本机预览：

```bash
HOST=127.0.0.1 PORT=8080 npm start
```

## 公网部署建议

把整个文件夹放到公网服务器后执行：

```bash
npm run build
HOST=0.0.0.0 PORT=8080 npm start
```

然后在防火墙或云服务器安全组中放行对应端口。正式环境建议再通过 Nginx、宝塔、1Panel 或平台网关把域名反向代理到该服务，例如：

```nginx
location /docs/ {
  proxy_pass http://127.0.0.1:8080/;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

平台侧文档入口可以配置为：

```text
https://你的域名/docs/
```

## 后续更新文档

1. 把新的 `.md` 手册放到项目根目录。
2. 把新增截图放到 `images/` 目录。
3. 在 Markdown 中使用相对路径引用图片，例如：

```markdown
![数据集列表](images/dataset-list.png)
```

4. 重新执行：

```bash
npm run build
```

## 公开内容说明

`账号密码信息.md` 不会进入公开站点。构建脚本只会读取其中的平台访问地址，用于页面右上角“进入平台”按钮，不会发布账号或密码。
