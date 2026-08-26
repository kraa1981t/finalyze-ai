Write-Host "=== CURRENT SPEAKER STATUS ==="
Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.FriendlyName -match 'Speaker' } | ForEach-Object {
    Write-Host "  [$($_.Status)] $($_.FriendlyName) InstanceId: $($_.InstanceId)"
    $currentDevice = $_
}

Write-Host "`n=== ENABLING SPEAKER DEVICE ==="
$speaker = Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.FriendlyName -match 'Speaker' } | Select-Object -First 1
if ($speaker) {
    Write-Host "  Attempting to enable: $($speaker.FriendlyName)"
    Enable-PnpDevice -InstanceId $speaker.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $after = Get-PnpDevice -InstanceId $speaker.InstanceId -ErrorAction SilentlyContinue
    Write-Host "  After enable: [$($after.Status)]"
}

Write-Host "`n=== CHECKING AGAIN ==="
Start-Sleep -Seconds 2
Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.FriendlyName -match 'Speaker' } | ForEach-Object {
    Write-Host "  [$($_.Status)] $($_.FriendlyName)"
}

Write-Host "`n=== CHECKING IF AUDIO SERVICE IS ACTUALLY WORKING ==="
Get-Service Audiosrv | ForEach-Object {
    Write-Host "  Service: $($_.Name) Status: $($_.Status) StartType: $($_.StartType)"
}
Get-Service AudioEndpointBuilder | ForEach-Object {
    Write-Host "  Service: $($_.Name) Status: $($_.Status) StartType: $($_.StartType)"
}

Write-Host "`n=== CHECKING DRIVER DETAILS ==="
Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -eq 'MEDIA' } | ForEach-Object {
    Write-Host "  Device: $($_.DeviceName)"
    Write-Host "  InfName: $($_.InfName)"
    Write-Host "  DriverVersion: $($_.DriverVersion)"
    Write-Host "  IsSigned: $($_.IsSigned)"
}

Write-Host "`n=== CHECKING DEVICE MANAGER CONFLICTS ==="
Get-PnpDevice -Status Error -Class Media -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  ERROR: $($_.FriendlyName) Code: $($_.Problem)"
}
Get-PnpDevice -Status Degraded -Class Media -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  DEGRADED: $($_.FriendlyName) Code: $($_.Problem)"
}
