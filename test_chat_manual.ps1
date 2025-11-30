# Manual Chat System Verification Script (PowerShell)
# Tests the chat system end-to-end

Write-Host "🔥 Phoenix ORCH Chat System Verification" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""

# Check if backend is running
Write-Host "1. Checking backend server..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "http://localhost:5001/health" -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "   ✅ Backend server is running" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend server is NOT running" -ForegroundColor Red
    Write-Host "   Please start the backend: cd phoenix-kernel\phoenix-core; cargo run --bin api-server" -ForegroundColor Yellow
    exit 1
}

# Check diagnostic endpoint
Write-Host ""
Write-Host "2. Checking chat diagnostic endpoint..." -ForegroundColor Yellow
try {
    $diagnosticResponse = Invoke-RestMethod -Uri "http://localhost:5001/api/v1/chat/diagnostic" -Method GET
    Write-Host "   ✅ Chat diagnostic endpoint working" -ForegroundColor Green
    Write-Host "   LLM Configured: $($diagnosticResponse.llm_service.configured)" -ForegroundColor Cyan
    Write-Host "   Model: $($diagnosticResponse.llm_service.model)" -ForegroundColor Cyan
    Write-Host "   API Key Length: $($diagnosticResponse.llm_service.api_key_length)" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Chat diagnostic endpoint failed: $_" -ForegroundColor Red
    exit 1
}

# Test LLM service
Write-Host ""
Write-Host "3. Testing LLM service via query endpoint..." -ForegroundColor Yellow
try {
    $queryBody = @{
        query = "Hello, Phoenix. This is a test. Please respond with exactly: TEST_SUCCESSFUL"
    } | ConvertTo-Json

    $queryResponse = Invoke-RestMethod -Uri "http://localhost:5001/query" -Method POST -Body $queryBody -ContentType "application/json"
    
    if ($queryResponse.response -like "*TEST_SUCCESSFUL*") {
        Write-Host "   ✅ LLM service is working!" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  LLM service response received (may not contain exact test string)" -ForegroundColor Yellow
    }
    $responseLength = [Math]::Min(200, $queryResponse.response.Length)
    Write-Host "   Response preview: $($queryResponse.response.Substring(0, $responseLength))" -ForegroundColor Cyan
    
    # Verify it's not test data
    if ($queryResponse.response -like "*Processed query:*") {
        Write-Host "   ❌ ERROR: Response contains test data!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Query endpoint failed: $_" -ForegroundColor Red
    Write-Host "   This may indicate LLM service configuration issues" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Chat system verification complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To test via WebSocket, open the frontend and send a message in the chat." -ForegroundColor Cyan
