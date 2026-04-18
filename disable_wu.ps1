Write-Host "=== Windows Update Devre Disi Birakiliyor ==="

Write-Host ""
Write-Host "1. Windows Update servisini durduruyor..."
Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue
Stop-Service -Name UsoSvc -Force -ErrorAction SilentlyContinue
Stop-Service -Name WaaSMedicSvc -Force -ErrorAction SilentlyContinue
Stop-Service -Name TrustedInstaller -Force -ErrorAction SilentlyContinue
Write-Host "   Servisler durduruldu."

Write-Host ""
Write-Host "2. Servisleri devre disi birakiyor..."
Set-Service -Name wuauserv -StartupType Disabled -ErrorAction SilentlyContinue
Set-Service -Name UsoSvc -StartupType Disabled -ErrorAction SilentlyContinue
Set-Service -Name WaaSMedicSvc -StartupType Disabled -ErrorAction SilentlyContinue
Write-Host "   wuauserv (Windows Update) -> Disabled"
Write-Host "   UsoSvc (Update Orchestrator) -> Disabled"
Write-Host "   WaaSMedicSvc (Update Medic) -> Disabled"

Write-Host ""
Write-Host "3. TiWorker prosesini olduruyor..."
Stop-Process -Name TiWorker -Force -ErrorAction SilentlyContinue
Write-Host "   TiWorker kapatildi."

Write-Host ""
Write-Host "4. Registry ile otomatik guncellemeyi engelliyor..."
$regPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "NoAutoUpdate" -Value 1 -Type DWord -ErrorAction SilentlyContinue
Set-ItemProperty -Path $regPath -Name "AUOptions" -Value 1 -Type DWord -ErrorAction SilentlyContinue
Write-Host "   Registry ayarlari yapildi."

Write-Host ""
Write-Host "5. Windows Update gorevlerini devre disi birakiyor..."
schtasks /Change /TN "\Microsoft\Windows\WindowsUpdate\Scheduled Start" /Disable 2>$null
schtasks /Change /TN "\Microsoft\Windows\UpdateOrchestrator\Schedule Scan" /Disable 2>$null
schtasks /Change /TN "\Microsoft\Windows\UpdateOrchestrator\USO_UxBroker" /Disable 2>$null
Write-Host "   Zamanlanmis gorevler devre disi birakildi."

Write-Host ""
Write-Host "=== Kontrol ==="
$services = @("wuauserv", "UsoSvc", "WaaSMedicSvc")
foreach ($svc in $services) {
    $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($s) {
        Write-Host "  $($s.DisplayName): Status=$($s.Status), StartType=$($s.StartType)"
    }
}

Write-Host ""
$tiworker = Get-Process TiWorker -ErrorAction SilentlyContinue
if ($tiworker) {
    Write-Host "  TiWorker hala calisiyor (PID: $($tiworker.Id))"
} else {
    Write-Host "  TiWorker kapandi."
}

Write-Host ""
Write-Host "=== TAMAMLANDI ==="
Write-Host "Windows Update tamamen devre disi birakildi."
Write-Host "Tekrar acmak istersen: Set-Service -Name wuauserv -StartupType Manual; Start-Service wuauserv"
