# AI-PLAT 文档离线部署

此站点是纯静态网页，不需要数据库、Node.js 服务或外网访问。构建后，把 `site` 文件夹部署到客户内网的 Nginx 或 IIS 即可。

## 1. 打包前设置平台内网地址

在项目目录执行以下命令。把示例地址替换为客户实际的 AI-PLAT 内网地址：

```bash
export PLATFORM_URL="http://ai-plat.intra/"
npm run package:offline
```

打包结果在：

```text
release/ai-plat-docs-offline/
```

其中：

- `site/`：需要部署的网站文件
- `nginx.conf`：Nginx 配置模板
- `README.md`：本说明

在 Windows PowerShell 中，可使用：

```powershell
$env:PLATFORM_URL = "http://ai-plat.intra/"
npm run package:offline
```

## 2. Nginx 部署

1. 把 `release/ai-plat-docs-offline` 整个文件夹传到客户内网服务器。
2. 将 `site/` 放到服务器路径，例如 `/opt/ai-plat-docs/site/`。
3. 将 `nginx.conf` 放到 Nginx 的站点配置目录，并确认其中的 `root` 路径与实际位置一致。
4. 检查并重载 Nginx：

```bash
nginx -t
nginx -s reload
```

5. 在客户内网访问服务器地址，例如 `http://docs.intra/`。

## 3. IIS 部署

1. 在 IIS 新建网站，将“物理路径”指向 `site/` 文件夹。
2. 绑定客户内网域名或服务器 IP 与端口。
3. 使用浏览器打开该内网地址验证首页、文档目录、搜索和图片。

## 注意事项

- 文档站点可完全离线运行；但“进入 AI-PLAT 平台”按钮需要指向客户内网已部署的平台地址。
- 不要把 `账号密码信息.md` 放入离线包或交付给客户。
- 每次更新文档后，重新执行打包命令并替换服务器上的 `site/` 文件夹即可。
