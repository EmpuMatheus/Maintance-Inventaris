; Inno Setup script for the Office Inventory desktop launcher.
; Build:   ISCC.exe installer\installer.iss
; Or:      npm run build:installer  (requires Inno Setup 6 on PATH)

#define MyAppName "Office Inventory"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Office Inventory"
#define MyAppExeName "Office Inventory.exe"

[Setup]
AppId={{B8A1C2D3-4E5F-6A7B-8C9D-0E1F2A3B4C5D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Office Inventory
DefaultGroupName={#MyAppName}
OutputDir=..\dist-installer
OutputBaseFilename=OfficeInventorySetup
SetupIconFile=office-inventory.ico
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
VersionInfoVersion={#MyAppVersion}
VersionInfoProductName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "startupicon"; Description: "Start Office Inventory automatically when Windows starts"; GroupDescription: "Additional shortcuts:"

[Files]
Source: "..\release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName} now"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\storage"
Type: filesandordirs; Name: "{app}\config.json"
Type: filesandordirs; Name: "{app}\.office-inventory.lock"
