# --- تصویر وب (Next.js) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# از رجیستری رسمی نصب می‌شود حتی اگر lock آدرس آینه داشته باشد.
RUN npm ci --registry=https://registry.npmjs.org --replace-registry-host=always --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# نشانی عمومی سایت در زمان build پخته می‌شود (برای canonical و sitemap).
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_INTERNAL_URL=http://api:8000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
