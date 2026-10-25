param([switch]$NoBrowser, [switch]$ForcePortableNode, [ValidateRange(1024,65535)][int]$Port = 4318)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$financeRuntime = Join-Path $PSScriptRoot 'runtime'
New-Item -ItemType Directory -Path $financeRuntime -Force | Out-Null
$financeHasher = [System.Security.Cryptography.SHA256]::Create()
try { $financeId = ([BitConverter]::ToString($financeHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($PSScriptRoot.ToLowerInvariant())))).Replace('-', '').ToLowerInvariant() } finally { $financeHasher.Dispose() }
$financeUrl = "http://127.0.0.1:$Port"
$financeHealth = $null
try { $financeHealth = Invoke-RestMethod "$financeUrl/api/health" -TimeoutSec 2 } catch {}
if ($financeHealth) {
  if ($financeHealth.installationId -ne $financeId) { throw "Port $Port belongs to another service. Close that service or run this launcher with -Port followed by an unused port." }
  if (-not $NoBrowser) { Start-Process $financeUrl }
  Write-Host "Your finances is ready at $financeUrl"
  exit 0
}
function Test-FinanceNode([string]$NodePath) {
  if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath)) { return $false }
  try { $financeVersion = & $NodePath --version; return $LASTEXITCODE -eq 0 -and [int]($financeVersion.TrimStart('v').Split('.')[0]) -ge 24 } catch { return $false }
}
$financeNode = $null
$financeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $ForcePortableNode -and $financeInstalled -and (Test-FinanceNode $financeInstalled.Source)) { $financeNode = $financeInstalled.Source }
if (-not $financeNode) {
  $financeArchitecture = $env:PROCESSOR_ARCHITEW6432
  if (-not $financeArchitecture) { $financeArchitecture = $env:PROCESSOR_ARCHITECTURE }
  switch ($financeArchitecture.ToUpperInvariant()) {
    'ARM64' { $financeArch = 'arm64'; $financeHash = '88d36e8109736a2fa9bdc596f2cf507a3c52c69cdf96e54f8acd473ec14be853' }
    'AMD64' { $financeArch = 'x64'; $financeHash = '313fa40c0d7b18575821de8cb17483031fe07d95de5994f6f435f3b345f85c66' }
    default { throw 'Automatic setup supports 64-bit Windows (x64 or ARM64). Other systems can use Node.js 24 or newer and npm start.' }
  }
  $financeVersion = 'v24.14.0'
  $financeTools = Join-Path $financeRuntime 'tools'
  $financePackage = "node-$financeVersion-win-$financeArch"
  $financeNode = Join-Path $financeTools "$financePackage/node.exe"
  if (-not (Test-FinanceNode $financeNode)) {
    Write-Host 'Setting up Node.js for this app. This first start needs an internet connection; no administrator access is needed.'
    New-Item -ItemType Directory -Path $financeTools -Force | Out-Null
    $financeZip = Join-Path $financeTools "$financePackage.zip"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$financeVersion/$financePackage.zip" -OutFile $financeZip
    if ((Get-FileHash -LiteralPath $financeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $financeHash) { throw 'The Node.js download did not match its published checksum. It has not been run. Start again to retry the download.' }
    Expand-Archive -LiteralPath $financeZip -DestinationPath $financeTools -Force
    Remove-Item -LiteralPath $financeZip
    if (-not (Test-FinanceNode $financeNode)) { throw 'Node.js could not start. Check that your computer permits running downloaded apps.' }
  }
}
$financePrevious = @{}
foreach ($financeKey in @('FINANCE_PORT','FINANCE_RUNTIME_DIR','FINANCE_LAN','FINANCE_LAN_ADDRESSES','FINANCE_INSTALLATION_ID')) { $financePrevious[$financeKey] = [Environment]::GetEnvironmentVariable($financeKey, 'Process') }
try {
  $env:FINANCE_PORT = [string]$Port
  $env:FINANCE_RUNTIME_DIR = $financeRuntime
  $env:FINANCE_LAN = '0'
  $env:FINANCE_LAN_ADDRESSES = ''
  $env:FINANCE_INSTALLATION_ID = $financeId
  $financeProcess = Start-Process -FilePath $financeNode -ArgumentList @(('"' + (Join-Path $PSScriptRoot 'server/index.mjs') + '"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $financeRuntime 'service.log') -RedirectStandardError (Join-Path $financeRuntime 'service-error.log') -PassThru
} finally { foreach ($financeKey in $financePrevious.Keys) { [Environment]::SetEnvironmentVariable($financeKey, $financePrevious[$financeKey], 'Process') } }
Set-Content -LiteralPath (Join-Path $financeRuntime 'service.pid') -Value $financeProcess.Id -Encoding ascii
$financeReady = $false
for ($financeTry = 0; $financeTry -lt 60; $financeTry++) {
  try { $financeReady = (Invoke-RestMethod "$financeUrl/api/health" -TimeoutSec 1).installationId -eq $financeId } catch {}
  if ($financeReady) { break }
  if ($financeProcess.HasExited) { throw 'The app stopped. Check runtime/service-error.log, then start again.' }
  Start-Sleep -Milliseconds 250
}
if (-not $financeReady) { throw 'The app did not become ready. Check runtime/service-error.log, then start again.' }
Write-Host "Your finances is ready at $financeUrl. Your data stays in this app's runtime folder."
if (-not $NoBrowser) { Start-Process $financeUrl }
