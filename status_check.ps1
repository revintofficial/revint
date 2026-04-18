Write-Host "=== DISK DURUMU ===" -ForegroundColor Cyan
Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
    $used = [math]::Round(($_.Size - $_.FreeSpace)/1GB, 1)
    $free = [math]::Round($_.FreeSpace/1GB, 1)
    $total = [math]::Round($_.Size/1GB, 1)
    $pct = [math]::Round(($_.Size - $_.FreeSpace)/$_.Size * 100, 1)
    Write-Host "  $($_.DeviceID) ${used}GB kullanilan / ${total}GB toplam / ${free}GB bos (%${pct} dolu)"
}

Write-Host ""
Write-Host "=== BELLEK & CPU ===" -ForegroundColor Cyan
$os = Get-CimInstance Win32_OperatingSystem
$used = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)/1MB, 1)
$free = [math]::Round($os.FreePhysicalMemory/1MB, 1)
$cpu = (Get-CimInstance Win32_Processor).LoadPercentage
Write-Host "  RAM: ${used}GB kullanilan / ${free}GB bos"
Write-Host "  CPU: ${cpu}%"

Write-Host ""
Write-Host "=== STARTUP UYGULAMALARI ===" -ForegroundColor Cyan

Write-Host ""
Write-Host "-- Registry Run (HKCU) --" -ForegroundColor Yellow
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
if (Test-Path $regPath) {
    $items = Get-ItemProperty $regPath
    foreach ($prop in $items.PSObject.Properties) {
        if ($prop.Name -notlike "PS*") {
            Write-Host "  $($prop.Name) = $($prop.Value)"
        }
    }
}

Write-Host ""
Write-Host "-- Task Manager Startup (Shell:Startup) --" -ForegroundColor Yellow
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcuts = Get-ChildItem $startupFolder -ErrorAction SilentlyContinue
if ($shortcuts.Count -eq 0) {
    Write-Host "  (bos)"
} else {
    foreach ($s in $shortcuts) {
        Write-Host "  $($s.Name)"
    }
}

Write-Host ""
Write-Host "-- Win32_StartupCommand --" -ForegroundColor Yellow
Get-CimInstance Win32_StartupCommand | ForEach-Object {
    Write-Host "  $($_.Name) -> $($_.Command)"
}
