# Spec: Nginx SSL termination for the Express resource server

## Goal

Place Nginx in front of the existing `web` service so the website is served
over HTTPS using a certificate supplied by the deployment environment. Nginx
terminates TLS and forwards requests to the Node/Express server over the
private Compose network.

## Architecture

```text
Client
  | HTTP :80 / HTTPS :443
  v
Nginx proxy
  | HTTP web:3000 (private Compose network)
  v
Node/Express web service
```

- Add a `proxy` service based on an official Alpine Nginx image pinned to a
  stable version rather than `latest`.
- Publish host ports 80 and 443 only from `proxy`.
- Remove the host `ports` mapping from `web` and use `expose: ["3000"]` to
  document its internal port. The Node server must not be directly reachable
  from outside the Compose network.
- Resolve the upstream by its Compose service name: `web:3000`.
- Keep TLS termination at Nginx. Traffic from Nginx to Node remains HTTP on
  the isolated default Compose network.

## Certificate contract

The deployment environment provides a PEM certificate chain and its matching
PEM private key. They are not generated, renewed, or committed by this
project.

Add these variables to `.env.example` with placeholder values:

```dotenv
TLS_CERTIFICATE_PATH=/absolute/path/to/fullchain.pem
TLS_PRIVATE_KEY_PATH=/absolute/path/to/privkey.pem
HTTPS_PORT=443
HTTP_PORT=80
```

- Bind-mount `${TLS_CERTIFICATE_PATH}` read-only at
  `/etc/nginx/tls/fullchain.pem`.
- Bind-mount `${TLS_PRIVATE_KEY_PATH}` read-only at
  `/etc/nginx/tls/privkey.pem`.
- Never commit the certificate, private key, or populated deployment `.env`.
- The private key must be readable only by the deployment account and the
  container process where host permissions allow it.
- Certificate renewal is performed outside Compose. After replacement,
  validate the Nginx configuration and reload or recreate `proxy` so it reads
  the renewed files.

## Nginx configuration

Add a committed configuration at `nginx/default.conf` and mount it read-only
at `/etc/nginx/conf.d/default.conf`. It must contain two server blocks.

### HTTP listener

- Listen on port 80 for both IPv4 and IPv6.
- Redirect every request to the same host and request URI over HTTPS with a
  permanent `301` response.
- Do not proxy application traffic over plaintext HTTP.

### HTTPS listener

- Listen on port 443 with SSL for both IPv4 and IPv6.
- Load `/etc/nginx/tls/fullchain.pem` with `ssl_certificate` and
  `/etc/nginx/tls/privkey.pem` with `ssl_certificate_key`.
- Allow TLS 1.2 and TLS 1.3 only.
- Use `server_name _` unless deployment requires explicit host allow-listing.
- Proxy all paths to `http://web:3000` without rewriting the path or query
  string.
- Forward these request details to Express:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_http_version 1.1;
```

- Set finite proxy connect, read, and send timeouts so unavailable upstreams
  fail predictably rather than leaving connections open indefinitely.
- Add `Strict-Transport-Security` only when HTTPS is confirmed for the entire
  production domain. Do not enable `includeSubDomains` or preload without
  separately confirming all subdomains support HTTPS.
- Disable Nginx version disclosure with `server_tokens off`.

## Compose changes

The implementation updates `docker-compose.yml` as follows:

- Add `proxy` with `restart: unless-stopped`.
- Publish `${HTTP_PORT:-80}:80` and `${HTTPS_PORT:-443}:443` from `proxy`.
- Mount the Nginx configuration, certificate chain, and private key read-only.
- Declare `depends_on: [web]` to establish startup order. This does not prove
  Node is ready; Nginx must tolerate temporary upstream connection failures
  while `web` starts.
- Replace `web.ports` with `web.expose`. `WEB_PORT` is no longer part of the
  public configuration after this migration.
- Use the default Compose network unless deployment needs integration with an
  existing external network. No extra network is necessary for isolation
  because only published ports are reachable from the host.

## Operational behavior

- A missing, unreadable, malformed, expired, or mismatched certificate/key
  must cause Nginx configuration validation or startup to fail visibly.
- Validate configuration before a production reload:

```bash
docker compose run --rm proxy nginx -t
```

- Apply a renewed certificate without restarting Node:

```bash
docker compose exec proxy nginx -t
docker compose exec proxy nginx -s reload
```

- Preserve the original client host and scheme through the forwarded headers.
  If Express later makes trust-sensitive decisions from `X-Forwarded-*`, add
  an explicit `trust proxy` setting restricted to the Compose proxy rather
  than trusting arbitrary hops.

## Non-goals

- Automated certificate issuance or renewal with ACME/Certbot.
- TLS between Nginx and Node inside the Compose network.
- A load balancer, CDN, Web Application Firewall, or multi-instance Node
  deployment.
- Changes to the separate DDEV/Bedrock WordPress development stack.

## Acceptance criteria

- `docker compose config` succeeds when all required path variables are set.
- `docker compose run --rm proxy nginx -t` succeeds with a valid matching
  certificate and key.
- `docker compose up -d` exposes ports 80 and 443 from `proxy`, while port
  3000 is not published on the host.
- `curl -I http://<host>/some/path?key=value` returns a `301` whose `Location`
  is `https://<host>/some/path?key=value`.
- `curl --fail --cacert <trusted-ca.pem> https://<host>/` returns the response
  served by the Node application.
- The certificate presented on port 443 is the configured deployment
  certificate and its hostname and validity period are accepted by the
  client.
- Requests reaching Node retain the original `Host`, client forwarding chain,
  and `X-Forwarded-Proto: https` values.
- The TLS private key, certificate files, and populated `.env` remain
  untracked and absent from image layers.
- Stopping `web` produces a bounded Nginx upstream error; restarting `web`
  restores service without restarting `proxy`.