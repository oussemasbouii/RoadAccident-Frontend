# deploy.ps1 — Build, package, upload, and deploy the Road Accident web app to the micla server.
#
# Usage (from the project root):
#     ./deploy.ps1
#
# Requires the OpenSSH client (scp/ssh) on PATH. You'll be prompted for the server
# password unless you've set up a deploy key (see DEPLOY.md — strongly recommended).

$ErrorActionPreference = 'Stop'

$SERVER  = 'osboui@159.89.6.57'
$PORT    = 22
$WEBROOT = '/var/www/web.micladevops.com'
$URL     = 'https://web.micladevops.com'

Write-Host '==> Building production bundle...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed — aborting deploy.' }

$ts      = Get-Date -Format 'yyyyMMdd-HHmmss'
$tarball = "dist-$ts.tar.gz"
Write-Host "==> Packaging $tarball ..." -ForegroundColor Cyan
tar -czf $tarball dist
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }

Write-Host '==> Uploading to server (enter password if prompted)...' -ForegroundColor Cyan
scp -P $PORT $tarball "${SERVER}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw 'Upload (scp) failed.' }

Write-Host '==> Deploying on server (enter sudo password if prompted)...' -ForegroundColor Cyan
$remote = @"
set -e
sudo cp -r '$WEBROOT' '${WEBROOT}.bak-`$(date +%F-%H%M)'
sudo rm -rf '$WEBROOT'/*
sudo tar -xzf '/tmp/$tarball' -C /tmp
sudo cp -r /tmp/dist/* '$WEBROOT'/
sudo nginx -t && sudo nginx -s reload
sudo rm -rf /tmp/dist '/tmp/$tarball'
echo DEPLOY_DONE
"@
ssh -t -p $PORT $SERVER $remote
if ($LASTEXITCODE -ne 0) { throw 'Remote deploy failed.' }

Write-Host "==> Verifying $URL ..." -ForegroundColor Cyan
$asset = (Select-String -Path 'dist/index.html' -Pattern 'assets/index-[A-Za-z0-9_-]+\.js').Matches.Value | Select-Object -First 1
try {
  $live = (Invoke-WebRequest -Uri $URL -UseBasicParsing -TimeoutSec 25).Content
  if ($asset -and $live -match [regex]::Escape($asset)) {
    Write-Host "[OK] Deployed and verified: $asset is live at $URL" -ForegroundColor Green
  } else {
    Write-Host "[WARN] Deployed, but couldn't confirm $asset on $URL (CDN/browser cache?). Check manually." -ForegroundColor Yellow
  }
} catch {
  Write-Host "[WARN] Deployed, but the verification request failed: $($_.Exception.Message)" -ForegroundColor Yellow
}
