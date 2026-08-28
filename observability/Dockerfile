FROM oven/bun:1.4.0
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile
COPY server.ts index.html app.js ./
RUN mkdir -p /data && chown bun:bun /data
ENV PORT=8000 OBSERVABILITY_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8000
USER 1000
CMD ["bun", "run", "server.ts"]
