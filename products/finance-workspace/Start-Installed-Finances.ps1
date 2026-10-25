# A shortcut-friendly entry point: failures stay visible even when PowerShell is hidden.
if ($PSVersionTable.PSEdition -eq 'Desktop') {
  $financeWindowsModules = [IO.Path]::Combine($PSHOME, 'Modules')
  $env:PSModulePath = $financeWindowsModules + [IO.Path]::PathSeparator + $env:PSModulePath
}
$ErrorActionPreference = 'Stop'
$financeLauncherRuntime = $null
try {
  . (Join-Path $PSScriptRoot 'Finance-Paths.ps1')
  $financeLauncherRuntime = (Get-FinancePaths -AppRoot $PSScriptRoot).Runtime
  New-Item -ItemType Directory -Path $financeLauncherRuntime -Force | Out-Null
  Add-Content -LiteralPath (Join-Path $financeLauncherRuntime 'launcher.log') -Value ((Get-Date -Format o) + " Starting installed app; launcher PID $PID.") -Encoding utf8
  & (Join-Path $PSScriptRoot 'Start-Finances.ps1')
  Add-Content -LiteralPath (Join-Path $financeLauncherRuntime 'launcher.log') -Value ((Get-Date -Format o) + ' Installed launcher completed.') -Encoding utf8
}
catch {
  $financeMessage = $_.Exception.Message
  try {
    if (-not $financeLauncherRuntime) { $financeLauncherRuntime = Join-Path $env:TEMP 'CFH-finance-launcher' }
    New-Item -ItemType Directory -Path $financeLauncherRuntime -Force | Out-Null
    $financeErrorLog = Join-Path $financeLauncherRuntime 'launcher-error.log'
    Add-Content -LiteralPath $financeErrorLog -Value ((Get-Date -Format o) + "`n" + $financeMessage + "`n" + $_.ScriptStackTrace) -Encoding utf8
    $financeMessage += "`n`nDetails: $financeErrorLog"
  } catch {}
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($financeMessage, 'Your finances could not open', 'OK', 'Error') | Out-Null
  exit 1
}
