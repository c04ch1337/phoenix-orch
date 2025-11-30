# Test Script for Subconscious Loops
# This script verifies that all 7 eternal loops are running and broadcasting events

Write-Host "🔥 Testing Phoenix Subconscious Loops" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "1. Checking if server is running on port 5001..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Server is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Server is not running. Please start the server first." -ForegroundColor Red
    Write-Host "   Run: cd phoenix-kernel/phoenix-core && cargo run" -ForegroundColor Yellow
    exit 1
}

# Test SSE endpoint
Write-Host ""
Write-Host "2. Testing SSE endpoint /api/v1/sse/subconscious..." -ForegroundColor Yellow
Write-Host "   (This will stream events for 10 seconds)" -ForegroundColor Gray

$events = @()
$eventCount = 0
$startTime = Get-Date

try {
    $request = [System.Net.HttpWebRequest]::Create("http://localhost:5001/api/v1/sse/subconscious")
    $request.Method = "GET"
    $request.Timeout = 12000  # 12 seconds
    
    $response = $request.GetResponse()
    $stream = $response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    
    Write-Host "   ✅ Connected to SSE stream" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Listening for events (10 seconds)..." -ForegroundColor Gray
    
    while ((Get-Date) -lt $startTime.AddSeconds(10)) {
        $line = $reader.ReadLine()
        if ($line -match "^data: (.+)$") {
            $eventCount++
            $eventData = $matches[1]
            $events += $eventData
            
            try {
                $json = $eventData | ConvertFrom-Json
                Write-Host "   [$eventCount] Loop: $($json.loop_name) - $($json.last_thought)" -ForegroundColor Cyan
            } catch {
                Write-Host "   [$eventCount] Raw: $eventData" -ForegroundColor Gray
            }
        }
    }
    
    $reader.Close()
    $response.Close()
    
} catch {
    Write-Host "   ❌ Failed to connect to SSE endpoint: $_" -ForegroundColor Red
    exit 1
}

# Analyze results
Write-Host ""
Write-Host "3. Analyzing results..." -ForegroundColor Yellow

$uniqueLoops = $events | ForEach-Object {
    try {
        $json = $_ | ConvertFrom-Json
        $json.loop_name
    } catch {
        $null
    }
} | Where-Object { $_ -ne $null } | Sort-Object -Unique

Write-Host "   Total events received: $eventCount" -ForegroundColor Cyan
Write-Host "   Unique loops detected: $($uniqueLoops.Count)" -ForegroundColor Cyan
Write-Host "   Loops: $($uniqueLoops -join ', ')" -ForegroundColor Cyan

if ($uniqueLoops.Count -ge 7) {
    Write-Host ""
    Write-Host "   ✅ SUCCESS: All 7 loops detected!" -ForegroundColor Green
} elseif ($uniqueLoops.Count -gt 0) {
    Write-Host ""
    Write-Host "   ⚠️  PARTIAL: Only $($uniqueLoops.Count) loops detected (expected 7)" -ForegroundColor Yellow
    Write-Host "   This is normal if the test ran for less than 2 minutes" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "   ❌ FAILURE: No loops detected" -ForegroundColor Red
    Write-Host "   Check server logs for 'SUBCONSCIOUS LOOP ALIVE' messages" -ForegroundColor Yellow
}

# Test status endpoint
Write-Host ""
Write-Host "4. Testing status endpoint /api/v1/subconscious/status..." -ForegroundColor Yellow

try {
    $statusResponse = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/subconscious/status" -Method GET
    Write-Host "   ✅ Status endpoint responding" -ForegroundColor Green
    Write-Host "   Status: $($statusResponse.status)" -ForegroundColor Cyan
    Write-Host "   Loops reported: $($statusResponse.loops.Count)" -ForegroundColor Cyan
    
    if ($statusResponse.loops.Count -eq 7) {
        Write-Host "   ✅ All 7 loops reported in status" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Status endpoint failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔥 Test Complete" -ForegroundColor Cyan
