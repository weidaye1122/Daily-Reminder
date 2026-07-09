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

## 技术栈

- 前端：React + Vite + TypeScript
- 后端：Express + TypeScript
- 数据库：SQLite
- 日期处理：`dayjs`、`lunar-typescript`
- 密码存储：`bcryptjs`

## 本地开发

1. 准备环境变量：

```bash
cp .env.example .env
```

2. 安装依赖：

```bash
pnpm install
```

3. 启动开发环境：

```bash
pnpm dev
```

默认前端地址：

- `http://localhost:5173`

默认后端地址：

- `http://localhost:3000`

## Docker 部署

发布配置中的容器镜像标签：

- GitHub Container Registry：`ghcr.io/weidaye1122/schedule-reminder-assistant:latest`
- Docker Hub：`weidaye1122/schedule-reminder-assistant:latest`
- 固定版本标签：`1.0.0`
- 最新版本标签：`latest`

### 本地 Docker Compose

1. 创建环境变量文件：

```bash
cp .env.example .env
```

2. 修改 `.env` 中的管理员密码，并根据需要填写 Bark、企业微信配置。生产环境不能使用示例密码。

3. 构建并启动：

```bash
docker compose up -d --build
```

4. 打开：

- `http://localhost:3000`

### `docker-compose.yml`

```yaml
services:
  schedule-reminder:
    build: .
    container_name: schedule-reminder
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    restart: unless-stopped
```

### 群晖 Synology Container Manager Compose

在群晖的 Container Manager 中新建项目，把下面内容粘贴到 `compose.yaml`。建议先在 File Station 中创建 `/volume1/docker/schedule-reminder/data`，这个目录会保存数据库和所有配置。

```yaml
services:
  schedule-reminder:
    # 推荐使用 Docker Hub 镜像，群晖拉取通常更直接。
    # 如想使用 GHCR，可改为：
    # image: ghcr.io/weidaye1122/schedule-reminder-assistant:latest
    image: weidaye1122/schedule-reminder-assistant:latest

    # 容器名称，可按需要修改。
    container_name: schedule-reminder

    # 端口映射：左侧 3000 是群晖访问端口，右侧 3000 是容器内部端口。
    # 如果群晖 3000 已被占用，可以把左侧改成 3010，例如 "3010:3000"。
    ports:
      - "3000:3000"

    # 数据持久化目录。
    # 左侧是群晖 NAS 上的目录，右侧 /app/data 不要改。
    # 只要保留这个目录，升级或重建容器后数据都还在。
    volumes:
      - /volume1/docker/schedule-reminder/data:/app/data

    environment:
      # 时区，建议保持 Asia/Shanghai。
      TZ: Asia/Shanghai

      # Web 服务端口，通常不需要改。
      PORT: 3000

      # SQLite 数据库路径，必须放在 /app/data 下才能持久化。
      DATABASE_URL: /app/data/reminder.db

      # 登录 Cookie 是否只允许 HTTPS。
      # 群晖用 http://群晖IP:3000 访问时保持 false，否则刷新后浏览器可能不会保留登录。
      # 如果你已经通过 HTTPS 域名访问，可以改成 true。
      COOKIE_SECURE: "false"

      # 管理员账号和密码。
      # 修改后重启容器即可同步到系统，登录请使用这里填写的值。
      DEFAULT_ADMIN_USERNAME: admin
      DEFAULT_ADMIN_PASSWORD: change-me-before-start

      # 通知接口外发安全限制。
      # 默认拦截内网/本机地址；Bark HTTP 需显式放开，企业微信代理支持 HTTP/HTTPS。
      ALLOW_PRIVATE_NOTIFICATION_URLS: "false"
      ALLOW_INSECURE_NOTIFICATION_URLS: "false"
      NOTIFICATION_REQUEST_TIMEOUT_MS: 10000

      # Bark 配置，可先留空，之后在网页“通知渠道”里填写。
      BARK_SERVER_URL: https://api.day.app
      BARK_DEVICE_KEY: ""
      BARK_ICON_URL: ""

      # 企业微信配置，可先留空，之后在网页“通知渠道”里填写。
      # 如果使用企业微信消息代理地址，也可以后续在网页中填写。
      WECOM_CORP_ID: ""
      WECOM_AGENT_ID: ""
      WECOM_SECRET: ""
      WECOM_MESSAGE_PROXY_URL: ""
      WECOM_TOKEN: ""
      WECOM_ENCODING_AES_KEY: ""
      WECOM_TO_USER: "@all"

    # 群晖或容器重启后自动恢复。
    restart: unless-stopped
```

部署完成后访问：

```text
http://群晖IP:3000
```

## 管理员账号

系统启动时会读取下面两个环境变量，并把管理员账号同步为这里填写的用户名和密码。以后需要修改用户名或密码时，直接修改环境变量并重启服务即可：

```env
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change-me-before-start
```

如果数据库里还没有用户，系统会自动创建管理员账号；如果已经存在用户，系统会更新第一个管理员账号的用户名和密码，并清理旧登录会话。生产环境必须把 `DEFAULT_ADMIN_PASSWORD` 改成你自己的强密码，不能留空或使用示例值。

## 环境变量说明

```env
TZ=Asia/Shanghai
PORT=3000
DATABASE_URL=/app/data/reminder.db
COOKIE_SECURE=false

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change-me-before-start

ALLOW_PRIVATE_NOTIFICATION_URLS=false
ALLOW_INSECURE_NOTIFICATION_URLS=false
NOTIFICATION_REQUEST_TIMEOUT_MS=10000

BARK_SERVER_URL=https://api.day.app
BARK_DEVICE_KEY=
BARK_ICON_URL=

WECOM_CORP_ID=
WECOM_AGENT_ID=
WECOM_SECRET=
WECOM_MESSAGE_PROXY_URL=
WECOM_TOKEN=
WECOM_ENCODING_AES_KEY=
WECOM_TO_USER=@all
```

说明：

- `TZ`：调度任务使用的默认时区
- `DATABASE_URL`：SQLite 数据库路径
- `COOKIE_SECURE`：是否只允许 HTTPS 保存登录 Cookie，普通 HTTP 访问请保持 `false`
- `DEFAULT_ADMIN_*`：管理员账号和密码，服务启动时会自动同步
- `ALLOW_PRIVATE_NOTIFICATION_URLS`：是否允许 Bark / 企业微信代理地址指向内网或本机地址，默认 `false`
- `ALLOW_INSECURE_NOTIFICATION_URLS`：是否允许 Bark Server 地址使用 HTTP；企业微信代理地址已支持 HTTP 和 HTTPS
- `NOTIFICATION_REQUEST_TIMEOUT_MS`：通知接口请求超时时间，默认 `10000`
- `BARK_*` 和 `WECOM_*`：可选的初始通知配置，后续也可在 Web 页面修改

## Bark 配置说明

在“通知渠道”页面中填写：

- Bark Server 地址
- Device Key
- 默认标题
- 默认铃声
- 分组
- 图标地址
- 是否自动复制

图标地址会作为 Bark 的 `icon` 参数发送，用来替换默认 Bark 推送图标。建议填写公网可访问的图片 URL。填写后可以直接点击“测试 Bark 推送”。

## 企业微信应用配置说明

在“通知渠道”页面中填写：

- 企业ID
- 应用AgentId
- 应用Secret
- 消息代理地址（可选，不填默认使用 `https://qyapi.weixin.qq.com`）
- Token
- Encoding_AES
- 指定接收人

系统会自动：

- 获取 `access_token`
- 缓存 token
- 过期前自动刷新

如果服务器访问企业微信官方接口不稳定，可以在“消息代理地址”中填写反向代理地址，支持 `http://` 和 `https://`。系统会把 `gettoken` 和 `message/send` 两个接口请求都发送到这个基础地址下，例如填写 `http://proxy.example.com/wecom` 或 `https://proxy.example.com/wecom` 后，请代理转发：

- `/wecom/cgi-bin/gettoken`
- `/wecom/cgi-bin/message/send`

填写后可以直接点击“测试企业微信推送”。

出于安全考虑，通知外发地址默认会拦截内网或本机地址；Bark Server 默认只允许 HTTPS。企业微信消息代理地址支持 HTTP 和 HTTPS，但如果代理指向内网或本机地址，仍需要在部署环境中把 `ALLOW_PRIVATE_NOTIFICATION_URLS` 显式设为 `true`。

### 企业微信回复确认

企业微信后台的应用回调 URL 填写：

```text
https://你的访问域名/api/wecom/callback
```

Token 和 Encoding_AES 需要与“通知渠道”页面中填写的内容保持一致。正式提醒发出后，在企业微信中回复 `1`、`好`、`ok`、`OK` 或 `知道了`，系统会把该提醒的当前周期标记为已确认，后续时间点会跳过；下一次周期会重新正常提醒。测试推送不会进入确认周期。

## 公历 / 农历说明

- 公历提醒支持 `每年`、`每月`、`每周`、`一次性`
- 农历提醒支持 `每年`、`每月`、`每周`、`一次性`
- 农历日期由后端换算，实际提醒以服务器计算结果为准
- 选择闰月时，如果当前农历年没有对应闰月，系统会提示并按下一个可换算年份计算
- 选择农历三十时，如果某个农历月没有三十日，系统会跳过该月或提示最近可用年份

## 数据持久化说明

需要持久化的全部数据都在 `./data` 目录中，包括：

- 登录账号
- 密码哈希
- 提醒事项
- 通知配置
- 系统设置
- 消息日志

容器删除或重建后，只要保留并重新挂载 `./data`，数据就不会丢失。

## 数据备份和恢复

### 备份

只需要备份项目根目录下的：

```text
./data
```

### 恢复

把备份好的 `./data` 放回项目目录，再重新执行：

```bash
docker compose up -d
```

## 提醒调度说明

- 后端每分钟检查一次是否有需要发送的提醒
- 系统会按“提醒窗口 + 提醒时间点”来判断是否需要发送
- 同一个提醒、同一个渠道、同一个计划时间已经有日志后，不会重复发送
- 企业微信提醒收到确认回复后，同一个提醒的当前发生日期不再继续发送企业微信通知
- 一次性提醒在目标日期过去后会自动停用

## 常见问题

### 1. 如何修改管理员账号和密码？

修改部署环境变量 `DEFAULT_ADMIN_USERNAME` 和 `DEFAULT_ADMIN_PASSWORD`，然后重启服务即可。系统启动时会自动同步管理员账号，并清理旧登录会话。

### 2. 为什么农历提醒显示的是公历日期？

真正的任务调度是按换算后的公历日期执行，所以界面会同时展示农历说明和对应公历日期。

### 3. 删除容器后数据还在吗？

只要 `./data` 目录没有删，并且重新挂载到 `/app/data`，数据就还在。

### 4. 为什么测试发送失败？

优先检查：

- Bark Server 地址和 Device Key 是否正确
- 企业微信的 Corp ID、Agent ID、Secret 是否正确
- 如果填写了企业微信 API 代理地址，代理是否正确转发 `/cgi-bin/gettoken` 和 `/cgi-bin/message/send`
- 服务器是否能访问外网接口
- 消息日志页面里的错误原因

## 当前交付状态

当前仓库已经具备可运行的自部署闭环：登录、提醒管理、公历 / 农历换算、调度、去重、日志、系统设置、通知渠道配置和 Docker 部署都已接入。通知通道的真实发送需要填写 Bark 或企业微信配置后再验证。
