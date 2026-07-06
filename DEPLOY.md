# Deployment

The web app is a static Vite build served by nginx on the **micla server**
(`web.micladevops.com`, `159.89.6.57`) from `/var/www/web.micladevops.com/`.

## One-command deploy

From the project root:

```powershell
# Windows / PowerShell
./deploy.ps1
```

```bash
# macOS / Linux / git-bash / WSL
./deploy.sh
```

The script will:

1. `npm run build` (production bundle in `dist/`).
2. Package it as `dist-<timestamp>.tar.gz`.
3. `scp` it to the server's `/tmp/`.
4. SSH in and: **back up** the current site to `…/web.micladevops.com.bak-<date>`,
   replace the web root with the new build, run `nginx -t`, and reload nginx.
5. Verify the live site is serving the new `assets/index-*.js`.

> Build env vars (API URL, sockets, maps) come from `.env`, which already points
> at `https://micladevops.com`. No extra config is needed for a normal deploy.

## Make it password-free (recommended)

By default you'll be prompted for the SSH password (and sudo password) on each
deploy. To remove that, add **your** SSH public key to the server once:

```bash
# 1) Create a key if you don't have one
ssh-keygen -t ed25519 -C "you@micla-deploy"

# 2) Authorize it on the server (run on YOUR machine; enter the password once)
ssh osboui@159.89.6.57 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys" < ~/.ssh/id_ed25519.pub
```

After that, `scp`/`ssh` (and both deploy scripts) run without a password.
(`sudo` may still prompt unless the account has passwordless sudo configured.)

## Rollback

Each deploy makes a timestamped backup. To roll back, SSH in and restore the
most recent one:

```bash
ssh osboui@159.89.6.57
ls -dt /var/www/web.micladevops.com.bak-*   # newest first
sudo rsync -a --delete /var/www/web.micladevops.com.bak-<DATE>/ /var/www/web.micladevops.com/
sudo nginx -s reload
```

## Notes

- The nginx `protocol options redefined` lines on reload are pre-existing
  warnings across server blocks — harmless, not caused by deploys.
- If the live site still shows the old build after deploy, it's browser/CDN
  cache — hard-refresh (Ctrl+F5).
