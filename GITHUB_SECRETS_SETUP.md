# 🔐 GitHub Secrets 配置指南

## 📋 需要配置的 Secrets

在 GitHub 仓库中，进入 **Settings** → **Secrets and variables** → **Actions**，添加以下 Secrets：

### AWS 相关 Secrets

| Secret 名称 | 值 | 说明 |
|------------|----|----|
| `AWS_ACCESS_KEY_ID` | `AKIA4U7QJZKOSBAQV4LI` | AWS 访问密钥 ID |
| `AWS_SECRET_ACCESS_KEY` | `qMZ3KtfzfiuuvfCOFc91tJd7hcFrN2ZvNS60EpQK` | AWS 访问密钥 |
| `AWS_REGION` | `us-east-2` | AWS 区域 |
| `S3_BUCKET_NAME` | `asset-tracker-frontend-869697964701` | S3 存储桶名称 |

### 应用相关 Secrets

| Secret 名称 | 值 | 说明 |
|------------|----|----|
| `VITE_API_BASE_URL` | `https://18.217.234.231:5050` | 后端 API 地址 |

## 🛠️ 配置步骤

### 1. 进入 GitHub 仓库设置
1. 打开你的 GitHub 仓库
2. 点击 **Settings** 标签
3. 在左侧菜单中点击 **Secrets and variables**
4. 选择 **Actions**

### 2. 添加 Secrets
1. 点击 **New repository secret**
2. 输入 Secret 名称（如 `AWS_ACCESS_KEY_ID`）
3. 输入对应的值
4. 点击 **Add secret**

### 3. 验证配置
所有 Secrets 添加完成后，你应该看到以下列表：

```
✅ AWS_ACCESS_KEY_ID
✅ AWS_SECRET_ACCESS_KEY  
✅ AWS_REGION
✅ S3_BUCKET_NAME
✅ VITE_API_BASE_URL
```

## 🔄 自动化部署流程

### 前端部署触发条件
- 推送到 `main` 分支
- 修改了 `client/**` 路径下的文件

### 部署步骤
1. **前端部署** (`deploy-s3.yml`)
   - 检出代码
   - 安装依赖
   - 设置环境变量
   - 构建前端
   - 配置 AWS 凭证
   - 上传到 S3
   - 部署到 Vercel（备份）

## 🔧 测试自动化部署

### 测试前端部署
```bash
# 修改前端代码
echo "// test comment" >> client/src/App.jsx

# 提交并推送
git add .
git commit -m "test: frontend deployment"
git push origin main
```

## 📊 监控部署状态

### 查看部署日志
1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 查看最新的工作流运行状态
4. 点击具体的工作流查看详细日志

## 📞 故障排除

如果部署失败，请检查：
1. GitHub Actions 日志
2. AWS 凭证是否正确
3. 网络连接是否正常
