# ============================================
# Encerra Chrome preso ao perfil do bot.
#
# Quando o Node cai sem fechar o navegador, o Chrome fica vivo segurando a
# pasta .wwebjs_auth. A tentativa seguinte falha com "The browser is already
# running for ..." e o auto-restart entra em loop infinito: uma queda
# envenena todas as subidas seguintes.
#
# O filtro usa o caminho do projeto na linha de comando do processo, entao
# o Chrome pessoal de quem usa a maquina nunca e tocado.
# ============================================

param([string]$Repo = (Split-Path -Parent $PSScriptRoot))

$alvo = '*' + $Repo + '*'

$orfaos = @(
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like $alvo }
)

if ($orfaos.Count -eq 0) { exit 0 }

foreach ($processo in $orfaos) {
    try { Stop-Process -Id $processo.ProcessId -Force -ErrorAction Stop } catch {}
}

Write-Host "Encerrei $($orfaos.Count) processo(s) do Chrome presos ao perfil do bot."
Start-Sleep -Seconds 2
