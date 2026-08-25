<#
.SYNOPSIS
    Builds a distributable zip of the Claude RTL Chat extension.

.DESCRIPTION
    Zips the contents of extension/ into dist/, named with the manifest version.
    Attach the result to a GitHub Release so people can download one file
    instead of cloning the repository.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File pack.ps1
#>
[CmdletBinding()]
param(
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$source = Join-Path $root 'extension'

if (-not (Test-Path (Join-Path $source 'manifest.json'))) {
    Write-Host "extension\manifest.json not found under $root" -ForegroundColor Red
    exit 1
}

if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root 'dist' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$manifest = Get-Content (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
$zip = Join-Path $OutputDirectory "claude-rtl-persianpack-$($manifest.version).zip"

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $source '*') -DestinationPath $zip

$size = [math]::Round((Get-Item $zip).Length / 1KB, 1)
Write-Host ''
Write-Host "  Built $zip  ($size KB)" -ForegroundColor Green
Write-Host '  Attach it to a GitHub Release, or unzip it and load it unpacked.'
Write-Host ''
