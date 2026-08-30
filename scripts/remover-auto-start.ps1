# ============================================
# Remove o Oli - Bot do Agendador de Tarefas do Windows.
# Nao apaga nada do projeto, nem a sessao do WhatsApp.
#
#   powershell -ExecutionPolicy Bypass -File scripts\remover-auto-start.ps1
# ============================================

$ErrorActionPreference = 'Stop'
$nomeTarefa = 'OliBot'

$tarefa = Get-ScheduledTask -TaskName $nomeTarefa -ErrorAction SilentlyContinue
if (-not $tarefa) {
    Write-Host "A tarefa '$nomeTarefa' nao esta registrada. Nada a fazer." -ForegroundColor Yellow
    exit 0
}

try { Stop-ScheduledTask -TaskName $nomeTarefa -ErrorAction Stop } catch {}
Unregister-ScheduledTask -TaskName $nomeTarefa -Confirm:$false

Write-Host "Tarefa '$nomeTarefa' removida." -ForegroundColor Green
Write-Host 'O bot nao sobe mais sozinho. Para rodar na mao: npm start'
