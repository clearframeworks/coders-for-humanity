$ErrorActionPreference='Stop'
try {
  $target=Join-Path $env:LOCALAPPDATA 'LocalVault'
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  $files=@('compose.yaml','phone.yaml','Caddyfile','README.md','Open Vault Manager.cmd','Vault Manager.ps1','grant-server.cjs','grant.html')
  foreach($file in $files) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $target $file) -Force }
  $modules=Join-Path $PSScriptRoot 'node_modules'
  if (Test-Path -LiteralPath $modules) {
    $destModules=Join-Path $target 'node_modules'
    New-Item -ItemType Directory -Force -Path $destModules | Out-Null
    Copy-Item -Path (Join-Path $modules '*') -Destination $destModules -Recurse -Force
  }
  $desktop=[Environment]::GetFolderPath('Desktop')
  $shell=New-Object -ComObject WScript.Shell
  $shortcut=$shell.CreateShortcut((Join-Path $desktop 'Local Vault.lnk'))
  $shortcut.TargetPath=Join-Path $target 'Open Vault Manager.cmd'
  $shortcut.WorkingDirectory=$target
  $shortcut.Description='Open Local Vault Manager'
  $shortcut.Save()
  Write-Host "Installed Local Vault Manager to $target and created a desktop shortcut."
  Write-Host 'Docker Desktop must be running; Node.js is needed for one-time grants.'
  Write-Host 'Passwords remain in the Docker volume; reinstalling these files does not erase the volume.'
} catch { Write-Error $_; exit 1 }
