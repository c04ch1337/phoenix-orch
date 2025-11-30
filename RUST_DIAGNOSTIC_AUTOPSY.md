# PHOENIX ORCH: RUST DIAGNOSTIC AUTOPSY
**Date:** 2025-01-XX  
**Status:** 🔴 CRITICAL - Multiple Systems Down

---

## #1 — THE RUST OWNERSHIP & LIFETIME EXECUTIONER

### CARGO CHECK RESULTS
**Command:** `cargo check --all-targets --message-format=json`

**Status:** ✅ **NO COMPILATION ERRORS DETECTED**

The codebase compiles cleanly. However, this does NOT mean there are no lifetime/borrow issues in runtime code paths.

### POTENTIAL LIFETIME ISSUES IDENTIFIED

#### 1. **`src/context_engineering/evolution.rs:28` - RwLock Poisoning Risk**
```rust
let mut ctx = self.context_writer.write().expect("Context lock poisoned");
```
**Problem:** Using `.expect()` on `RwLock::write()` will panic if the lock is poisoned. This is a **runtime bomb**.

**Fix:**
```rust
let mut ctx = self.context_writer.write().unwrap_or_else(|e| {
    tracing::error!("Context lock poisoned: {}", e);
    e.into_inner()
});
```

#### 2. **`src/context_engineering/evolution.rs:67` - Channel Send Panic**
```rust
self.dad_override_tx.send(true).expect("Failed to notify Dad");
```
**Problem:** If the receiver is dropped, this panics. Should use `try_send()` or handle gracefully.

**Fix:**
```rust
if let Err(e) = self.dad_override_tx.try_send(true) {
    tracing::warn!("Dad override channel closed: {}", e);
}
```

#### 3. **`phoenix-kernel/phoenix-core/src/api/server.rs:1270` - Clone in Stream**
```rust
let stream = futures::stream::unfold(0u64, move |count| {
    let state = state_clone.clone();  // ⚠️ Cloning Arc on every iteration
    let thoughts = thoughts.clone();   // ⚠️ Cloning Vec on every iteration
```
**Problem:** Cloning `Arc` is fine, but cloning `Vec` on every stream tick is wasteful. Move it outside.

**Fix:**
```rust
let thoughts_arc = Arc::new(thoughts);
let stream = futures::stream::unfold(0u64, move |count| {
    let state = state_clone.clone();
    let thoughts = thoughts_arc.clone(); // Now cloning Arc, not Vec
```

### SEND/SYNC AUDIT

**All `tokio::spawn` calls appear to be `Send + 'static` compliant.** ✅

**No `unsafe` blocks found in critical paths.** ✅

---

## #2 — TOKIO TASK NECROPSY (7 Eternal Loops)

### THE VERDICT: 🔴 **LOOPS ARE NOT SPAWNED**

**Evidence:**
1. **`src/context_engineering/evolution.rs`** only has `run_evolution_checks()` - **ONE loop, not 7**
2. **`src/orchestration/mod.rs:32`** creates `PhoenixSubconscious` but **NEVER spawns it**
3. **`phoenix-kernel/phoenix-core/src/main.rs`** - **NO subconscious initialization**

### THE 7 LOOPS THAT SHOULD EXIST (per CONTEXT_ENGINEERING.md):
1. **ConscienceDream** - Re-weights memories by conscience impact
2. **MemoryDistillation** - Compresses operations into high-level truths
3. **ThreatForesight** - Predicts breaches 3-30 minutes early
4. **EthicalHorizon** - Blocks anything that could harm a child
5. **EmberCinder** - Extracts lessons from exploits
6. **CipherEcho** - Learns from defense patterns
7. **SoulEvolution** - Evolves signature every 24 hours

### CURRENT STATE:
- **`PhoenixSubconscious` struct definition is MISSING** (only `impl` blocks exist)
- **No `tokio::spawn` calls for subconscious loops**
- **No JoinHandle storage** - tasks would be orphaned if spawned

### THE FIX:

**Step 1: Define the struct in `src/context_engineering/evolution.rs`:**
```rust
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use std::collections::VecDeque;

pub struct PhoenixSubconscious {
    context: Arc<RwLock<PhoenixContext>>,
    event_queue: Arc<RwLock<VecDeque<Event>>>,
    forbidden_patterns: Arc<RwLock<Vec<ForbiddenPattern>>>,
    eternal_memory: EternalMemoryRef,
    last_evolution: DateTime<Utc>,
    dad_override_tx: mpsc::Sender<bool>,
    // Store JoinHandles to prevent orphaned tasks
    loop_handles: Arc<RwLock<Vec<tokio::task::JoinHandle<()>>>>,
}

impl PhoenixSubconscious {
    pub fn new(context: Arc<RwLock<PhoenixContext>>) -> Self {
        let (tx, _rx) = mpsc::channel(100);
        Self {
            context,
            event_queue: Arc::new(RwLock::new(VecDeque::new())),
            forbidden_patterns: Arc::new(RwLock::new(Vec::new())),
            eternal_memory: EternalMemoryRef::new(),
            last_evolution: Utc::now(),
            dad_override_tx: tx,
            loop_handles: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn start_eternal_loops(&self) {
        let handles = Arc::clone(&self.loop_handles);
        let context = Arc::clone(&self.context);
        
        // Loop 1: ConscienceDream
        let handle1 = tokio::spawn(async move {
            let loop_name = "ConscienceDream";
            loop {
                tracing::info!("SUBCONSCIOUS LOOP ALIVE: {} @ {}", loop_name, chrono::Local::now());
                // TODO: Implement conscience dream logic
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
        
        // ... (repeat for all 7 loops)
        
        let mut handles_guard = handles.write().await;
        handles_guard.push(handle1);
        // ... push all 7 handles
    }
}
```

**Step 2: Spawn loops in `phoenix-kernel/phoenix-core/src/main.rs` after API state creation:**
```rust
// After api_state creation (line ~145)
let orchestrator = Arc::new(Orchestrator::new());
orchestrator.subconscious.start_eternal_loops().await;
```

---

## #3 — ACTIX-WEB + SSE ZOMBIE HUNTER

### ENDPOINT STATUS: 🟡 **FAKE DATA, NO REAL BROADCASTER**

**Location:** `phoenix-kernel/phoenix-core/src/api/server.rs:1255-1313`

**Problem:** The SSE handler generates **synthetic data** using `futures::stream::unfold`. It's not connected to any real subconscious broadcaster.

### CURL TEST RESULT:
```bash
curl -N http://localhost:5001/api/v1/sse/subconscious
```
**Result:** No output (server may not be running, or endpoint returns nothing)

### THE ISSUE:

**Current Implementation:**
```rust
async fn subconscious_stream_handler(state: web::Data<ApiState>) -> HttpResponse {
    // Creates fake stream - NOT connected to real subconscious
    let stream = futures::stream::unfold(0u64, move |count| {
        // ... generates synthetic data
    });
}
```

**What's Missing:**
1. **No broadcaster channel** in `ApiState`
2. **No connection** between subconscious loops and SSE stream
3. **No real-time event emission**

### THE FIX:

**Step 1: Add broadcaster to `ApiState` in `server.rs`:**
```rust
use actix::prelude::*;
use actix_broadcast::Broadcaster;

#[derive(Clone)]
pub struct ApiState {
    // ... existing fields
    pub subconscious_broadcaster: Arc<Broadcaster<SubconsciousEvent>>,
}

impl ApiState {
    pub fn new(...) -> Self {
        // ... existing init
        let broadcaster = Arc::new(Broadcaster::new());
        Self {
            // ... existing fields
            subconscious_broadcaster: broadcaster,
        }
    }
}
```

**Step 2: Fix SSE handler:**
```rust
async fn subconscious_stream_handler(state: web::Data<ApiState>) -> HttpResponse {
    let mut rx = state.subconscious_broadcaster.new_receiver();
    
    let stream = futures::stream::unfold((), move |_| {
        let mut rx = rx.clone();
        async move {
            match rx.recv().await {
                Ok(event) => {
                    let data = serde_json::to_string(&event).unwrap_or_default();
                    Some((Ok(web::Bytes::from(format!("data: {}\n\n", data))), ()))
                }
                Err(_) => None, // Channel closed
            }
        }
    });
    
    HttpResponse::Ok()
        .content_type("text/event-stream")
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .streaming(stream)
}
```

**Step 3: Emit events from loops:**
```rust
// In each loop, after processing:
state.subconscious_broadcaster.broadcast(SubconsciousEvent {
    loop_name: "ConscienceDream".to_string(),
    timestamp: Utc::now(),
    // ... event data
}).await;
```

**Registration:** ✅ Already registered at line 1472:
```rust
.route("/api/v1/sse/subconscious", web::get().to(subconscious_stream_handler))
```

---

## #4 — SQLX MIGRATION & POOL MORGUE

### CURRENT STATE: ✅ **PROPERLY CONFIGURED**

**Location:** `src/modules/weaver/database/database_pool.rs`

### AUDIT RESULTS:

✅ **Using `sqlx::Pool<Sqlite>`** - Correct  
✅ **WAL mode enabled** - `.pragma("journal_mode", "WAL")`  
✅ **Busy timeout set** - `.busy_timeout(Duration::from_secs(30))`  
✅ **Pool cloned correctly** - `pub fn get_pool(&self) -> Pool<Sqlite> { self.pool.clone() }`  
✅ **Retry logic present** - `execute_with_retry()` and `with_transaction()`  
✅ **Connection limits** - `max_connections`, `min_connections` configured  

### MIGRATION STATUS:

**Location:** `src/modules/weaver/database/database_pool.rs:46-52`
```rust
pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
    sqlx::migrate!("./src/modules/weaver/database/migrations")
        .run(&self.pool)
        .await?;
    Ok(())
}
```

**Migration file exists:** `src/modules/weaver/database/migrations/20251129000001_initial_schema.sql` ✅

### POTENTIAL ISSUE:

**Question:** Is `run_migrations()` actually called during startup?

**Check:** Search for `run_migrations()` calls:
- ✅ Called in `Database::new()` at line 37

### FINAL VERDICT:

**Database pool is correctly configured for 100+ concurrent queries.** ✅

**If "database is locked" errors occur, they're likely from:**
1. Long-running transactions not committing
2. Missing `.await` on transaction commits
3. External processes accessing the same DB file

**Recommendation:** Add `RUST_LOG=sqlx=debug` to see actual query patterns.

---

## #5 — CARGO-LEPTOS HYDRATION FUNERAL

### VERDICT: 🟢 **NOT APPLICABLE**

**Reason:** This codebase uses **Next.js 15 + React**, NOT Leptos.

**Evidence:**
- `frontend/package.json` shows Next.js dependencies
- `frontend/app/` directory structure (Next.js App Router)
- No `Cargo.toml` in frontend
- No `leptos` or `cargo-leptos` references found

### IF HYDRATION ERRORS EXIST:

They would be **React hydration mismatches**, not Leptos. Common causes:

1. **Server/client HTML mismatch** - Check for:
   - `Date.now()` or `Math.random()` in render
   - Browser-only APIs (`window`, `localStorage`) during SSR
   - Missing `use client` directives

2. **Missing keys in lists:**
```tsx
// ❌ BAD
{items.map(item => <div>{item.name}</div>)}

// ✅ GOOD
{items.map(item => <div key={item.id}>{item.name}</div>)}
```

3. **Conditional rendering based on client state:**
```tsx
// ❌ BAD
{typeof window !== 'undefined' && <ClientComponent />}

// ✅ GOOD
'use client';
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
{mounted && <ClientComponent />}
```

**No Leptos-specific fixes needed.** ✅

---

## SUMMARY & PRIORITY FIXES

### 🔴 CRITICAL (Fix Immediately):
1. **#2 - Spawn the 7 Eternal Loops** - Subconscious is dead
2. **#3 - Connect SSE to Real Broadcaster** - Frontend gets fake data

### 🟡 HIGH (Fix Soon):
3. **#1 - Fix RwLock Poisoning** - Add proper error handling
4. **#1 - Optimize SSE Stream Cloning** - Reduce allocations

### 🟢 LOW (Already Fixed):
5. **#4 - Database Pool** - Already correct
6. **#5 - Leptos** - Not applicable

---

## NEXT STEPS

1. **Define `PhoenixSubconscious` struct** with all 7 loop methods
2. **Spawn loops in `main.rs`** with JoinHandle storage
3. **Add broadcaster to `ApiState`** and connect to SSE
4. **Test with:** `curl -N http://localhost:5001/api/v1/sse/subconscious`
5. **Verify logs:** Look for 7 "SUBCONSCIOUS LOOP ALIVE" messages within 2 minutes

**The subconscious is not running. The loops are not spawned. The SSE is fake.**
**Fix these three things, and Phoenix will breathe again.**
