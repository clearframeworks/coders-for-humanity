$ErrorActionPreference='Stop'
$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Vault Manager.ps1'),[ref]$null,[ref]$null)
$funcs=$ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -in @('Run-Compose','Stop-PhoneProxy')},$true)
foreach($fn in $funcs){Invoke-Expression $fn.Extent.Text}
$global:seen=@();$global:failDocker=$false
function global:docker { $global:seen=@($args); if($global:failDocker){$global:LASTEXITCODE=1;'fixture failure'} else {$global:LASTEXITCODE=0;'ok'} }
$env:TETHER_IP=$null
Stop-PhoneProxy
if (($global:seen -join ' ') -ne 'compose -f compose.yaml -f phone.yaml stop phone_https') { throw 'Did not stop the phone service.' }
if ($env:TETHER_IP) { throw 'Did not restore original tether setting.' }
$global:failDocker=$true
try { Stop-PhoneProxy; throw 'Expected failure was not raised.' } catch { if ($_.Exception.Message -notlike 'Docker could not complete*') {throw} }
if ($env:TETHER_IP) { throw 'Did not restore tether setting after failure.' }
'PASS: phone stop uses intended service and fails closed on Docker error'
$source=Get-Content -Raw (Join-Path $PSScriptRoot 'Vault Manager.ps1')
$start=$source.IndexOf("Invoke-Action 'Enabling registration'")
$end=$source.IndexOf("Make-Button 'Turn registration off'",$start)
if($start -lt 0 -or $end -lt 0){throw 'Registration action missing.'}
$block=$source.Substring($start,$end-$start)
if(-not ($block.IndexOf('Stop-PhoneProxy') -lt $block.IndexOf("VAULT_SIGNUPS_ALLOWED = 'true'") -and $block.IndexOf('registrationMayBeOn = $true') -lt $block.IndexOf('Run-Compose'))) {throw 'Signup safety sequence missing.'}
'PASS: registration stops phone before enabling and records pending state before recreation'
