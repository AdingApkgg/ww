ARG UBUNTU_IMAGE=ubuntu:24.04
FROM --platform=$BUILDPLATFORM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run --bun build

FROM ${UBUNTU_IMAGE}
ENV DEBIAN_FRONTEND=noninteractive
RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl cabextract unzip winbind wine wine64 wine32:i386 winetricks \
    xvfb x11vnc fluxbox novnc websockify supervisor fonts-wine fonts-dejavu-core xauth \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --user-group --shell /bin/bash wine \
    && mkdir -p /data /home/wine/.fluxbox && chown -R wine:wine /data /home/wine
# Build the SPA natively, but install a Bun binary matching the runtime architecture.
ARG TARGETARCH
RUN case "$TARGETARCH" in amd64) bun_arch=x64-baseline ;; arm64) bun_arch=aarch64 ;; *) exit 1 ;; esac \
    && curl --fail --location --retry 3 "https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-${bun_arch}.zip" -o /tmp/bun.zip \
    && unzip /tmp/bun.zip -d /tmp/bun-runtime \
    && install -m 755 "/tmp/bun-runtime/bun-linux-${bun_arch}/bun" /usr/local/bin/bun \
    && rm -rf /tmp/bun.zip /tmp/bun-runtime
WORKDIR /app
COPY --from=build /app/package.json /app/bun.lock ./
RUN bun install --production --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY deploy/supervisord.conf /etc/supervisor/conf.d/workspace.conf
COPY deploy/entrypoint.sh /usr/local/bin/workspace-entrypoint
RUN chmod +x /usr/local/bin/workspace-entrypoint
ENV NODE_ENV=production WW_HOST=0.0.0.0 WW_PORT=4387 WW_DATA_DIR=/data \
    WW_WINE_BIN=/usr/bin/wine WW_WINESERVER_BIN=/usr/bin/wineserver \
    WW_WINETRICKS_BIN=/usr/bin/winetricks WW_DESKTOP_URL=http://127.0.0.1:6080 \
    DISPLAY=:99 HOME=/home/wine WINEDLLOVERRIDES=winemenubuilder.exe=d
EXPOSE 4387
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD curl --fail --silent --header "Host: $(printf '%s' "$WW_ORIGIN" | sed -E 's#^https?://([^/]+).*#\1#')" http://127.0.0.1:4387/api/auth > /dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/workspace-entrypoint"]
