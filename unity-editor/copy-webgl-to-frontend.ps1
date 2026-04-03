# Merges a Unity WebGL build output folder into frontend/public/unity-build/
# Usage (from repo root or unity-editor):
#   .\unity-editor\copy-webgl-to-frontend.ps1 -UnityWebGlBuildFolder "C:\path\to\WebGL\build\output"

param(
    [Parameter(Mandatory = $true)]
    [string]$UnityWebGlBuildFolder
)

$ErrorActionPreference = "Stop"

$unityRoot = Resolve-Path -LiteralPath $UnityWebGlBuildFolder
if (-not (Test-Path -LiteralPath $unityRoot)) {
    throw "Unity WebGL folder not found: $UnityWebGlBuildFolder"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$dest = Join-Path $repoRoot "frontend\public\unity-build"

New-Item -ItemType Directory -Force -Path $dest | Out-Null

Get-ChildItem -LiteralPath $unityRoot -Force | ForEach-Object {
    $target = Join-Path $dest $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force
}

Write-Host "Copied Unity WebGL output from:"
Write-Host "  $unityRoot"
Write-Host "to:"
Write-Host "  $dest"
