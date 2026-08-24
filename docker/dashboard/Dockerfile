FROM node:26.7.0-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019 AS build
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de AS runtime
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
