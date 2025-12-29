param(
  [string]$Message = "release",
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Unique cache buster for GitHub Pages/CDN caches
$assetV = Get-Date -Format "yyyyMMddHHmmss"

function Replace-AssetV([string]$path) {
  $p = Join-Path $root $path
  $s = Get-Content -Raw -Encoding UTF8 $p

  # Replace existing ?v=... for known assets
  $s = $s -replace '(bbg\.css\?v=)[^"\s>]+', ('$1' + $assetV)
  $s = $s -replace '(bbg-config\.js\?v=)[^"\s>]+', ('$1' + $assetV)
  $s = $s -replace '(bbg\.js\?v=)[^"\s>]+', ('$1' + $assetV)

  Set-Content -Encoding UTF8 -NoNewline -Path $p -Value $s
}

Replace-AssetV "index.html"

git add -A

# If nothing changed, avoid empty commits
$st = git status --porcelain
if (-not $st) {
  Write-Host "No changes to commit. (assetV=$assetV)"
  exit 0
}

git commit -m "$Message (assets $assetV)"

if (-not $NoPush) {
  git push origin main
}

Write-Host "Released: assets=$assetV"