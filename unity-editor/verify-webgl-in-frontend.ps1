# Verifies that a full Unity WebGL drop exists under frontend/public/unity-build/
# (matches names used by frontend/src/components/UnityRaceCanvas.jsx).
# Does not run Unity — use after copy-webgl-to-frontend.ps1.

param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"
$buildDir = Join-Path $RepoRoot "frontend\public\unity-build\Build"

$required = @(
    "unity-build.loader.js",
    "unity-build.framework.js",
    "unity-build.data",
    "unity-build.wasm"
)

$missing = @()
foreach ($name in $required) {
    $path = Join-Path $buildDir $name
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $name
    }
}

if ($missing.Count -gt 0) {
    Write-Host "FAIL: Missing under ${buildDir}:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" }
    Write-Host "Build WebGL in Unity, then run: unity-editor\copy-webgl-to-frontend.ps1 -UnityWebGlBuildFolder `"YOUR_OUTPUT`""
    exit 1
}

Write-Host "OK: WebGL artifacts present in:" -ForegroundColor Green
Write-Host "  $buildDir"
exit 0
