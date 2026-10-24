FROM docker.io/library/node:26.12.0-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS dependencies
WORKDIR /app
COPY payment-server/package.json payment-server/package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY payment-server/ .
RUN npm run build

FROM docker.io/library/node:26.12.0-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS production-dependencies
WORKDIR /app
COPY payment-server/package.json payment-server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM docker.io/library/node:26.12.0-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS runtime
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
