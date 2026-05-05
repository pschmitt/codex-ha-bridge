$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$VbsPath = Join-Path $Root "run-hidden.vbs"

if (-not (Test-Path $VbsPath)) {
  Write-Host "run-hidden.vbs was not found: $VbsPath"
  Read-Host "Press Enter to close"
  exit 1
}

$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupFolder "Codex Home Assistant MQTT Bridge.lnk"

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $Root
$Shortcut.WindowStyle = 7
$Shortcut.Description = "Publishes Codex usage limits to Home Assistant over MQTT."
$Shortcut.Save()

Start-Process -FilePath "wscript.exe" -ArgumentList "`"$VbsPath`"" -WindowStyle Hidden

Write-Host ""
Write-Host "Done. The bridge will start in the background when you sign in to Windows."
Write-Host "It has also been started now."
Write-Host ""
Write-Host "Startup shortcut:"
Write-Host $ShortcutPath
Write-Host ""
Write-Host "Log file:"
Write-Host (Join-Path $Root "logs\bridge.log")
Write-Host ""
Read-Host "Press Enter to close"
