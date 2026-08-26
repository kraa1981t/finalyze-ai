Write-Host "=== RESTARTING WINDOWS AUDIO SERVICE ==="
Restart-Service Audiosrv -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Restart-Service AudioEndpointBuilder -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$svc1 = Get-Service Audiosrv
$svc2 = Get-Service AudioEndpointBuilder
Write-Host "  Windows Audio: $($svc1.Status)"
Write-Host "  Audio Endpoint Builder: $($svc2.Status)"

Write-Host "`n=== CHECKING OUTPUT DEVICE AFTER RESTART ==="
Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.FriendlyName -match 'Speaker' } | ForEach-Object {
    Write-Host "  [$($_.Status)] $($_.FriendlyName)"
}

Write-Host "`n=== CHECKING IF DEVICE IS DEFAULT ==="
$defaultDevice = Get-AudioDevice -ErrorAction SilentlyContinue
if ($defaultDevice) { Write-Host "  Default: $defaultDevice" }

Write-Host "`n=== CHECKING SAPI (Windows Speech) ==="
$sapiDevices = Get-WmiObject Win32_SoundDevice | Where-Object { $_.Status -eq 'OK' }
foreach ($d in $sapiDevices) {
    Write-Host "  Active device: $($d.Name)"
}

Write-Host "`n=== CHECKING COMCNTRL ==="
# Check if audio enhancements are causing issues
$audioEnhancements = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Audio' -ErrorAction SilentlyContinue
if ($audioEnhancements) { $audioEnhancements | Format-List }
else { Write-Host "  No audio enhancements registry found" }

# Check if disabled audio enhancements
$disabledEnh = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Audio\DisableEnhancements' -ErrorAction SilentlyContinue
if ($disabledEnh) { Write-Host "  Enhancements disabled: $disabledEnh" }
else { Write-Host "  Enhancements status: default (enabled)" }
