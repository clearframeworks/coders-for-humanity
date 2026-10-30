; Build against a staged product containing installed.json and vendor/node/node.exe.
; Those generated files never belong in the portable source ZIP.
#ifndef ProductSource
  #error Define ProductSource as the absolute staged product directory.
#endif
#ifndef InstallerOutput
  #error Define InstallerOutput as the absolute installer output directory.
#endif

[Setup]
AppId={{6DB9DAD6-C1D2-4DAA-9806-72C27448E84B}
AppName=Your finances
AppVersion=1.1.0
AppPublisher=Coders for Humanity
AppPublisherURL=https://github.com/clearframeworks/coders-for-humanity
DefaultDirName={localappdata}\Programs\CFH\Your finances
DefaultGroupName=Your finances
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableProgramGroupPage=yes
DisableDirPage=yes
WizardStyle=modern
LicenseFile={#ProductSource}\LICENSE
OutputDir={#InstallerOutput}
OutputBaseFilename=Your-Finances-Setup-1.1.0-x64
Compression=lzma2
SolidCompression=yes
CloseApplications=no
RestartApplications=no
UninstallDisplayName=Your finances
UninstallDisplayIcon={sys}\shell32.dll,21

[Files]
Source: "{#ProductSource}\*"; DestDir: "{app}"; Excludes: "runtime\*,node_modules\*,.openai\*,.env*,installer\output\*"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Your finances"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Start-Installed-Finances.ps1"""; WorkingDir: "{app}"; IconFilename: "{sys}\shell32.dll"; IconIndex: 21
Name: "{userdesktop}\Your finances"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Start-Installed-Finances.ps1"""; WorkingDir: "{app}"; IconFilename: "{sys}\shell32.dll"; IconIndex: 21
Name: "{group}\Stop Your finances"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Stop-Finances.ps1"""; WorkingDir: "{app}"
Name: "{group}\Uninstall Your finances"; Filename: "{uninstallexe}"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Start-Installed-Finances.ps1"""; Description: "Open Your finances"; Flags: nowait postinstall skipifsilent runhidden

[Code]
function StopInstalledApp(): Boolean;
var
  ExitCode: Integer;
  StopScript: String;
begin
  Result := True;
  StopScript := ExpandConstant('{app}\Stop-Finances.ps1');
  if FileExists(StopScript) then
    Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + StopScript + '"',
      ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ExitCode) and (ExitCode = 0);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if not StopInstalledApp() then
    Result := 'Your finances could not stop safely. Close the app service, then try installing again. Your saved data has not been removed.';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if (CurUninstallStep = usUninstall) and not StopInstalledApp() then
    RaiseException('Your finances could not stop safely. Close the app service before uninstalling. Your saved data has not been removed.');
end;

// There is deliberately no UninstallDelete entry for user data. The runtime is
// outside the application folder, and financial records are never installer-owned.
