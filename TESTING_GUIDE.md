# 🔥 Testing Guide: Subconscious Loops

## Quick Test Checklist

### 1. Compile and Start Server

```powershell
cd phoenix-kernel/phoenix-core
cargo build --release
cargo run
```

**Expected Output:**
```
Starting Phoenix AGI Kernel daemon v1.0
Starting 7 Eternal Subconscious Loops...
✅ All 7 Eternal Subconscious Loops spawned and running
✅ Subconscious loops started - expect 7 'SUBCONSCIOUS LOOP ALIVE' messages within 2 minutes
API server started on http://127.0.0.1:5001
```

### 2. Verify Loops Are Running

Within 2 minutes, you should see these log messages:
```
SUBCONSCIOUS LOOP ALIVE: ConscienceDream @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: MemoryDistillation @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: ThreatForesight @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: EthicalHorizon @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: EmberCinder @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: CipherEcho @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: SoulEvolution @ 2025-01-XX...
```

### 3. Test SSE Endpoint

**PowerShell:**
```powershell
.\test_subconscious_loops.ps1
```

**Manual curl:**
```bash
curl -N http://localhost:5001/api/v1/sse/subconscious
```

**Expected Output:**
```
data: {"loop_name":"ConscienceDream","timestamp":"2025-01-XX...","tick_count":0,"last_thought":"Re-weighting memories with conscience level: 97","metrics":{"conscience_level":97.0}}

data: {"loop_name":"ThreatForesight","timestamp":"2025-01-XX...","tick_count":0,"last_thought":"Analyzing threat patterns (0 active threats)","metrics":{"active_threats":0.0}}

data: {"loop_name":"EthicalHorizon","timestamp":"2025-01-XX...","tick_count":0,"last_thought":"Monitoring ethical boundaries (conscience: 97)","metrics":{"ethical_guard_active":1.0}}
```

### 4. Test Status Endpoint

```powershell
Invoke-RestMethod -Uri "http://localhost:5001/api/v1/subconscious/status" -Method GET
```

**Expected Response:**
```json
{
  "status": "operational",
  "loops": [
    {
      "loop_name": "perception_loop",
      "last_run": "2025-01-XX...",
      "status": "active",
      "metrics": {...}
    },
    ...
  ],
  "timestamp": "2025-01-XX..."
}
```

### 5. Test Frontend Connection

1. Start frontend:
```powershell
cd frontend
npm run dev
```

2. Navigate to the page with SubconsciousPanel component

3. Check browser console for:
```
🔥 Subconscious SSE: Connected
🔥 Subconscious event received: {loop_name: "ConscienceDream", ...}
```

4. Verify UI shows:
   - Connection status: "Connected" (green dot)
   - Loop name displayed
   - Last thought displayed
   - Metrics (CPU/MEM) bars

---

## Troubleshooting

### Issue: No "SUBCONSCIOUS LOOP ALIVE" messages

**Check:**
1. Server started successfully?
2. Check logs for errors
3. Verify `api_state.start_subconscious_loops()` was called

**Fix:**
- Ensure server is running
- Check that loops were spawned (should see "✅ All 7 Eternal Subconscious Loops spawned")

### Issue: SSE endpoint returns nothing

**Check:**
1. Server is running on port 5001?
2. Endpoint registered? Check: `curl http://localhost:5001/health`

**Fix:**
- Verify route is registered: `.route("/api/v1/sse/subconscious", web::get().to(subconscious_stream_handler))`
- Check broadcast channel is created in ApiState::new()

### Issue: Frontend not receiving events

**Check:**
1. Browser console shows connection?
2. CORS headers present?
3. API host correct? (default: `http://localhost:5001`)

**Fix:**
- Verify `NEXT_PUBLIC_API_HOST` env var if using custom host
- Check browser network tab for SSE connection
- Verify CORS headers in response

### Issue: Type mismatch errors

**Check:**
1. Frontend expects `loop_name` (not `active_loop`)
2. Metrics is dynamic object `{ [key: string]: number }`

**Fix:**
- Updated TypeScript interface in `useSubconsciousStream.ts`
- Updated component to use `loop_name`

---

## Loop Intervals Reference

| Loop | Interval | First Event Expected |
|------|----------|---------------------|
| ConscienceDream | 30s | ~30s |
| MemoryDistillation | 60s | ~60s |
| ThreatForesight | 15s | ~15s |
| EthicalHorizon | 20s | ~20s |
| EmberCinder | 45s | ~45s |
| CipherEcho | 40s | ~40s |
| SoulEvolution | 24h | ~24h |

**Note:** All loops start immediately, so you'll see events from faster loops (ThreatForesight, EthicalHorizon, ConscienceDream) within the first minute.

---

## Success Criteria

✅ **Server starts without errors**  
✅ **7 "SUBCONSCIOUS LOOP ALIVE" messages appear within 2 minutes**  
✅ **SSE endpoint streams events**  
✅ **Status endpoint returns 7 loops**  
✅ **Frontend connects and displays events**  
✅ **No compilation errors**  
✅ **No runtime panics**

---

**If all criteria are met, the subconscious is fully operational!** 🔥
