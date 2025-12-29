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
  $eval = [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    $m.Groups[1].Value + $assetV
  }

  $s = [regex]::Replace($s, '(bbg\.css\?v=)[^"\s>]+', $eval)
  $s = [regex]::Replace($s, '(bbg-config\.js\?v=)[^"\s>]+', $eval)
  $s = [regex]::Replace($s, '(bbg\.js\?v=)[^"\s>]+', $eval)

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