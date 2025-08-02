#!/bin/bash

echo "🧪 测试部署配置..."

# 检查 AWS CLI
echo "1. 检查 AWS CLI..."
if command -v aws &> /dev/null; then
    echo "✅ AWS CLI 已安装"
    aws --version
else
    echo "❌ AWS CLI 未安装"
    exit 1
fi

# 检查 AWS 凭证
echo "2. 检查 AWS 凭证..."
if aws sts get-caller-identity &> /dev/null; then
    echo "✅ AWS 凭证有效"
    aws sts get-caller-identity
else
    echo "❌ AWS 凭证无效"
    exit 1
fi

# 检查 S3 存储桶
echo "3. 检查 S3 存储桶..."
BUCKET_NAME="asset-tracker-frontend-869697964701"
if aws s3 ls s3://$BUCKET_NAME &> /dev/null; then
    echo "✅ S3 存储桶存在: $BUCKET_NAME"
else
    echo "❌ S3 存储桶不存在: $BUCKET_NAME"
    exit 1
fi

# 检查前端构建
echo "4. 检查前端构建..."
cd client
if npm run build &> /dev/null; then
    echo "✅ 前端构建成功"
else
    echo "❌ 前端构建失败"
    exit 1
fi

# 检查 dist 文件夹
echo "5. 检查 dist 文件夹..."
if [ -d "dist" ]; then
    echo "✅ dist 文件夹存在"
    ls -la dist/
else
    echo "❌ dist 文件夹不存在"
    exit 1
fi

# 测试 S3 上传
echo "6. 测试 S3 上传..."
if aws s3 sync dist/ s3://$BUCKET_NAME --dryrun &> /dev/null; then
    echo "✅ S3 上传测试成功"
else
    echo "❌ S3 上传测试失败"
    exit 1
fi

echo "🎉 所有测试通过！部署配置正确。"
