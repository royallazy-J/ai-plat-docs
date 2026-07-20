# AI-PLAT 文档 Kubernetes 部署

此目录将文档站点作为独立的静态服务部署到现有 AI-PLAT Kubernetes 集群。

推荐使用独立的内网域名：

```text
平台：http://ai-plat.intra/
文档：http://docs.ai-plat.intra/
```

## 1. 构建镜像

在有 Docker 的构建机器上执行。先将平台地址替换为客户内网地址：

```bash
export PLATFORM_URL="http://ai-plat.intra/"
npm run build
docker build --platform linux/amd64 -t ai-plat-docs:1.0.0 .
```

如果从 `npm run package:offline` 生成的离线包目录构建镜像，执行：

```bash
docker build --platform linux/amd64 --build-arg SITE_DIR=site -t ai-plat-docs:1.0.0 .
```

## 2. 导出并导入离线镜像

在构建机器导出：

```bash
docker save ai-plat-docs:1.0.0 -o ai-plat-docs-1.0.0.tar
```

将该文件传到客户内网后，在可访问客户私有镜像仓库的机器执行：

```bash
docker load -i ai-plat-docs-1.0.0.tar
docker tag ai-plat-docs:1.0.0 registry.customer.local/ai-plat/ai-plat-docs:1.0.0
docker push registry.customer.local/ai-plat/ai-plat-docs:1.0.0
```

将 `registry.customer.local` 替换为客户实际的内网镜像仓库地址。

## 3. 修改部署参数

部署前请修改以下占位值：

- `deployment.yaml`：`namespace` 和 `image`
- `ingress.yaml`：`host`，改为客户文档内网域名
- 若集群 IngressClass 不是 Nginx，修改 `ingressClassName`

## 4. 部署与验证

```bash
kubectl apply -f deployment/k8s/deployment.yaml
kubectl apply -f deployment/k8s/service.yaml
kubectl apply -f deployment/k8s/ingress.yaml

kubectl -n ai-plat rollout status deployment/ai-plat-docs
kubectl -n ai-plat get pods,svc,ingress
```

在客户内网打开文档域名，检查首页、文档目录、搜索、图片及“进入 AI-PLAT 平台”按钮。

## 更新文档

更新 Markdown 或图片后，重新构建并推送一个新镜像标签，例如 `1.0.1`，再修改 `deployment.yaml` 中的镜像版本并执行：

```bash
kubectl apply -f deployment/k8s/deployment.yaml
kubectl -n ai-plat rollout status deployment/ai-plat-docs
```
