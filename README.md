# 日程提醒助手

一个可长期自部署的 Docker 化 Web 管理系统，用来管理纪念日、生日、还款日、缴费日和其他重要事项提醒。项目包含本地账号登录、SQLite 持久化、提醒管理、仪表盘、消息日志、Bark 推送、企业微信应用消息配置，以及按分钟扫描的自动提醒任务。

## 功能概览

- 单用户登录，管理员账号和密码随环境变量同步
- 本地 SQLite 存储，数据库默认放在 `/app/data/reminder.db`
- 提醒事项的新增、编辑、删除、启用、停用、查看日志
- 公历提醒
- 农历提醒
  - 支持 `每年`、`每月`、`每周`、`一次性`
  - 每年：按同一个农历月日逐年换算
  - 每月：按每个农历月的同一天换算，没有对应日子的月份会自动跳过
  - 每周：用所选农历日期换算出的星期作为周提醒锚点
  - 一次性农历提醒会在保存时自动换算成下一次实际公历日期
- 提前提醒、每日多次提醒、多时间点提醒
- Bark 推送
- 企业微信应用消息推送
- 企业微信回复确认，回复 `1`、`好`、`OK` 或 `知道了` 后当前周期不再继续提醒
- 消息日志和仪表盘统计
- 手机、平板、桌面端响应式后台

## 群晖 Synology Container Manager Compose

在群晖的 Container Manager 中新建项目，把下面内容粘贴到 `compose.yaml`。

```yaml
services:
  daily-reminder:
    image: weidaye1122/daily-reminder:latest # 推荐直接使用 Docker Hub 镜像；如果想用 GHCR，可改成 ghcr.io/weidaye1122/daily-reminder:latest
    container_name: daily-reminder # 容器名称，可自定义
    ports:
      - "3000:3000" # 左侧是群晖对外端口，右侧是容器内部端口；如果 3000 已被占用，可改成例如 3010:3000
    volumes:
      - /volume1/docker/daily-reminder/data:/app/data # 请先创建左侧目录；左侧保存数据库和配置，右侧 /app/data 不要改
    environment:
      TZ: Asia/Shanghai # 时区
      PORT: 3000 # Web 服务端口，通常不需要改
      DATABASE_URL: /app/data/reminder.db # SQLite 数据库文件位置，必须放在 /app/data 下才能持久化
      COOKIE_SECURE: "false" # 直接通过 http://群晖IP:3000 访问时保持 false；如果已通过 HTTPS 域名反代访问，可改成 true
      DEFAULT_ADMIN_USERNAME: admin # 管理员账号
      DEFAULT_ADMIN_PASSWORD: change-me-before-start # 管理员密码，首次部署前务必改掉默认密码
      # 通知接口外发限制。
      # 默认不允许访问内网地址，也不允许不安全的 HTTP 地址。
      ALLOW_PRIVATE_NOTIFICATION_URLS: "false"
      ALLOW_INSECURE_NOTIFICATION_URLS: "false"
      NOTIFICATION_REQUEST_TIMEOUT_MS: 10000
      
      # Bark 配置。
      # 可先留空，后续再到网页里填写或调整。
      BARK_SERVER_URL: https://api.day.app
      BARK_DEVICE_KEY: ""
      BARK_ICON_URL: ""
      
      # 企业微信配置。
      # 可先留空，后续再到网页里填写或调整。
      WECOM_CORP_ID: ""
      WECOM_AGENT_ID: ""
      WECOM_SECRET: ""
      WECOM_MESSAGE_PROXY_URL: ""
      WECOM_TOKEN: ""
      WECOM_ENCODING_AES_KEY: ""
      WECOM_TO_USER: "@all"
      
    restart: unless-stopped # 群晖或容器重启后自动恢复
```
部署完成后访问：
```text
http://群晖IP:3000
```
