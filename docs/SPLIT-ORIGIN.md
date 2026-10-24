# Split-origin setup

Why: proxied pages run arbitrary JS. If they share an origin with the UI they can read its storage.
So the UI (`APP_ORIGIN`) and proxied content (`CONTENT_ORIGIN`) must be different origins.

## DNS
    app.exile.example   -> CDN/static host or this server (UI)
    svc.exile.example   -> backend load balancer (proxy)
Both point at the same Exile containers if you serve the UI from them; the server routes by Host header.
Use two ordinary certificates (no wildcard needed). A wildcard (`*.svc.exile.example`, DNS-challenge cert) is only
required if you later give each proxied site its own subdomain.

## Remaining weakness
With ONE content origin, proxied sites can still see each other's localStorage/cookies on that origin.
Per-site subdomains (wildcard) fix that; not built yet.

## CSP / messaging
UI CSP `frame-src` allows only the content origin. UI <-> content talk via postMessage, each side pinning the other's origin.
Session cookie is HttpOnly, `SameSite=None; Secure` on https, set on the content origin only.

## Local test (Linux Mint)
    APP_ORIGIN=http://app.exile.localhost:8080 CONTENT_ORIGIN=http://svc.exile.localhost:8080 npm start
Open http://app.exile.localhost:8080 (`*.localhost` resolves to loopback in Chrome/Firefox).

## CDN
Cache only static UI assets (`/css`, `/js`, `/assets`, hashed). Bypass cache for `/service/*`, `/api/*`, `/healthz`. Check your CDN's terms before proxying through it.
