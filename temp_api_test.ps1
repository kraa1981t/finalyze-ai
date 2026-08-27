try {
    $response = Invoke-RestMethod -Uri "https://joseph-trading.vercel.app/api/market-data?symbol=GBPCHF&timeframe=1h" -TimeoutSec 15
    $result = $response.chart.result[0]
    $timestamps = $result.timestamp
    $closes = $result.indicators.quote[0].close
    Write-Host "Timestamps count: $($timestamps.Count)"
    Write-Host "Closes count: $($closes.Count)"
    if ($closes.Count -gt 0) {
        $last5 = $closes | Select-Object -Last 5
        Write-Host "Last 5 closes: $($last5 -join ', ')"
    } else {
        Write-Host "NO CLOSING DATA"
        Write-Host "Full response: $($response | ConvertTo-Json -Depth 3 | Select-Object -First 20)"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
