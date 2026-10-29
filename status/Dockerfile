FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs collector.mjs registry.mjs health.mjs store.mjs admin.mjs admission.mjs config.example.json ./
COPY public ./public
COPY admin ./admin
ENV HOST=0.0.0.0 PORT=8787 STATUS_CONFIG=/config/config.json STATUS_DATA=/data
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8787
CMD ["node", "server.mjs"]
