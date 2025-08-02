module.exports = {
  // S3 部署配置
  s3: {
    bucket: process.env.S3_BUCKET_NAME || 'your-asset-tracker-bucket',
    region: process.env.AWS_REGION || 'us-east-1',
    acl: 'public-read',
    delete: true, // 删除旧文件
    gzip: true,   // 启用 gzip 压缩
  },
  
  // CloudFront 配置
  cloudfront: {
    distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    invalidationPaths: ['/*'],
  },
  
  // 构建配置
  build: {
    source: 'dist',
    destination: '/',
    cacheControl: {
      '*.html': 'no-cache',
      '*.js': 'public, max-age=31536000',
      '*.css': 'public, max-age=31536000',
      '*.png': 'public, max-age=31536000',
      '*.jpg': 'public, max-age=31536000',
      '*.svg': 'public, max-age=31536000',
    },
  },
}; 