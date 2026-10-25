param(
  [Parameter(Mandatory = $true)][string]$CompilerPath,
  [string]$PythonPath = 'python',
  [Parameter(Mandatory = $true)][string]$WorkDirectory,
  [Parameter(Mandatory = $true)][string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$financeRepository = Split-Path -Parent $PSScriptRoot
$financeCompiler = (Resolve-Path -LiteralPath $CompilerPath).Path
$financeWork = [IO.Path]::GetFullPath($WorkDirectory)
$financeOutput = [IO.Path]::GetFullPath($OutputDirectory)
$financeInstallerName = 'Your-Finances-Setup-1.0.0-x64.exe'
if (Test-Path -LiteralPath $financeWork) { throw 'WorkDirectory must be a new directory. Existing paths are never deleted or reused by this builder.' }
if (Test-Path -LiteralPath (Join-Path $financeOutput $financeInstallerName)) { throw 'OutputDirectory already contains this installer. Choose a fresh output directory.' }
if (-not (Test-Path -LiteralPath $financeCompiler -PathType Leaf)) { throw 'CompilerPath must point to ISCC.exe.' }
New-Item -ItemType Directory -Path $financeWork | Out-Null
New-Item -ItemType Directory -Path $financeOutput -Force | Out-Null
Push-Location -LiteralPath $financeRepository
try {
  & $PythonPath (Join-Path $PSScriptRoot 'build-product-downloads.py')
  if ($LASTEXITCODE -ne 0) { throw 'The allowlisted source download could not be built.' }
  $financeDownloads = Join-Path $financeRepository 'apps/community-platform/public/downloads'
  $financeSourceZip = Join-Path $financeDownloads 'finance-workspace.zip'
  $financeStage = Join-Path $financeWork 'stage'
  Expand-Archive -LiteralPath $financeSourceZip -DestinationPath $financeStage
  $financeProduct = Join-Path $financeStage 'finance-workspace'
  foreach ($financeForbidden in @('runtime','vendor','installed.json','node_modules','.openai','.env','.env.local')) {
    if (Test-Path -LiteralPath (Join-Path $financeProduct $financeForbidden)) { throw "Source ZIP contains a forbidden installer input: $financeForbidden" }
  }
  $financeNodeVersion = 'v24.14.0'
  $financeNodeZipHash = '313fa40c0d7b18575821de8cb17483031fe07d95de5994f6f435f3b345f85c66'
  $financeNodeExeHash = '63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088'
  $financeNodePackage = "node-$financeNodeVersion-win-x64"
  $financeNodeZip = Join-Path $financeWork ($financeNodePackage+'.zip')
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$financeNodeVersion/$financeNodePackage.zip" -OutFile $financeNodeZip
  if ((Get-FileHash -LiteralPath $financeNodeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $financeNodeZipHash) { throw 'Official Node.js archive checksum mismatch. Nothing from the archive has been executed.' }
  $financeNodeExpanded = Join-Path $financeWork 'node'
  Expand-Archive -LiteralPath $financeNodeZip -DestinationPath $financeNodeExpanded
  $financeNodeSource = Join-Path $financeNodeExpanded $financeNodePackage
  $financeNodeVendor = Join-Path $financeProduct 'vendor/node'
  New-Item -ItemType Directory -Path $financeNodeVendor -Force | Out-Null
  foreach ($financeNodeFile in @('node.exe','LICENSE')) { Copy-Item -LiteralPath (Join-Path $financeNodeSource $financeNodeFile) -Destination $financeNodeVendor }
  if ((Get-FileHash -LiteralPath (Join-Path $financeNodeVendor 'node.exe') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $financeNodeExeHash) { throw 'Bundled Node.js executable checksum mismatch.' }
  Set-Content -LiteralPath (Join-Path $financeProduct 'installed.json') -Value '{"product":"cfh-finance-workspace","installed":true}' -Encoding ascii
  $financeScript = Join-Path $financeProduct 'installer/finance-workspace.iss'
  & $financeCompiler "/DProductSource=$financeProduct" "/DInstallerOutput=$financeOutput" $financeScript
  if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed with exit code $LASTEXITCODE." }
  $financeInstaller = Join-Path $financeOutput $financeInstallerName
  if (-not (Test-Path -LiteralPath $financeInstaller)) { throw 'Compiler returned without creating the expected installer.' }
  $financeInstallerHash = (Get-FileHash -LiteralPath $financeInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
  $financeSourceHash = (Get-FileHash -LiteralPath $financeSourceZip -Algorithm SHA256).Hash.ToLowerInvariant()
  $financeRevision = (& git rev-parse HEAD).Trim()
  $financeDirty = [bool](& git status --porcelain)
  $financeManifest = [ordered]@{
    product = 'Your finances'; version = '1.0.0'; architecture = 'x64'
    installer = $financeInstallerName; installerSha256 = $financeInstallerHash
    sourceArchive = 'finance-workspace.zip'; sourceArchiveSha256 = $financeSourceHash
    nodeVersion = $financeNodeVersion; nodeArchiveSha256 = $financeNodeZipHash; nodeExecutableSha256 = $financeNodeExeHash
    compilerVersion = (Get-Item -LiteralPath $financeCompiler).VersionInfo.FileVersion
    compilerExecutableSha256 = (Get-FileHash -LiteralPath $financeCompiler -Algorithm SHA256).Hash.ToLowerInvariant()
    repositoryHead = $financeRevision; workingTreeHasChanges = $financeDirty
    builtAtUtc = [DateTime]::UtcNow.ToString('o')
  }
  $financeManifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $financeOutput 'finance-installer-manifest.json') -Encoding utf8
  Set-Content -LiteralPath (Join-Path $financeOutput ($financeInstallerName+'.sha256')) -Value ($financeInstallerHash+'  '+$financeInstallerName) -Encoding ascii
  Copy-Item -LiteralPath $financeSourceZip -Destination $financeOutput
  Copy-Item -LiteralPath (Join-Path $financeDownloads 'finance-workspace.sha256') -Destination $financeOutput
  Write-Output "Built $financeInstaller"
  Write-Output "Installer SHA256: $financeInstallerHash"
  Write-Output "Source ZIP SHA256: $financeSourceHash"
} finally { Pop-Location }
