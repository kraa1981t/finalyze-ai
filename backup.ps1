# Joseph.Trading Codebase Backup & Factory Reset System
param (
    [string]$Action = "save",
    [string]$Version = "1"
)

$BackupRoot = Join-Path $PSScriptRoot ".backups"
$VersionDir = Join-Path $BackupRoot "v$Version"

$FilesToBackup = @("src", "api", "server.ts", "package.json", "vite.config.ts", "tsconfig.json", ".env")

if ($Action -eq "save") {
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "SAVING BACKUP VERSION: v$Version" -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Cyan
    
    if (-not (Test-Path $BackupRoot)) {
        New-Item -ItemType Directory -Path $BackupRoot | Out-Null
    }
    
    if (Test-Path $VersionDir) {
        Write-Host "Warning: Backup version v$Version already exists! Overwriting..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $VersionDir | Out-Null
    }
    
    New-Item -ItemType Directory -Path $VersionDir | Out-Null
    
    foreach ($item in $FilesToBackup) {
        $sourcePath = Join-Path $PSScriptRoot $item
        if (Test-Path $sourcePath) {
            $destPath = Join-Path $VersionDir $item
            Write-Host "Copying $item -> $destPath..." -ForegroundColor Gray
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force | Out-Null
        } else {
            Write-Host "Skipping $item (Not Found)" -ForegroundColor DarkGray
        }
    }
    
    # Auto-update stable-ref.json with current git HEAD
    $currentHash = (git rev-parse HEAD).Trim()
    $currentMsg = (git log --oneline -1).Trim()
    $dateStr = Get-Date -Format "yyyy-MM-dd HH:mm"
    $refPath = Join-Path $BackupRoot "stable-ref.json"
    $refJson = "{`"stableVersion`":`"$currentHash`",`"description`":`"$currentMsg`",`"savedAt`":`"$dateStr`",`"autoUpdate`":true}"
    Set-Content -Path $refPath -Value $refJson
    Write-Host "Auto-updated stable-ref.json to $currentHash ($currentMsg)" -ForegroundColor Yellow
    
    Write-Host ""
    Write-Host "SUCCESS: Backup version v$Version created successfully at $VersionDir!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Cyan
}
elseif ($Action -eq "restore") {
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "RESTORING FACTORY RESET: v$Version" -ForegroundColor Yellow
    Write-Host "WARNING: THIS WILL OVERWRITE YOUR CURRENT CODE!" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
    
    if (-not (Test-Path $VersionDir)) {
        Write-Error "Error: Backup version v$Version not found at $VersionDir!"
        exit 1
    }
    
    # Safely clear current directories to ensure clean restore
    foreach ($item in $FilesToBackup) {
        $targetPath = Join-Path $PSScriptRoot $item
        if (Test-Path $targetPath) {
            Write-Host "Removing existing $item..." -ForegroundColor Gray
            Remove-Item -Recurse -Force $targetPath | Out-Null
        }
    }
    
    # Restore from backup
    foreach ($item in $FilesToBackup) {
        $sourcePath = Join-Path $VersionDir $item
        if (Test-Path $sourcePath) {
            $destPath = Join-Path $PSScriptRoot $item
            Write-Host "Restoring $item..." -ForegroundColor Gray
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force | Out-Null
        }
    }
    
    Write-Host ""
    Write-Host "SUCCESS: Codebase successfully restored to Version $Version (Factory Reset Completed)!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Red
}
else {
    Write-Host "Invalid Action! Use 'save' or 'restore'. Example: ./backup.ps1 save 1" -ForegroundColor Red
}
