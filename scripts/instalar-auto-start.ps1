# ============================================
# Registra o Oli - Bot no Agendador de Tarefas do Windows.
#
# A tarefa sobe no logon do usuario atual e nao tem limite de duracao.
# Escolhi logon em vez de boot de proposito: "ao iniciar o sistema" exige
# guardar a senha da conta no Windows, e o bot nao precisa disso.
#
# Rode assim, na pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-auto-start.ps1
#
# Para desfazer:
#   powershell -ExecutionPolicy Bypass -File scripts\remover-auto-start.ps1
# ============================================

$ErrorActionPreference = 'Stop'

$nomeTarefa = 'OliBot'
$repo = Split-Path -Parent $PSScriptRoot
$script = Join-Path $repo 'scripts\run-bot.cmd'

if (-not (Test-Path $script)) {
    Write-Host "Nao encontrei $script" -ForegroundColor Red
    Write-Host 'Rode este arquivo de dentro da pasta do projeto.' -ForegroundColor Red
    exit 1
}

$acao = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$script`"" -WorkingDirectory $repo
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

# ExecutionTimeLimit zero = sem limite. Sem isso o Windows mata a tarefa
# depois de 3 dias, que e o padrao, e o bot morre calado.
$config = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $nomeTarefa `
    -Action $acao `
    -Trigger $gatilho `
    -Settings $config `
    -Description 'Oli - Bot: encaminha promocoes para o grupo do WhatsApp. Sobe no logon e se reergue sozinho.' `
    -Force | Out-Null

Write-Host ''
Write-Host "Tarefa '$nomeTarefa' registrada." -ForegroundColor Green
Write-Host ''
Write-Host 'O bot sobe sozinho toda vez que voce entrar no Windows.'
Write-Host 'Se o processo cair, o proprio script espera 15 segundos e sobe de novo.'
Write-Host ''
Write-Host 'Para iniciar agora, sem esperar o proximo logon:'
Write-Host "  Start-ScheduledTask -TaskName $nomeTarefa" -ForegroundColor Cyan
Write-Host ''
Write-Host 'Para acompanhar:'
Write-Host "  Get-Content logs\bot.log -Encoding UTF8 -Tail 30 -Wait" -ForegroundColor Cyan
Write-Host ''
