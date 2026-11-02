FROM docker.io/library/node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS dependencies
WORKDIR /app
COPY payment-server/package.json payment-server/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY payment-server/ .
RUN npm run build

FROM docker.io/library/node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS production-dependencies
WORKDIR /app
COPY payment-server/package.json payment-server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM docker.io/library/node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS runtime
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
