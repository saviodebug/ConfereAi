param(
  [ValidateSet("chrome", "firefox")]
  [string]$Target = "chrome"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$extensionPath = Join-Path $root "extensao"
$manifestPath = Join-Path $extensionPath "manifest.json"
$distPath = Join-Path $root "dist"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "manifest.json not found at $manifestPath"
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$zipName = "confereai-$Target-$($manifest.version).zip"
$zipPath = Join-Path $distPath $zipName

New-Item -ItemType Directory -Force -Path $distPath | Out-Null

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

$items = Get-ChildItem -LiteralPath $extensionPath -Force
Compress-Archive -LiteralPath $items.FullName -DestinationPath $zipPath -Force

Write-Host "Package created: $zipPath"
