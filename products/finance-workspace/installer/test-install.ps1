param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][string]$TestRoot
)
$ErrorActionPreference = 'Stop'
$financeInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
$financeTestRoot = [IO.Path]::GetFullPath($TestRoot)
if (Test-Path -LiteralPath $financeTestRoot) { throw 'Choose a new, empty test directory. Existing data is never overwritten by this test.' }
$financeRegistry = 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/{6DB9DAD6-C1D2-4DAA-9806-72C27448E84B}_is1'
if (Test-Path -LiteralPath $financeRegistry) { throw 'Your finances is already installed for this Windows account. Use a separate test account.' }
$financeDesktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Your finances.lnk'
$financeMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Your finances'
foreach ($financeExisting in @($financeDesktop, $financeMenu)) { if (Test-Path -LiteralPath $financeExisting) { throw "An existing shortcut would be affected: $financeExisting. Use a separate test account." } }
$script:financeBase = $null
New-Item -ItemType Directory -Path $financeTestRoot | Out-Null
$financeApp = Join-Path $financeTestRoot 'application'
$financeDataRoot = Join-Path $financeTestRoot 'local-data'
$financeData = Join-Path $financeDataRoot 'CFH/Your finances/runtime'
$financeOriginalLocal = $env:LOCALAPPDATA
$financeProof = New-Object System.Collections.Generic.List[string]
function Invoke-FinanceSetup([string]$Phase) {
  $financeResult = Start-Process -FilePath $financeInstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/DIR="'+$financeApp+'"'),('/LOG="'+(Join-Path $financeTestRoot ($Phase+'.log'))+'"')) -WindowStyle Hidden -Wait -PassThru
  if ($financeResult.ExitCode -ne 0) { throw "$Phase installer failed with exit code $($financeResult.ExitCode)." }
}
function Start-FinanceTestApp([switch]$FromShortcut) {
  if ($FromShortcut) {
    # Exercise the installed desktop shortcut and its actual browser-opening entry point.
    $financeShellEnvironment = $financeShell.Environment('PROCESS')
    $financeShellEnvironment.Item('LOCALAPPDATA') = $financeDataRoot
    $null = $financeShell.Run(('"'+$financeDesktop+'"'), 0, $false)
  } else { & (Join-Path $financeApp 'Start-Finances.ps1') -NoBrowser }
  $financeHealth = $null
  $financeReadiness = [Diagnostics.Stopwatch]::StartNew()
  while ($financeReadiness.Elapsed.TotalSeconds -lt 30) {
    $financePortFile = Join-Path $financeData 'service.port'
    if (Test-Path -LiteralPath $financePortFile) {
      $financePort = [int](Get-Content -LiteralPath $financePortFile -Raw).Trim()
      if ($financePort -lt 4318 -or $financePort -gt 4338) { throw 'The installer chose a port outside its documented local range.' }
      $script:financeBase = "http://127.0.0.1:$financePort"
      try { $financeHealth = Invoke-RestMethod "$financeBase/api/health" -TimeoutSec 1 } catch {}
    }
    if ($financeHealth) { break }
    Start-Sleep -Milliseconds 250
  }
  if (-not $financeHealth) {
    $financeDetails = @()
    foreach ($financeLogName in @('launcher.log','launcher-error.log','service-error.log')) {
      $financeLog = Join-Path $financeData $financeLogName
      if (Test-Path -LiteralPath $financeLog) { $financeDetails += $financeLogName + ': ' + ((Get-Content -LiteralPath $financeLog -Tail 30) -join "`n") }
    }
    if (-not $financeDetails.Count) { $financeDetails += 'No launcher logs appeared in the isolated data directory. Check the shortcut child process environment.' }
    throw ("The installed app did not become ready within 30 seconds.`n" + ($financeDetails -join "`n"))
  }
  if (-not $financeHealth.localOnly -or $financeHealth.automation.storagePath -ne (Join-Path $financeData 'finance.sqlite')) { throw 'Installed launcher did not use the isolated external data folder.' }
}
function Remove-FinanceTestApp([string]$Phase) {
  $financeUninstaller = Join-Path $financeApp 'unins000.exe'
  if (-not (Test-Path -LiteralPath $financeUninstaller)) { throw 'Installer did not create a standard uninstaller.' }
  $financeResult = Start-Process -FilePath $financeUninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG="'+(Join-Path $financeTestRoot ($Phase+'.log'))+'"')) -WindowStyle Hidden -Wait -PassThru
  if ($financeResult.ExitCode -ne 0) { throw "$Phase uninstall failed with exit code $($financeResult.ExitCode)." }
  if (Test-Path -LiteralPath $financeRegistry) { throw 'Uninstall left its registry entry.' }
  if (Test-Path -LiteralPath $financeDesktop) { throw 'Uninstall left its desktop shortcut.' }
  if (Test-Path -LiteralPath $financeMenu) { throw 'Uninstall left its Start Menu shortcuts.' }
}
try {
  $env:LOCALAPPDATA = $financeDataRoot
  Invoke-FinanceSetup 'install'
  if (-not (Test-Path -LiteralPath $financeRegistry)) { throw 'Per-user uninstall registration is missing.' }
  foreach ($financeShortcut in @($financeDesktop,(Join-Path $financeMenu 'Your finances.lnk'),(Join-Path $financeMenu 'Stop Your finances.lnk'))) { if (-not (Test-Path -LiteralPath $financeShortcut)) { throw "Missing shortcut: $financeShortcut" } }
  $financeShell = New-Object -ComObject WScript.Shell
  $financeShortcutData = $financeShell.CreateShortcut($financeDesktop)
  if ($financeShortcutData.Arguments -notlike ('*'+(Join-Path $financeApp 'Start-Installed-Finances.ps1')+'*')) { throw 'Desktop shortcut does not open this installation.' }
  Start-FinanceTestApp -FromShortcut
  $financeState = Invoke-RestMethod "$financeBase/api/state"
  if ($financeState.plan.balance -ne 0 -or $financeState.transactions.Count -ne 0) { throw 'Installer did not start with an empty plan.' }
  if ((Invoke-RestMethod "$financeBase/api/ai-access").enabled) { throw 'AI access was enabled by the installer.' }
  $financeState.plan.balance = 250
  $financeState.plan.accounts[0].balance = 250
  $null = Invoke-RestMethod "$financeBase/api/state" -Method Put -ContentType 'application/json' -Body ($financeState | ConvertTo-Json -Depth 30)
  $financeProof.Add("Installed per user with bundled runtime; actual desktop shortcut opened $financeBase and browser entry point; empty plan and AI off; saved synthetic balance 250.")
  $financeOldProcess = [int](Get-Content -LiteralPath (Join-Path $financeData 'service.pid'))
  Invoke-FinanceSetup 'active-upgrade'
  if (Get-CimInstance Win32_Process -Filter "ProcessId = $financeOldProcess") { throw 'Upgrade left the old service running.' }
  Start-FinanceTestApp
  if ((Invoke-RestMethod "$financeBase/api/state").plan.balance -ne 250) { throw 'Upgrade lost saved data.' }
  $financeProof.Add('Reinstalled over an active service; old service stopped, updated app reopened and balance persisted.')
  $financeOldProcess = [int](Get-Content -LiteralPath (Join-Path $financeData 'service.pid'))
  Remove-FinanceTestApp 'active-uninstall'
  if (Get-CimInstance Win32_Process -Filter "ProcessId = $financeOldProcess") { throw 'Uninstall left the service running.' }
  if (-not (Test-Path -LiteralPath (Join-Path $financeData 'finance.sqlite'))) { throw 'Uninstall deleted financial data.' }
  $financeProof.Add('Uninstalled while active; service, shortcuts and uninstall registration removed, data preserved.')
  Invoke-FinanceSetup 'reinstall'
  Start-FinanceTestApp
  if ((Invoke-RestMethod "$financeBase/api/state").plan.balance -ne 250) { throw 'Reinstall could not recover saved data.' }
  $financeProof.Add('Fresh reinstall recovered the preserved plan with balance 250.')
  Remove-FinanceTestApp 'final-uninstall'
  $financeProof.Add('Final cleanup removed the test installation; synthetic data and test logs remain under the test directory.')
  $financeProof | Set-Content -LiteralPath (Join-Path $financeTestRoot 'verification.txt') -Encoding utf8
  $financeProof | Write-Output
} finally {
  if (Test-Path -LiteralPath (Join-Path $financeApp 'Stop-Finances.ps1')) { & (Join-Path $financeApp 'Stop-Finances.ps1') }
  $env:LOCALAPPDATA = $financeOriginalLocal
}
