$ErrorActionPreference = 'Stop'
$financePidPath = Join-Path $PSScriptRoot 'runtime/service.pid'
if (-not (Test-Path -LiteralPath $financePidPath)) { Write-Host 'No launcher-owned finance service was recorded. Stop a terminal-launched service with Ctrl+C.'; exit }
$financeProcessId = 0
if (-not [int]::TryParse((Get-Content -LiteralPath $financePidPath -Raw).Trim(), [ref]$financeProcessId)) { throw 'The service PID file is invalid.' }
$financeProcessInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $financeProcessId"
if (-not $financeProcessInfo) { Write-Host 'The recorded finance service is already stopped.'; exit }
$financeExpectedEntry = Join-Path $PSScriptRoot 'server/index.mjs'
if ($financeProcessInfo.Name -ne 'node.exe' -or -not $financeProcessInfo.CommandLine.Contains($financeExpectedEntry)) { throw 'The recorded process does not match this finance app. It has not been stopped.' }
Stop-Process -Id $financeProcessId
Write-Host 'Finance service stopped. Your database and imported files are preserved.'
