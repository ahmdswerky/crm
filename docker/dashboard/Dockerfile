FROM docker.io/library/node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS erd
# Committed schema snapshots → Liam ERD single-page apps served at /docs/db/<name>/.
# Kept in step with scripts/quality/db-schema/config.mjs and dashboard/scripts/build-erd.mjs.
COPY docs/db /docs/db
RUN set -eu; \
    for schema in /docs/db/*/schema.sql; do \
      name="$(basename "$(dirname "$schema")")"; \
      npx --yes @liam-hq/cli@0.7.24 erd build --input "$schema" --format postgres --output-dir "/erd/$name"; \
    done; \
    rm -rf /root/.npm

FROM docker.io/library/node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ .
COPY --from=erd /erd public/docs/db
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM docker.io/library/nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de AS runtime
ARG SOURCE_REVISION=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="CRM Dashboard" \
      org.opencontainers.image.revision="$SOURCE_REVISION" \
      org.opencontainers.image.created="$BUILD_DATE"
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/dashboard/nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /tmp/nginx /var/cache/nginx /var/log/nginx \
    && chown -R 101:101 /tmp/nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
