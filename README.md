# EXILE

A self-hosted, dark-themed rewriting web proxy (Node 20, Express, undici, cheerio). This project is the web proxy described by the repository as "web proxy for school unblocked".

## Quick start
    cp .env.example .env     # set EXILE_KEY (and EXILE_PASSWORD to gate the instance)
    npm install
    npm test
    npm start                # http://localhost:8080
Docker: `docker compose up -d --build`

## How it works
Pages load at `/service/<token>` where token = base64url(XOR(url, EXILE_KEY)) (`server/proxy/codec.js`, swappable).
HTML/CSS are decompressed and rewritten server-side; other types stream through untouched (Range works).
`public/js/shim.js` is injected into each page and patches fetch/XHR/window.open/history and dynamically set URLs.
Frame-blocking/CSP/HSTS headers are stripped; cookies live in a server-side per-session jar.

## Security
SSRF guard validates scheme, blocklist/allowlist, literal IPs, and pins the validated DNS answer for the connection (anti-rebinding).
Per-IP rate limiting, optional Basic-auth gate, helmet on shell pages only, no URL logging.

## Environment variables
See `.env.example`.

## Deploy
Run behind Caddy for HTTPS: `exile.example.com { reverse_proxy localhost:8080 }`, and set `TRUST_PROXY=1`.

## Responsibility
The instance owner is responsible for how it is used and for complying with local laws and network policies.

## Known limitations / roadmap
- Proxied pages share Exile's origin (no per-site isolation); do not host on a domain with sensitive cookies. Use a dedicated domain.
- No WebSocket proxying, `location`/`postMessage`/storage shimming, service workers, caching, or JS source rewriting yet.
- Tabs, bookmarks, history, settings drawer, cloaking and panic key are not built yet.
- Heavy anti-bot or DRM sites will not work.
