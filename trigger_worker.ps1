$log = "$PSScriptRoot\logs\worker_trigger.log"
$url = "https://vnbaksiabcdnnnoglycr.supabase.co/functions/v1/worker"
$secret = "YGgeXKN9VAAINTDCKFrY6KJ0wgNPeuL5qol1RCWZGgY"
$headers = @{ "x-worker-secret" = $secret; "Content-Type" = "application/json" }
$body = @{} | ConvertTo-Json -Compress

try {
  $r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 180
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') OK applied=$($r.applied) users=$($r.users) errors=$($r.errors.Count)" | Out-File $log -Append
} catch {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ERROR $($_.Exception.Message)" | Out-File $log -Append
}
