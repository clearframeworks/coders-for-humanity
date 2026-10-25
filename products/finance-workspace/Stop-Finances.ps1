# Resolve built-in modules from Windows PowerShell even when started by PowerShell 7.
if ($PSVersionTable.PSEdition -eq 'Desktop') {
  $financeWindowsModules = [IO.Path]::Combine($PSHOME, 'Modules')
  $env:PSModulePath = $financeWindowsModules + [IO.Path]::PathSeparator + $env:PSModulePath
}
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Finance-Paths.ps1')
$financeRuntime = (Get-FinancePaths -AppRoot $PSScriptRoot).Runtime
$financePidPath = Join-Path $financeRuntime 'service.pid'
if (-not (Test-Path -LiteralPath $financePidPath)) { Write-Host 'No launcher-owned finance service was recorded. Stop a terminal-launched service with Ctrl+C.'; exit }
$financeProcessId = 0
if (-not [int]::TryParse((Get-Content -LiteralPath $financePidPath -Raw).Trim(), [ref]$financeProcessId)) { throw 'The service PID file is invalid.' }
$financeProcessInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $financeProcessId"
if (-not $financeProcessInfo) { Write-Host 'The recorded finance service is already stopped.'; exit }
$financeExpectedEntry = Join-Path $PSScriptRoot 'server/index.mjs'
if ($financeProcessInfo.Name -ne 'node.exe' -or $financeProcessInfo.CommandLine -notmatch ('(?:^|\s)"?' + [regex]::Escape($financeExpectedEntry) + '"?(?:\s|$)')) { throw 'The recorded process does not match this finance app. It has not been stopped.' }
$financeProcessHandle = Get-Process -Id $financeProcessId -ErrorAction SilentlyContinue
if ($financeProcessHandle -and -not $financeProcessHandle.HasExited) {
  Stop-Process -InputObject $financeProcessHandle -ErrorAction Stop
  if (-not $financeProcessHandle.WaitForExit(15000)) { throw 'The finance service has not stopped yet. Close it before updating or uninstalling.' }
}
$financeStillRunning = Get-CimInstance Win32_Process -Filter "ProcessId = $financeProcessId"
if ($financeStillRunning -and $financeStillRunning.CreationDate -eq $financeProcessInfo.CreationDate) { throw 'The finance service has not stopped yet. Close it before updating or uninstalling.' }
Write-Host 'Finance service stopped. Your database and imported files are preserved.'
