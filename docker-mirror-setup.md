# Docker 中国镜像源配置指南

## macOS Docker Desktop 配置方法

1. 打开 Docker Desktop
2. 点击设置图标（齿轮图标）
3. 选择 "Docker Engine" 选项卡
4. 在 JSON 配置中添加以下内容：

```json
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn",
    "https://registry.docker-cn.com",
    "https://docker.m.daocloud.io"
  ]
}
```

5. 点击 "Apply & restart" 按钮重启 Docker

## Linux 系统配置方法

1. 创建或编辑 `/etc/docker/daemon.json` 文件：

```bash
sudo mkdir -p /etc/docker
sudo cp daemon.json /etc/docker/daemon.json
```

2. 重启 Docker 服务：

```bash
sudo systemctl restart docker
```

## 验证配置

运行以下命令验证配置是否生效：

```bash
docker info | grep -A 5 "Registry Mirrors"
```

## 使用 docker-compose

配置完成后，可以正常使用 docker-compose：

```bash
docker-compose up -d
```

## 镜像源说明

- **腾讯云镜像**: https://mirror.ccs.tencentyun.com
- **中科大镜像**: https://docker.mirrors.ustc.edu.cn
- **Docker 中国官方镜像**: https://registry.docker-cn.com
- **DaoCloud 镜像**: https://docker.m.daocloud.io

如果某个镜像源不可用，Docker 会自动尝试下一个镜像源。