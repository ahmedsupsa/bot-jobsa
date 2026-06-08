$taskName = "JobbotsWorker"
$scriptPath = Join-Path $PSScriptRoot "trigger_worker.ps1"

# Create logs directory
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot "logs") -Force | Out-Null

# Delete existing task if any
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) -At (Get-Date).AddMinutes(1) -RepetitionDuration ([TimeSpan]::FromDays(3650)) -Once
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Force | Out-Null

Write-Host "تم إنشاء مهمة مجدولة: $taskName — تعمل كل 30 دقيقة"
