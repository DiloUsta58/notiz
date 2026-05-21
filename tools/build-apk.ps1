param(
  [ValidateSet('Debug', 'Release')]
  [string]$Variant = 'Debug'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$AndroidDir = Join-Path $ProjectRoot 'android'
$GradleBat = 'C:\Users\sivas\.gradle\wrapper\dists\gradle-9.4.1-bin\arn2x92ynaizyzdaamcbpbhtj\gradle-9.4.1\bin\gradle.bat'
$JavaHome = 'C:\Program Files\Android\Android Studio\jbr'
$AndroidSdk = 'C:\Users\sivas\AppData\Local\Android\Sdk'

& (Join-Path $PSScriptRoot 'sync-web-assets.ps1') -ProjectRoot $ProjectRoot

if (Test-Path $JavaHome) {
  $env:JAVA_HOME = $JavaHome
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
}

if (Test-Path $AndroidSdk) {
  $env:ANDROID_HOME = $AndroidSdk
  $env:ANDROID_SDK_ROOT = $AndroidSdk
}

$task = if ($Variant -eq 'Release') { 'assembleRelease' } else { 'assembleDebug' }

Push-Location $AndroidDir
try {
  if (Test-Path $GradleBat) {
    & $GradleBat $task
  } else {
    gradle $task
  }
} finally {
  Pop-Location
}

$apk = Join-Path $AndroidDir "app\build\outputs\apk\$($Variant.ToLower())\app-$($Variant.ToLower()).apk"
if (Test-Path $apk) {
  Copy-Item -LiteralPath $apk -Destination (Join-Path $ProjectRoot "Notiz-$($Variant.ToLower()).apk") -Force
  Write-Host "APK created: $apk"
  Write-Host "Copied to: $(Join-Path $ProjectRoot "Notiz-$($Variant.ToLower()).apk")"
}
