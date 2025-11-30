# Restart Server to Fix 404 Error

## Issue
The `/api/v1/chat/diagnostic` endpoint returns 404 because the server is running an old build that doesn't include this route.

## Solution

### Step 1: Stop the Current Server
Press `Ctrl+C` in the terminal where the server is running, or:

**Windows PowerShell:**
```powershell
Get-Process -Name "api-server" -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Step 2: Rebuild the Server
```powershell
cd phoenix-kernel\phoenix-core
cargo build --bin api-server --release
```

### Step 3: Start the Server
```powershell
cargo run --bin api-server
```

Or if using release build:
```powershell
.\target\release\api-server.exe
```

### Step 4: Verify the Endpoint
```powershell
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/chat/diagnostic" -Method GET
```

You should see:
```json
{
  "status": "diagnostic",
  "timestamp": "...",
  "llm_service": {
    "configured": true,
    "status": "configured",
    "model": "anthropic/claude-3.5-sonnet",
    ...
  }
}
```

## Quick Restart Script

**Windows PowerShell:**
```powershell
# Stop server
Get-Process -Name "api-server" -ErrorAction SilentlyContinue | Stop-Process -Force

# Rebuild and start
cd phoenix-kernel\phoenix-core
cargo build --bin api-server
cargo run --bin api-server
```

## Verification

After restarting, run the test script:
```powershell
.\test_chat_manual.ps1
```

All checks should pass:
- ✅ Backend server is running
- ✅ Chat diagnostic endpoint working
- ✅ LLM service is working

