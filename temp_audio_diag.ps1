Write-Host "=== AUDIO DEVICES - FULL DETAIL ==="
$devices = Get-WmiObject Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -eq 'MEDIA' }
foreach ($d in $devices) {
    Write-Host "-----------------------------------"
    Write-Host "  Device:       $($d.DeviceName)"
    Write-Host "  HardwareID:   $($d.HardWareID)"
    Write-Host "  CompatibleID: $($d.CompatibleID)"
    Write-Host "  InfName:      $($d.InfName)"
    Write-Host "  DriverVer:    $($d.DriverVersion)"
    Write-Host "  DriverDate:   $($d.DriverDate)"
    Write-Host "  IsSigned:     $($d.IsSigned)"
    Write-Host "  Location:     $($d.Location)"
}

Write-Host "`n=== PNP DEVICE DETAILS ==="
Get-PnpDevice -Class Media | Where-Object { $_.Status -ne 'Unknown' -or $_.FriendlyName -match 'High Def' } | ForEach-Object {
    Write-Host "-----------------------------------"
    Write-Host "  Name:    $($_.FriendlyName)"
    Write-Host "  Status:  $($_.Status)"
    Write-Host "  Problem: $($_.Problem)"
    Write-Host "  Class:   $($_.Class)"
    Write-Host "  Instance:$($_.InstanceId)"
}

Write-Host "`n=== CHECKING IRQ/DMA ISSUES ==="
Get-WmiObject Win32_IRQResource | Where-Object { $_.IRQNumber -gt 0 } | Select-Object -First 10 | ForEach-Object {
    Write-Host "  IRQ $($_.IRQNumber): $($_.Name) Shared=$($_.Sharing)"
}

Write-Host "`n=== CHECKING IF REALTEK DRIVER EXISTS ==="
$realtekPath = "C:\Windows\System32\DriverStore\FileRepository"
Get-ChildItem -Path $realtekPath -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'realtek|rtk|hda' } | ForEach-Object {
    Write-Host "  Found: $($_.Name)"
}

Write-Host "`n=== AUDIO CODEC CHECK ==="
Get-WmiObject Win32_SoundDevice | ForEach-Object {
    Write-Host "  PNPDeviceID: $($_.PNPDeviceID)"
}

Write-Host "`n=== VOLUME LEVEL VIA SAPI ==="
try {
    # Simple test - make Windows speak something very short to test audio path
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    Write-Host "  SpeechSynth available: $($synth.Voice.Name)"
    $synth.Dispose()
} catch {
    Write-Host "  SAPI: $($_.Exception.Message)"
}

Write-Host "`n=== REALTEST: PLAY A TONE VIA POWERSHELL ==="
try {
    [console]::beep(800, 200)
    Write-Host "  Console beep worked - audio path may be OK at OS level"
} catch {
    Write-Host "  Console beep failed: $($_.Exception.Message)"
}
