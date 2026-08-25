<#
.SYNOPSIS
    Installs the persian-rtl skill and writing rule into Claude Code.

.DESCRIPTION
    Copies claude-code\persian-rtl into %USERPROFILE%\.claude\skills so the
    skill becomes available as /persian-rtl, and merges the always-on writing
    rule into %USERPROFILE%\.claude\CLAUDE.md.

    The rule is what actually fixes day-to-day output; the skill is the
    on-demand auditor for text that already exists. Pass -SkillOnly to install
    the skill without touching CLAUDE.md.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File install-skill.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File install-skill.ps1 -SkillOnly
#>
[CmdletBinding()]
param(
    [switch]$SkillOnly,
    [string]$ClaudeHome = (Join-Path $env:USERPROFILE '.claude')
)

$ErrorActionPreference = 'Stop'

$MARKER = '<!-- persian-rtl-rule -->'

Write-Host ''
Write-Host '  persian-rtl - Claude Code installer' -ForegroundColor Cyan
Write-Host '  -----------------------------------' -ForegroundColor Cyan
Write-Host ''

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$source = Join-Path $root 'claude-code'

if (-not (Test-Path (Join-Path $source 'persian-rtl\SKILL.md'))) {
    Write-Host "  claude-code\persian-rtl\SKILL.md not found under $root" -ForegroundColor Red
    Write-Host '  Run this script from the repository root.'
    exit 1
}

# --- the skill ------------------------------------------------------------

$skills = Join-Path $ClaudeHome 'skills'
$target = Join-Path $skills 'persian-rtl'

New-Item -ItemType Directory -Path $skills -Force | Out-Null

if (Test-Path $target) {
    # Only ever replace a folder that is already this skill.
    $existing = Join-Path $target 'SKILL.md'
    if (-not (Test-Path $existing) -or
        -not ((Get-Content $existing -Raw) -match 'name:\s*persian-rtl')) {
        Write-Host "  $target exists and is not the persian-rtl skill." -ForegroundColor Red
        Write-Host '  Refusing to overwrite it.'
        exit 1
    }
    Remove-Item $target -Recurse -Force
    Write-Host '  Replaced the previous version.'
}

Copy-Item (Join-Path $source 'persian-rtl') -Destination $target -Recurse -Force
Write-Host "  Skill installed: $target"
Write-Host '  Invoke it with /persian-rtl'

# --- the always-on rule ---------------------------------------------------

if ($SkillOnly) {
    Write-Host ''
    Write-Host '  Skipped CLAUDE.md (-SkillOnly).' -ForegroundColor Yellow
    Write-Host ''
    exit 0
}

$rules = Get-Content (Join-Path $source 'persian-rules.md') -Raw
$claudeMd = Join-Path $ClaudeHome 'CLAUDE.md'

if (Test-Path $claudeMd) {
    $current = Get-Content $claudeMd -Raw
    if ($current -match [regex]::Escape($MARKER)) {
        Write-Host '  CLAUDE.md already carries the rule - left unchanged.'
    } else {
        Add-Content -Path $claudeMd -Value "`n$MARKER`n$rules" -Encoding utf8
        Write-Host "  Appended the rule to $claudeMd"
    }
} else {
    Set-Content -Path $claudeMd -Value "$MARKER`n$rules" -Encoding utf8
    Write-Host "  Created $claudeMd with the rule"
}

Write-Host ''
Write-Host '  CLAUDE.md loads in every session, so the rule needs no switching on.' -ForegroundColor Yellow
Write-Host ''
