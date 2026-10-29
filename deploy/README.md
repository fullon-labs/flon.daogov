# Deployment templates

This directory contains generic application and edge-proxy templates. Real hostnames, SSH destinations, user names, endpoint addresses, host ports, certificate paths, persistent storage paths and secret-file paths belong in an operator-owned `deploy/.env`.

```sh
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
# Edit deploy/.env locally, then render:
python3 deploy/render.py --check
python3 deploy/render.py
```

The renderer reads dotenv-style literal settings without executing shell code or expanding variables. It only substitutes `${DEPLOY_...}` placeholders; native Nginx variables such as `$host`, `$scheme` and `$http_x_forwarded_proto`, and Docker Compose image-tag expressions, remain intact. Quoted values use JSON strings; unquoted and simple single-quoted literals are also accepted.

Generated files are written with owner-only permissions under `deploy/.local/rendered/app/` and `deploy/.local/rendered/gateway/`. Both `.env` files and the entire `.local` directory are ignored by Git and excluded from Docker build context. `.env.example` contains demonstration values, not production configuration. Do not force-add private or rendered files. SSH and signing keys remain external files; `.env` should contain their paths, not the keys themselves.

For application deployment, build the images separately and use the generated compose file:

```sh
docker compose -f deploy/.local/rendered/app/docker-compose.yml config --quiet
# Set IMAGE_TAG / KEEPER_TAG to the versions you intend to deploy.
docker compose -f deploy/.local/rendered/app/docker-compose.yml up -d
```

Transfer rendered files through your private deployment channel. Validate Nginx and systemd configuration on the target before activating it. These commands intentionally contain no host aliases or environment-specific SSH routes. The templates are not automatically deployed by rendering them, and this refactor does not change running services.

`config.mainnet.js` and `config.testnet.js` are browser-visible runtime settings. Only public RPC URLs, chain IDs and public contract names belong there. Any private upstream belongs in the server-side proxy template instead.

An ordinary sanitization commit removes sensitive values from the current tree only. Previously pushed commits, tags, branches, pull-request diffs, forks and clones may retain older copies. Removing those copies requires a separately coordinated history cleanup; do not claim that adding `.gitignore` erases Git history.
