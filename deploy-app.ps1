# deploy-app.ps1 — Build & deploy the Road Accident frontend to the NEW server
# (the gateway box behind app.micladevops.com, 158.176.1.31), into
# /opt/road-accident-frontend.
#
# Usage (from the project root):
#     ./deploy-app.ps1
#
# Requires the OpenSSH client (scp/ssh) on PATH. You'll be prompted for the
# server password at the scp step and the sudo password at the deploy step.
#
# IMPORTANT — this only pushes the built files. For them to be SERVED at
# https://app.micladevops.com, the nginx gateway (/opt/NewRaGateway) must be
# wired ONCE:
#   1) mount /opt/road-accident-frontend into the nginx-local container
#      (add  - /opt/road-accident-frontend:/srv/app:ro  to docker-compose.nginx.yml),
#   2) add an  app.micladevops.com  server block to nginx/gateway.conf.template
#      (root /srv/app; try_files $uri /index.html; + /api/ -> liberty_api/api/v2/),
#   3) add app.micladevops.com to the TLS SAN cert (certbot).
# Once wired, static content updates (re-running this script) need NO reload —
# the container serves the mounted files live.

$ErrorActionPreference = 'Stop'

$SERVER = 'osboui@158.176.1.31'
$PORT   = 22
$DEST   = '/opt/road-accident-frontend'
$URL    = 'https://app.micladevops.com'

Write-Host '==> Building production bundle...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed - aborting deploy.' }

$ts      = Get-Date -Format 'yyyyMMdd-HHmmss'
$tarball = "dist-$ts.tar.gz"
Write-Host "==> Packaging $tarball ..." -ForegroundColor Cyan
tar -czf $tarball dist
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }

Write-Host '==> Uploading to server (enter SSH password if prompted)...' -ForegroundColor Cyan
scp -P $PORT $tarball "${SERVER}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw 'Upload (scp) failed.' }

Write-Host '==> Deploying on server (enter sudo password if prompted)...' -ForegroundColor Cyan
$remote = @"
set -e
sudo mkdir -p '$DEST'
sudo rm -rf '$DEST'/*
sudo tar -xzf '/tmp/$tarball' -C /tmp
sudo cp -r /tmp/dist/* '$DEST'/
sudo rm -rf /tmp/dist '/tmp/$tarball'
echo DEPLOY_DONE
"@
ssh -t -p $PORT $SERVER $remote
if ($LASTEXITCODE -ne 0) { throw 'Remote deploy failed.' }

# Clean up the local tarball
Remove-Item $tarball -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "[OK] Files deployed to ${SERVER}:$DEST" -ForegroundColor Green
Write-Host "     Once the gateway is wired (volume mount + app vhost + cert)," -ForegroundColor Yellow
Write-Host "     the app serves at $URL" -ForegroundColor Yellow
