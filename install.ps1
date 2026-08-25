<#
.SYNOPSIS
    Offline installer for the Claude RTL Chat browser extension.

.DESCRIPTION
    Copies the extension to a stable folder outside the repo (so the browser
    never loses it when the repo moves), puts that path on the clipboard, and
    opens the browser's extensions page. Chrome has no command line for
    "load unpacked", so the last two clicks are still yours -- but the path is
    already in the clipboard, ready to paste into the folder picker.

.PARAMETER Browser
    Which extensions page to open: chrome, edge, or none.

.PARAMETER Destination
    Where to install. Defaults to %LOCALAPPDATA%\ClaudeRTL.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File install.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File install.ps1 -Browser edge
#>
[CmdletBinding()]
param(
    [ValidateSet('chrome', 'edge', 'none')]
    [string]$Browser = 'chrome',

    [string]$Destination = (Join-Path $env:LOCALAPPDATA 'ClaudeRTL')
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Text)
    Write-Host "  $Text"
}

Write-Host ''
Write-Host '  Claude RTL Chat - installer' -ForegroundColor Cyan
Write-Host '  ---------------------------' -ForegroundColor Cyan
Write-Host ''

# --- locate the extension source ------------------------------------------

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$candidates = @(
    (Join-Path $root 'extension'),
    $root
)
$source = $candidates | Where-Object { Test-Path (Join-Path $_ 'manifest.json') } | Select-Object -First 1

if (-not $source) {
    Write-Host '  manifest.json not found.' -ForegroundColor Red
    Write-Step 'Run this script from the repository root, or from inside the'
    Write-Step 'folder that contains manifest.json.'
    exit 1
}

$manifest = Get-Content (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
Write-Step "Source:  $source"
Write-Step "Version: $($manifest.version)"

# --- copy to the stable location ------------------------------------------

$target = Join-Path $Destination 'extension'

# Guard: only ever clear a folder we own -- named "extension", under the
# destination we were given, and either absent or already one of our installs.
if (Test-Path $target) {
    $existing = Join-Path $target 'manifest.json'
    $isOurs = (Test-Path $existing) -and
              ((Get-Content $existing -Raw | ConvertFrom-Json).name -eq $manifest.name)
    if (-not $isOurs) {
        Write-Host "  $target already exists and is not a Claude RTL install." -ForegroundColor Red
        Write-Step 'Refusing to overwrite it. Pass -Destination to pick another folder.'
        exit 1
    }
    Remove-Item $target -Recurse -Force
    Write-Step 'Removed the previous install.'
}

New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item (Join-Path $source '*') -Destination $target -Recurse -Force

$copied = (Get-ChildItem $target -Recurse -File | Measure-Object).Count
Write-Step "Installed to: $target  ($copied files)"

# --- hand the path to the user --------------------------------------------

try {
    Set-Clipboard -Value $target
    $clip = 'the path is already on your clipboard'
} catch {
    $clip = 'copy the path above'
}

$page = switch ($Browser) {
    'chrome' { 'chrome://extensions' }
    'edge'   { 'edge://extensions' }
    default  { $null }
}

if ($page) {
    $exe = switch ($Browser) { 'chrome' { 'chrome.exe' } 'edge' { 'msedge.exe' } }
    try {
        Start-Process $exe $page
        Write-Step "Opened $page"
    } catch {
        Write-Step "Could not launch $exe - open $page yourself."
    }
}

Write-Host ''
Write-Host '  Last three steps (in the browser):' -ForegroundColor Yellow
Write-Step '1. Turn on "Developer mode" (top right).'
Write-Step '2. Click "Load unpacked".'
Write-Step "3. Paste the folder path - $clip."
Write-Host ''
Write-Step 'Then open claude.ai. Toggle RTL with Ctrl+Alt+R.'
Write-Host ''
