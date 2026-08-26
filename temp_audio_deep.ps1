Write-Host "=== 1. DEFAULT PLAYBACK DEVICE ==="
$reg = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Multimedia\Audio\Volume' -ErrorAction SilentlyContinue
if ($reg) { $reg | Format-List }
else { Write-Host "  Registry key not found" }

$reg2 = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Multimedia\Sound Mapper' -ErrorAction SilentlyContinue
if ($reg2) { Write-Host "  Playback: $($reg2.Playback)"; Write-Host "  Record: $($reg2.Record)" }
else { Write-Host "  Sound Mapper key not found" }

Write-Host "`n=== 2. ALL AUDIO ENDPOINTS (ALL STATUS) ==="
Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  [$($_.Status)] $($_.FriendlyName)"
}

Write-Host "`n=== 3. CHECKING IF MULTIPLE AUDIO OUTPUTS EXIST ==="
Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match 'Speaker|Headphone|HDMI|Display|Digital' } | ForEach-Object {
    Write-Host "  Output: [$($_.Status)] $($_.FriendlyName)"
}

Write-Host "`n=== 4. AUDIO DRIVER VERSIONS ==="
Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -eq 'MEDIA' } | ForEach-Object {
    Write-Host "  Driver: $($_.DriverVersion) | Device: $($_.DeviceName) | Date: $($_.DriverDate)"
}

Write-Host "`n=== 5. CHECKING DISABLING OF AUDIO IN DEVICE MANAGER ==="
Get-PnpDevice -Class Media | ForEach-Object {
    $problem = $_.Problem
    $status = $_.Status
    $friendly = $_.FriendlyName
    if ($problem -ne 0 -and $problem -ne $null) {
        Write-Host "  PROBLEM: [$status] $friendly - Code: $problem"
    }
}

Write-Host "`n=== 6. AUDIO TROUBLESHOOTER RESULTS ==="
Write-Host "  (DiagTrack / AudioDiag not available via CLI, checking event log)"

Write-Host "`n=== 7. RECENT AUDIO-RELATED EVENTS ==="
Get-WinEvent -LogName System -MaxEvents 50 -ErrorAction SilentlyContinue | Where-Object { 
    $_.ProviderName -match 'audio|sound|wave|device' -or $_.LevelDisplayName -eq 'Error'
} | Select-Object -First 15 | ForEach-Object {
    Write-Host "  [$($_.TimeCreated)] Level=$($_.LevelDisplayName) Msg=$($_.Message.Substring(0, [Math]::Min(120, $_.Message.Length)))"
}

Write-Host "`n=== 8. CHECKING NVIDIA/AMD HDMI AUDIO ==="
Get-PnpDevice | Where-Object { $_.FriendlyName -match 'NVIDIA|AMD|RADEON|HDMI' } | ForEach-Object {
    Write-Host "  [$($_.Status)] $($_.FriendlyName) (Class: $($_.Class))"
}

Write-Host "`n=== 9. WINDOWS AUDIO SESSIONS (RUNTIME) ==="
Write-Host "  Checking svchost Audio service..."
Get-Process svchost | Where-Object { $_.Id -gt 0 } | Select-Object -First 3 | ForEach-Object {
    $cpu = $_.CPU
    Write-Host "  svchost PID=$($_.Id) CPU=$([Math]::Round($cpu,2))"
}
