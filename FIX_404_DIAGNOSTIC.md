# Fix 404 Error for `/api/v1/chat/diagnostic`

## Problem
The diagnostic endpoint returns 404 because:
1. Port 5001 is currently being used by Node.js (mock server), not the Rust backend
2. The Rust backend server needs to be running to serve this endpoint

## Solution

### Option 1: Run Rust Backend (Recommended)

**Step 1: Stop the Mock Server**
```powershell
# Find and stop the Node.js process on port 5001
Get-NetTCPConnection -LocalPort 5001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Step 2: Build and Start Rust Backend**
```powershell
cd phoenix-kernel\phoenix-core
cargo build --bin api-server
cargo run --bin api-server
```

**Step 3: Verify**
```powershell
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/chat/diagnostic" -Method GET
```

### Option 2: Add Route to Mock Server (Quick Fix)

If you need to keep using the mock server temporarily, add this route to `frontend/mock-server.cjs`:

```javascript
// Add to routes section
app.get('/api/v1/chat/diagnostic', (req, res) => {
  res.json({
    status: 'diagnostic',
    timestamp: new Date().toISOString(),
    llm_service: {
      configured: true,
      status: 'configured',
      model: 'anthropic/claude-3.5-sonnet',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      api_key_length: 64
    },
    websocket: {
      endpoint: '/ws/dad',
      status: 'active'
    },
    memory: {
      available: true
    },
    conscience: {
      available: true
    }
  });
});
```

## Code Changes Applied

✅ **Made handler public**: Changed `async fn chat_diagnostic_handler` to `pub async fn chat_diagnostic_handler`

✅ **Added logging**: Server now logs registered routes on startup

✅ **Route verified**: Route is correctly registered at line 1139 in `server.rs`

## Next Steps

1. **For Production**: Use Option 1 (Rust backend) - this is the correct solution
2. **For Development**: You can use Option 2 temporarily, but the Rust backend is recommended

## Verification

After starting the Rust backend, you should see in the logs:
```
Starting Phoenix API server on 127.0.0.1:5001
Registered routes: /health, /ready, /query, /api/v1/chat/diagnostic, /ws/dad
```

Then test:
```powershell
.\test_chat_manual.ps1
```

All checks should pass! ✅

