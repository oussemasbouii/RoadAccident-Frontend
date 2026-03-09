param(
  [string]$ServerHost = "159.89.6.57",
  [string]$ServerUser = "osboui",
  [int]$ServerPort = 22,
  [string]$RemoteWebRoot = "/var/www/road-accident-frontend",
  [switch]$SkipBuild,
  [switch]$ConfigureNginx,
  [string]$Domain = "www.micladevops.com",
  [string]$DomainAlias = "micladevops.com",
  [string]$BackendUpstream = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

Require-Command "npm"
Require-Command "ssh"
Require-Command "scp"
Require-Command "tar"

Write-Host "==> Deploy target: $ServerUser@$ServerHost`:$ServerPort"
Write-Host "==> Web root: $RemoteWebRoot"

if (-not $SkipBuild) {
  Write-Host "==> Building frontend"
  npm run build
}

if (-not (Test-Path "dist")) {
  throw "dist folder not found. Run a build first or remove -SkipBuild."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "dist-$timestamp.tar.gz"
$remoteArchive = "/home/$ServerUser/$archiveName"

Write-Host "==> Creating archive: $archiveName"
if (Test-Path $archiveName) {
  Remove-Item $archiveName -Force
}
tar -czf $archiveName dist

Write-Host "==> Uploading archive"
scp -P $ServerPort $archiveName "$ServerUser@$ServerHost`:$remoteArchive"

Write-Host "==> Extracting on server"
$remoteCmd = @"
set -e
sudo mkdir -p '$RemoteWebRoot'
sudo tar -xzf '$remoteArchive' -C '$RemoteWebRoot' --strip-components=1
sudo chown -R www-data:www-data '$RemoteWebRoot'
rm -f '$remoteArchive'
"@
ssh -p $ServerPort "$ServerUser@$ServerHost" $remoteCmd

if ($ConfigureNginx) {
  Write-Host "==> Configuring Nginx site"
  $nginxLocal = ".deploy-nginx-$timestamp.conf"
  @"
server {
    listen 80;
    server_name $Domain $DomainAlias;

    root $RemoteWebRoot;
    index index.html;

    location / {
        try_files `$uri /index.html;
    }

    location /api/ {
        proxy_pass $BackendUpstream/api/v2/;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
    }

    location /api/v2/socket.io/ {
        proxy_pass $BackendUpstream/api/v2/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host `$host;
    }
}
"@ | Set-Content -Path $nginxLocal -NoNewline

  $remoteNginxTmp = "/home/$ServerUser/$nginxLocal"
  scp -P $ServerPort $nginxLocal "$ServerUser@$ServerHost`:$remoteNginxTmp"

  $nginxCmd = @"
set -e
sudo mv '$remoteNginxTmp' /etc/nginx/sites-available/road-accident-frontend
if [ ! -L /etc/nginx/sites-enabled/road-accident-frontend ]; then
  sudo ln -s /etc/nginx/sites-available/road-accident-frontend /etc/nginx/sites-enabled/road-accident-frontend
fi
sudo nginx -t
sudo systemctl reload nginx
"@
  ssh -p $ServerPort "$ServerUser@$ServerHost" $nginxCmd
  Remove-Item $nginxLocal -Force
}

Remove-Item $archiveName -Force
Write-Host "==> Deployment complete."
Write-Host "Next: open https://$Domain"
