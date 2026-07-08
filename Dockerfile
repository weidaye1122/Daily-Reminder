FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.server.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

RUN pnpm build

RUN mkdir -p /app/data && chown -R node:node /app /pnpm

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV PORT=3000
ENV DATABASE_URL=/app/data/reminder.db

EXPOSE 3000

USER node

CMD ["pnpm", "start"]
