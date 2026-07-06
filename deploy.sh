#!/usr/bin/env bash
# deploy.sh — Build, package, upload, and deploy the Road Accident web app to the micla server.
#
# Usage (from the project root):
#     ./deploy.sh
#
# Requires scp/ssh on PATH. You'll be prompted for the server password unless a
# deploy key is set up (see DEPLOY.md — strongly recommended).

set -euo pipefail

SERVER="osboui@159.89.6.57"
PORT=22
WEBROOT="/var/www/web.micladevops.com"
URL="https://web.micladevops.com"

echo "==> Building production bundle..."
npm run build

TS="$(date +%Y%m%d-%H%M%S)"
TARBALL="dist-$TS.tar.gz"
echo "==> Packaging $TARBALL ..."
tar -czf "$TARBALL" dist

echo "==> Uploading to server (enter password if prompted)..."
scp -P "$PORT" "$TARBALL" "$SERVER:/tmp/"

echo "==> Deploying on server (enter sudo password if prompted)..."
ssh -t -p "$PORT" "$SERVER" "
  set -e
  sudo cp -r '$WEBROOT' '${WEBROOT}.bak-\$(date +%F-%H%M)'
  sudo rm -rf '$WEBROOT'/*
  sudo tar -xzf '/tmp/$TARBALL' -C /tmp
  sudo cp -r /tmp/dist/* '$WEBROOT'/
  sudo nginx -t && sudo nginx -s reload
  sudo rm -rf /tmp/dist '/tmp/$TARBALL'
  echo DEPLOY_DONE
"

echo "==> Deployed. Verify at $URL (look for the new assets/index-*.js hash)."
