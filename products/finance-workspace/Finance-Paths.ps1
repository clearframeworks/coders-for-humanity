# Shared by the portable launcher and installed shortcuts. The installer creates
# installed.json; source downloads never contain this activation marker.
function Get-FinancePaths {
  param([string]$AppRoot = $PSScriptRoot)
  $financeMarker = Join-Path $AppRoot 'installed.json'
  $financeIsInstalled = $false
  if (Test-Path -LiteralPath $financeMarker) {
    $financeConfiguration = Get-Content -LiteralPath $financeMarker -Raw | ConvertFrom-Json
    if ($financeConfiguration.product -ne 'cfh-finance-workspace' -or $financeConfiguration.installed -ne $true) { throw 'The installed app configuration is invalid. Run the installer again.' }
    $financeIsInstalled = $true
  }
  if ($financeIsInstalled) {
    if (-not $env:LOCALAPPDATA) { throw 'Your Windows local application data folder is unavailable.' }
    $financeData = Join-Path $env:LOCALAPPDATA 'CFH/Your finances/runtime'
  } else { $financeData = Join-Path $AppRoot 'runtime' }
  return @{ Installed = $financeIsInstalled; Runtime = $financeData }
}

function Resolve-FinanceLaunchPort {
  param([string]$Runtime, [string]$InstallationId, [int]$Port = 4318, [switch]$Automatic, [int[]]$ExcludedPorts = @())
  $financeCandidates = @($Port)
  if ($Automatic) {
    $financeCandidates = @(4318..4338)
    $financeRemembered = 0
    $financePortFile = Join-Path $Runtime 'service.port'
    if ((Test-Path -LiteralPath $financePortFile) -and [int]::TryParse((Get-Content -LiteralPath $financePortFile -Raw).Trim(), [ref]$financeRemembered) -and $financeRemembered -ge 4318 -and $financeRemembered -le 4338) {
      $financeCandidates = @($financeRemembered) + @($financeCandidates | Where-Object { $_ -ne $financeRemembered })
    }
  }
  foreach ($financeCandidate in $financeCandidates) {
    if ($ExcludedPorts -contains $financeCandidate) { continue }
    $financeHealth = $null
    try { $financeHealth = Invoke-RestMethod "http://127.0.0.1:$financeCandidate/api/health" -TimeoutSec 1 } catch {}
    if ($financeHealth -and $financeHealth.installationId -eq $InstallationId -and $financeHealth.storage -eq 'sqlite') { return @{ Port = $financeCandidate; Ready = $true } }
    $financeListener = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $financeCandidate)
    try {
      $financeListener.ExclusiveAddressUse = $true
      $financeListener.Start()
      return @{ Port = $financeCandidate; Ready = $false }
    } catch {
      if (-not $Automatic) { throw "Port $Port belongs to another service. Close that service or run this launcher with -Port followed by an unused port." }
    } finally { $financeListener.Stop() }
  }
  throw 'Your finances could not find an available local port from 4318 to 4338. Close an unused local app and try again.'
}
