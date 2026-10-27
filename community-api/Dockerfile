FROM node:22-alpine
WORKDIR /app
COPY community-api/ ./community-api/
USER node
EXPOSE 8789
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O - http://127.0.0.1:8789/community-api/healthz || exit 1
CMD ["node", "community-api/server.mjs"]
