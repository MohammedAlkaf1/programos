# syntax=docker/dockerfile:1.7
#
# ProgramOS production image.
#
#   docker build -t programos:latest .                      -> web application (default target)
#   docker build -t programos-worker:latest --target worker . -> workers, scheduler, migrations, CLI
#
# The build needs network access: next/font downloads IBM Plex Sans Arabic
# from Google Fonts at build time.

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
# 1. Dependencies (all of them, dev included: prisma, tsx and typescript are
#    needed to generate the client, build the app and run the scripts).
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# 2. Build: generate the Prisma client, then the standalone Next.js output.
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# prisma.config.ts reads DATABASE_URL through dotenv; generate does not connect,
# a syntactically valid placeholder is enough.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && npm run build

# ---------------------------------------------------------------------------
# 3. Web application: the standalone server only, no source, no devDependencies.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    TZ=Asia/Riyadh
# chromium renders the PDF invoices (Arabic needs a real text engine); Noto Arabic covers the offline case.
RUN apk add --no-cache tzdata wget chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto-arabic \
 && addgroup -S programos && adduser -S programos -G programos \
 && mkdir -p /app/data && chown -R programos:programos /app
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
COPY --from=build --chown=programos:programos /app/.next/standalone ./
COPY --from=build --chown=programos:programos /app/.next/static ./.next/static
COPY --from=build --chown=programos:programos /app/public ./public
USER programos
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]

# ---------------------------------------------------------------------------
# 4. Worker: full source with tsx and prisma for mail, integrations, the
#    scheduler, migrations and the operator CLI.
#      docker run programos-worker npm run mail:worker
#      docker run programos-worker npm run db:migrate
#      docker run programos-worker npm run operator -- <command>
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Riyadh
RUN apk add --no-cache tzdata \
 && addgroup -S programos && adduser -S programos -G programos \
 && mkdir -p /app/data && chown -R programos:programos /app
COPY --from=build --chown=programos:programos /app/node_modules ./node_modules
COPY --from=build --chown=programos:programos /app/src/generated ./src/generated
COPY --chown=programos:programos . .
USER programos
CMD ["npm", "run", "scheduler"]
