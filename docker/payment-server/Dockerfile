FROM node:26.8.1-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS dependencies
WORKDIR /app
COPY payment-server/package.json payment-server/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY payment-server/ .
RUN npm run build

FROM node:26.8.1-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS production-dependencies
WORKDIR /app
COPY payment-server/package.json payment-server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:26.8.1-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS runtime
ARG SOURCE_REVISION=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="CRM Payments API" \
      org.opencontainers.image.revision="$SOURCE_REVISION" \
      org.opencontainers.image.created="$BUILD_DATE"
WORKDIR /app
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=128
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY payment-server/package.json ./
COPY docker/payment-server/entrypoint.sh /usr/local/bin/payment-entrypoint
RUN chmod 0755 /usr/local/bin/payment-entrypoint && chown -R node:node /app /usr/local/bin/payment-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/payment-entrypoint"]
CMD ["node", "dist/main.js"]
