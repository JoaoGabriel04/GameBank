FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate
RUN npx tsc

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/data ./data
EXPOSE 7000
CMD ["sh", "-c", "echo \"[startup] DATABASE_URL host=$(echo $DATABASE_URL | sed -E 's|.*@([^/]+)/.*|\\1|')\" && echo \"[startup] DIRECT_URL  host=$(echo $DIRECT_URL  | sed -E 's|.*@([^/]+)/.*|\\1|')\" && echo \"[startup] DIRECT_URL set: $([ -n \"$DIRECT_URL\" ] && echo YES || echo NO)\" && npx prisma migrate deploy && node dist/index.js"]
