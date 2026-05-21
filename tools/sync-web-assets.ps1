param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$assetDir = Join-Path $ProjectRoot 'android\app\src\main\assets\www'
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null

$files = @(
  'index.html',
  'note.html',
  'styles.css',
  'app.js',
  'note.js',
  'backup.js',
  'db.js',
  'sync.js',
  'sw.js',
  'manifest.webmanifest'
)

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot $file) -Destination (Join-Path $assetDir $file) -Force
}

$iconSource = Join-Path $ProjectRoot 'icon'
$iconTarget = Join-Path $assetDir 'icon'
New-Item -ItemType Directory -Force -Path $iconTarget | Out-Null
Copy-Item -Path (Join-Path $iconSource '*') -Destination $iconTarget -Force

$resDrawable = Join-Path $ProjectRoot 'android\app\src\main\res\drawable'
New-Item -ItemType Directory -Force -Path $resDrawable | Out-Null
Copy-Item -LiteralPath (Join-Path $iconSource 'notes512.png') -Destination (Join-Path $resDrawable 'notes.png') -Force

Write-Host "Web assets synced to $assetDir"
