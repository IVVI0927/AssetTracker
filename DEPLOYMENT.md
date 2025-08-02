# 🚀 Asset Tracker 部署指南

## 部署架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AWS S3        │    │   Vercel        │    │   EC2 Backend   │
│   (Primary)     │    │   (Backup)      │    │   (API Server)  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 部署策略

### 主要部署：AWS S3 + CloudFront
- **优势**: 成本低、性能高、全球CDN
- **适用**: 生产环境

### 备份部署：Vercel
- **优势**: 零配置、自动部署、免费额度
- **适用**: 备用方案、快速原型

## 📋 前置要求

### 1. AWS 账户设置
```bash
# 安装 AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# 配置 AWS 凭证
aws configure
```

### 2. GitHub Secrets 配置
在 GitHub 仓库设置中添加以下 Secrets：

#### AWS 相关
- `AWS_ACCESS_KEY_ID`: AWS 访问密钥ID
- `AWS_SECRET_ACCESS_KEY`: AWS 访问密钥
- `AWS_REGION`: AWS 区域 (如 us-east-1)
- `S3_BUCKET_NAME`: S3 存储桶名称
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront 分发ID

#### 应用相关
- `VITE_API_BASE_URL`: 后端API地址
- `MONGO_URI`: MongoDB 连接字符串
- `JWT_SECRET`: JWT 密钥

#### 部署相关
- `EC2_SSH_KEY`: EC2 SSH 私钥

## 🛠️ 部署步骤

### 1. 创建 AWS 基础设施

```bash
# 部署 CloudFormation 模板
aws cloudformation create-stack \
  --stack-name asset-tracker-infrastructure \
  --template-body file://aws-infrastructure.yml \
  --parameters ParameterKey=DomainName,ParameterValue=your-domain.com \
  --capabilities CAPABILITY_IAM

# 等待部署完成
aws cloudformation wait stack-create-complete \
  --stack-name asset-tracker-infrastructure

# 获取输出信息
aws cloudformation describe-stacks \
  --stack-name asset-tracker-infrastructure \
  --query 'Stacks[0].Outputs'
```

### 2. 配置 S3 存储桶

```bash
# 启用静态网站托管
aws s3 website s3://your-bucket-name --index-document index.html --error-document index.html

# 设置存储桶策略
aws s3api put-bucket-policy --bucket your-bucket-name --policy file://bucket-policy.json
```

### 3. 配置 CloudFront

```bash
# 创建 CloudFront 分发
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json

# 获取分发ID并更新 GitHub Secrets
```

### 4. 手动部署测试

```bash
# 构建前端
cd client
npm run build

# 部署到 S3
npm run deploy:s3

# 部署到 Vercel (备份)
npm run deploy:vercel
```

## 🔄 自动化部署

### GitHub Actions 工作流

#### 前端部署 (`deploy-s3.yml`)
- 触发条件: `client/**` 文件变更
- 部署目标: AWS S3 + CloudFront
- 备份部署: Vercel

#### 后端部署 (`deploy-backend.yml`)
- 触发条件: `server/**` 文件变更
- 部署目标: EC2 + PM2

## 📊 监控和维护

### 1. 性能监控
```bash
# 检查 CloudFront 缓存命中率
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID

# 检查 S3 访问日志
aws s3api get-bucket-logging --bucket your-bucket-name
```

### 2. 成本优化
- 启用 S3 生命周期策略
- 配置 CloudFront 缓存策略
- 监控数据传输费用

### 3. 安全加固
- 启用 S3 版本控制
- 配置 CloudFront 安全头
- 定期轮换访问密钥

## 🚨 故障排除

### 常见问题

#### 1. S3 部署失败
```bash
# 检查权限
aws s3 ls s3://your-bucket-name

# 检查存储桶策略
aws s3api get-bucket-policy --bucket your-bucket-name
```

#### 2. CloudFront 缓存问题
```bash
# 创建缓存失效
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

#### 3. Vercel 部署失败
```bash
# 检查 Vercel 配置
vercel --debug

# 查看部署日志
vercel logs
```

## 📈 性能优化

### 1. 前端优化
- 启用 gzip 压缩
- 配置缓存策略
- 使用 CDN 加速

### 2. 后端优化
- 启用 PM2 集群模式
- 配置 Nginx 反向代理
- 启用数据库连接池

## 🔐 安全最佳实践

### 1. 环境变量管理
- 使用 GitHub Secrets
- 定期轮换密钥
- 最小权限原则

### 2. 网络安全
- 启用 HTTPS
- 配置 CORS 策略
- 实施速率限制

### 3. 数据安全
- 启用数据库加密
- 定期备份数据
- 监控异常访问

## 📞 支持

如有问题，请检查：
1. GitHub Actions 日志
2. AWS CloudWatch 日志
3. Vercel 部署日志
4. 应用错误日志 