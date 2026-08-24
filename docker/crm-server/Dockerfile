FROM php:8.5-fpm-alpine@sha256:9dc81f4086ea5402227a6bcc489b04b4baba12394624d9621faa92ed812fb8ee AS php-base

ARG APP_UID=1000
ARG APP_GID=1000

RUN apk add --no-cache \
        icu-libs \
        libjpeg-turbo \
        libpng \
        libwebp \
        libpq \
        libzip \
        freetype \
        libxml2 \
        oniguruma \
    && apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        icu-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libwebp-dev \
        postgresql-dev \
        libzip-dev \
        freetype-dev \
        libxml2-dev \
        oniguruma-dev \
        linux-headers \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(getconf _NPROCESSORS_ONLN)" bcmath dom exif gd intl pcntl pdo_pgsql posix sockets zip \
    && pecl install redis-6.2.0 \
    && docker-php-ext-enable redis opcache \
    && php -m | grep -qx gd \
    && php -m | grep -qx sockets \
    && php -r 'exit(function_exists("imagewebp") ? 0 : 1);' \
    && apk del .build-deps \
    && addgroup -g "$APP_GID" app \
    && adduser -D -H -u "$APP_UID" -G app app

FROM php-base AS vendor
COPY --from=docker.io/library/composer:2.8@sha256:5248900ab8b5f7f880c2d62180e40960cd87f60149ec9a1abfd62ac72a02577c /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY server/composer.json server/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --classmap-authoritative --no-scripts

FROM vendor AS build
WORKDIR /var/www/html
COPY --chown=app:app server/ .
RUN rm -f bootstrap/cache/*.php \
    && composer dump-autoload --no-dev --classmap-authoritative --no-scripts \
    && php artisan package:discover --ansi

FROM php-base AS runtime
ARG SOURCE_REVISION=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="CRM Laravel API" \
      org.opencontainers.image.revision="$SOURCE_REVISION" \
      org.opencontainers.image.created="$BUILD_DATE"

WORKDIR /var/www/html
COPY --from=build --chown=app:app /var/www/html /var/www/html
COPY --chown=app:app docker/crm-server/php.ini /usr/local/etc/php/conf.d/99-crm.ini
COPY --chown=app:app docker/crm-server/opcache.ini /usr/local/etc/php/conf.d/10-opcache.ini
COPY --chown=app:app docker/crm-server/www.conf /usr/local/etc/php-fpm.d/zz-crm.conf
COPY --chown=app:app docker/crm-server/entrypoint.sh /usr/local/bin/crm-entrypoint

RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/media-library/temp bootstrap/cache storage/app/public \
    && rm -rf public/storage \
    && ln -s /var/www/html/storage/app/public public/storage \
    && chown -R app:app storage bootstrap/cache \
    && chmod 0755 /usr/local/bin/crm-entrypoint

USER app
EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/crm-entrypoint"]
CMD ["php-fpm", "-F"]
