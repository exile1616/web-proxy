# Free deploy with GitHub and Render

GitHub stores the code; Render runs the Node.js server. GitHub Pages alone cannot
run this app's proxy server.

## Push this project to GitHub

From the project folder, run:

```sh
git init -b main
git add .
git commit -m "Prepare Exile for deployment"
git remote add origin https://github.com/exile1616/web-proxy.git
git push -u origin main
```

Sign in to GitHub in your Git client if prompted. `.gitignore` excludes `.env`
and `node_modules`; do not force-add secrets.

## Deploy on Render

1. Sign in at [render.com](https://render.com) and connect the GitHub repository.
2. Choose **New → Blueprint**, select `web-proxy`, and deploy the services from
   `render.yaml`.
3. When prompted for `EXILE_KEY`, use the same long, random value for both
   services. Keep it private.
4. Open `https://exile-ui.onrender.com`.

If Render assigns different service URLs, update `APP_ORIGIN` and
`CONTENT_ORIGIN` on both services to the actual URLs, then redeploy.

The free Render services may sleep when idle, so the first request can be slow.
Free-tier quotas and availability can change; check Render's current terms and
confirm they allow your intended proxy usage.
