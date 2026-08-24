FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.31-alpine@sha256:db35bfc6b2951e7f8a72db5db120288c127ffaeeb4a6d4b95a26fead017d5913 AS runtime
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
