Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Set-Location -LiteralPath $PSScriptRoot
$ErrorActionPreference = 'Stop'
$window = New-Object System.Windows.Forms.Form
$window.Text = 'Local Vault Manager'
$window.Size = New-Object System.Drawing.Size(650,555)
$window.StartPosition = 'CenterScreen'
$window.Font = New-Object System.Drawing.Font('Segoe UI',10)
$window.MinimumSize = $window.Size
$title = New-Object System.Windows.Forms.Label
$title.Text = 'Local Vault Manager'
$title.Font = New-Object System.Drawing.Font('Segoe UI',18,[System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(20,18)
$window.Controls.Add($title)
$intro = New-Object System.Windows.Forms.Label
$intro.Text = "Start your local vault, create your account once, then turn registration off. Your passwords are not entered in this window."
$intro.Location = New-Object System.Drawing.Point(23,65)
$intro.Size = New-Object System.Drawing.Size(590,48)
$window.Controls.Add($intro)
$status = New-Object System.Windows.Forms.TextBox
$status.Multiline = $true
$status.ReadOnly = $true
$status.ScrollBars = 'Vertical'
$status.Location = New-Object System.Drawing.Point(23,350)
$status.Size = New-Object System.Drawing.Size(585,140)
$status.Text = 'Ready. Docker Desktop must be running.'
$window.Controls.Add($status)
function Add-Status([string]$message) { $status.AppendText("`r`n$message") }
function Run-Compose([string[]]$commandArgs) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $out = & docker compose @commandArgs 2>&1 | Out-String; $code = $LASTEXITCODE }
  finally { $ErrorActionPreference = $previous }
  if ($code -ne 0) { throw "Docker could not complete the operation. Make sure Docker Desktop is running and available to this account.`r`n$out" }
  return $out
}
function Confirm-RegistrationDisabled {
  $containerId = (Run-Compose @('ps','-q','vault')).Trim()
  if (-not $containerId) { throw 'Could not confirm registration is off: the vault container is not running.' }
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $configured = & docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' $containerId 2>&1; $code = $LASTEXITCODE }
  finally { $ErrorActionPreference = $previous }
  if ($code -ne 0 -or -not ($configured -contains 'SIGNUPS_ALLOWED=false')) { throw 'Could not confirm registration is off. Check Docker and try Turn registration off again.' }
}
function Stop-PhoneProxy {
  $oldTetherIP = $env:TETHER_IP
  if (-not $oldTetherIP) { $env:TETHER_IP = '127.0.0.1' }
  try { Run-Compose @('-f','compose.yaml','-f','phone.yaml','stop','phone_https') | Out-Null }
  finally { $env:TETHER_IP = $oldTetherIP }
}
$script:registrationMayBeOn = $false
$registrationTimer = New-Object System.Windows.Forms.Timer
$registrationTimer.Interval = 300000
$registrationTimer.Add_Tick({
  $registrationTimer.Stop()
  Invoke-Action 'Turning off registration after five minutes' {
    $env:VAULT_SIGNUPS_ALLOWED = 'false'
    Run-Compose @('up','-d','--force-recreate','vault') | Out-Null
    Confirm-RegistrationDisabled
    $script:registrationMayBeOn = $false
    Add-Status 'Registration is off.'
  }
})
function Make-Button([string]$text,[int]$y,[scriptblock]$action) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $text
  $button.Location = New-Object System.Drawing.Point(23,$y)
  $button.Size = New-Object System.Drawing.Size(285,39)
  $button.Add_Click($action)
  $window.Controls.Add($button)
}
function Invoke-Action([string]$description,[scriptblock]$action) {
  $window.UseWaitCursor = $true
  Add-Status "$description…"
  try { & $action; Add-Status 'Done.' }
  catch { Add-Status $_.Exception.Message; [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Local Vault Manager','OK','Error') | Out-Null }
  finally { $window.UseWaitCursor = $false }
}
Make-Button 'Start vault (registration off)' 120 {
  Invoke-Action 'Starting vault' {
    $env:VAULT_SIGNUPS_ALLOWED = 'false'
    Run-Compose @('up','-d','--force-recreate','vault') | Out-Null
    Add-Status 'Open the vault to sign in.'
  }
}
Make-Button 'Create first account' 165 {
  $answer = [System.Windows.Forms.MessageBox]::Show('This temporarily allows account registration. Create your account immediately, then click Turn registration off. Continue?','Initial setup','YesNo','Warning')
  if ($answer -eq 'Yes') {
    Invoke-Action 'Enabling registration' {
      Stop-PhoneProxy
      $env:VAULT_SIGNUPS_ALLOWED = 'true'
      $script:registrationMayBeOn = $true
      Run-Compose @('up','-d','--force-recreate','vault') | Out-Null
      $registrationTimer.Start()
    Add-Status 'Create your account, then return here and turn registration off. The manager will also try to turn it off after five minutes.'
      Start-Process 'http://localhost:8787'
    }
  }
}
Make-Button 'Turn registration off' 210 {
  Invoke-Action 'Disabling registration' {
    $env:VAULT_SIGNUPS_ALLOWED = 'false'
    Run-Compose @('up','-d','--force-recreate','vault') | Out-Null
    Confirm-RegistrationDisabled
    $registrationTimer.Stop()
    $script:registrationMayBeOn = $false
    Add-Status 'Registration is configured off. Verify that creating an account is refused.'
  }
}
Make-Button 'Open vault in browser' 255 { Start-Process 'http://localhost:8787' }
$guide = New-Object System.Windows.Forms.Button
$guide.Text = 'Read phone, import and backup guide'
$guide.Location = New-Object System.Drawing.Point(323,120)
$guide.Size = New-Object System.Drawing.Size(285,65)
$guide.Add_Click({ Start-Process (Join-Path $PSScriptRoot 'README.md') })
$window.Controls.Add($guide)
$stop = New-Object System.Windows.Forms.Button
$stop.Text = 'Stop vault'
$stop.Location = New-Object System.Drawing.Point(323,210)
$stop.Size = New-Object System.Drawing.Size(285,39)
$stop.Add_Click({ Invoke-Action 'Stopping vault and phone access' { Stop-PhoneProxy; Run-Compose @('stop') | Out-Null; $registrationTimer.Stop(); $env:VAULT_SIGNUPS_ALLOWED = 'false'; $script:registrationMayBeOn = $false } })
$window.Controls.Add($stop)
$grantButton = New-Object System.Windows.Forms.Button
$grantButton.Text = 'Create one-time access grant'
$grantButton.Location = New-Object System.Drawing.Point(323,255)
$grantButton.Size = New-Object System.Drawing.Size(285,39)
$grantButton.Add_Click({
  try {
    if (-not $script:grantProcess -or $script:grantProcess.HasExited) {
      $node = Get-Command node.exe -ErrorAction Stop
      $script:grantProcess = Start-Process -FilePath $node.Source -ArgumentList ('"' + (Join-Path $PSScriptRoot 'grant-server.cjs') + '"') -WindowStyle Hidden -PassThru
      Start-Sleep -Milliseconds 600
      if ($script:grantProcess.HasExited) { throw 'Grant service did not start. Port 8788 may already be in use.' }
    }
    Start-Process 'http://127.0.0.1:8788/'
  } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Grant service','OK','Error') | Out-Null }
})
$window.Controls.Add($grantButton)
$phoneButton = New-Object System.Windows.Forms.Button
$phoneButton.Text = 'Set up phone HTTPS'
$phoneButton.Location = New-Object System.Drawing.Point(323,298)
$phoneButton.Size = New-Object System.Drawing.Size(285,39)
$phoneButton.Add_Click({
  $phone = New-Object System.Windows.Forms.Form
  $phone.Text = 'Phone over hotspot or tether'
  $phone.Size = New-Object System.Drawing.Size(570,330)
  $phone.StartPosition = 'CenterParent'
  $phone.Font = $window.Font
  $explain = New-Object System.Windows.Forms.Label
  $explain.Text = 'Enter this computers IPv4 address on the tether network. The phone must be able to reach it. Read the guide before installing the private CA on your phone.'
  $explain.Location = New-Object System.Drawing.Point(18,15)
  $explain.Size = New-Object System.Drawing.Size(515,75)
  $phone.Controls.Add($explain)
  $ip = New-Object System.Windows.Forms.TextBox
  $ip.Location = New-Object System.Drawing.Point(20,100)
  $ip.Size = New-Object System.Drawing.Size(240,30)
  $phone.Controls.Add($ip)
  $start = New-Object System.Windows.Forms.Button
  $start.Text = 'Start HTTPS and export certificate'
  $start.Location = New-Object System.Drawing.Point(20,150)
  $start.Size = New-Object System.Drawing.Size(330,42)
  $start.Add_Click({
    try {
      $address = $null
      if (-not [System.Net.IPAddress]::TryParse($ip.Text.Trim(), [ref]$address) -or $address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or [System.Net.IPAddress]::IsLoopback($address)) { throw 'Enter the computers reachable tether IPv4 address, such as 192.168.1.10.' }
      $env:TETHER_IP = $address.ToString()
      $env:VAULT_SIGNUPS_ALLOWED = 'false'
      $window.UseWaitCursor = $true
      Run-Compose @('up','-d','--force-recreate','vault') | Out-Null
      Confirm-RegistrationDisabled
      $registrationTimer.Stop()
      $script:registrationMayBeOn = $false
      Run-Compose @('-f','compose.yaml','-f','phone.yaml','up','-d') | Out-Null
      $cert = Join-Path $PSScriptRoot 'local-vault-root.crt'
      Run-Compose @('-f','compose.yaml','-f','phone.yaml','cp','phone_https:/data/caddy/pki/authorities/local/root.crt',$cert) | Out-Null
      [System.Windows.Forms.MessageBox]::Show("HTTPS started. Open https://$($env:TETHER_IP):8443 on the phone after installing and explicitly trusting the public certificate at:`r`n$cert`r`n`r`nRead the guide for security and phone compatibility details.",'Phone access','OK','Information') | Out-Null
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Phone access','OK','Error') | Out-Null }
    finally { $window.UseWaitCursor = $false }
  })
  $phone.Controls.Add($start)
  $stopPhone = New-Object System.Windows.Forms.Button
  $stopPhone.Text = 'Stop phone HTTPS'
  $stopPhone.Location = New-Object System.Drawing.Point(20,210)
  $stopPhone.Size = New-Object System.Drawing.Size(220,40)
  $stopPhone.Add_Click({
    try {
      if (-not $env:TETHER_IP) { $env:TETHER_IP = '127.0.0.1' }
      Run-Compose @('-f','compose.yaml','-f','phone.yaml','stop','phone_https') | Out-Null
      $env:VAULT_SIGNUPS_ALLOWED = 'false'
      Run-Compose @('up','-d','--force-recreate','vault') | Out-Null
      [System.Windows.Forms.MessageBox]::Show('Phone HTTPS stopped.','Phone access') | Out-Null
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Phone access','OK','Error') | Out-Null }
  })
  $phone.Controls.Add($stopPhone)
  [void]$phone.ShowDialog($window)
})
$window.Controls.Add($phoneButton)
$window.Add_FormClosed({
  if ($script:grantProcess -and -not $script:grantProcess.HasExited) { Stop-Process -Id $script:grantProcess.Id }
  if ($script:registrationMayBeOn) {
    $registrationTimer.Stop()
    $env:VAULT_SIGNUPS_ALLOWED = 'false'
    try { Run-Compose @('up','-d','--force-recreate','vault') | Out-Null; Confirm-RegistrationDisabled }
    catch { [System.Windows.Forms.MessageBox]::Show('Could not turn registration off. Restart the manager and click Turn registration off.','Local Vault Manager','OK','Error') | Out-Null }
  }
})
[void]$window.ShowDialog()
