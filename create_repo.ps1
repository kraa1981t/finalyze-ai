$token = "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"
$headers = @{
    "Authorization" = "Bearer $token"
    "User-Agent"    = "FinalyzeAI"
    "Accept"        = "application/vnd.github+json"
}
$body = '{"name":"finalyze-ai","description":"Finalyze AI - Advanced AI Trading Analysis Platform","private":false}'
try {
    $result = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -ContentType "application/json" -Body $body
    Write-Host "SUCCESS: $($result.html_url)"
    Write-Host "CLONE: $($result.clone_url)"
} catch {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host "ERROR: $responseBody"
}
