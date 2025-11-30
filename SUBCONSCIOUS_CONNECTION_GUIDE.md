# Subconscious Loops Connection Guide

## Status: ✅ Infrastructure Complete, Needs Connection

All 7 eternal loops are implemented in `src/context_engineering/evolution.rs` and ready to run.

## Connection Steps

### 1. The Broadcast Channel is Ready

The `ApiState` in `phoenix-kernel/phoenix-core/src/api/server.rs` now has:
- `subconscious_tx: Arc<broadcast::Sender<SubconsciousEvent>>` 
- SSE handler connected to receive events

### 2. Connect PhoenixSubconscious to ApiState

You need to:

1. **Get the broadcast sender from ApiState:**
```rust
let subconscious_tx = api_state.subconscious_tx.clone();
```

2. **Create PhoenixSubconscious and connect broadcaster:**
```rust
use crate::context_engineering::{PhoenixSubconscious, PhoenixContext};
use std::sync::Arc;
use tokio::sync::RwLock;

let context = Arc::new(RwLock::new(PhoenixContext { /* ... */ }));
let mut subconscious = PhoenixSubconscious::new(context);
subconscious.set_event_broadcaster(subconscious_tx);
```

3. **Start all 7 loops:**
```rust
subconscious.start_eternal_loops().await;
```

### 3. Where to Add This Code

**Option A: In `phoenix-kernel/phoenix-core/src/main.rs`** (after ApiState creation):
```rust
// After line 145 (after api_state creation)
use std::sync::Arc;
use tokio::sync::RwLock;

// Create context
let context = Arc::new(RwLock::new(/* PhoenixContext initialization */));

// Create subconscious (you'll need to import or create a bridge)
// For now, this requires either:
// 1. Moving PhoenixSubconscious to phoenix-kernel, OR
// 2. Creating a bridge crate, OR  
// 3. Initializing in a separate service

// Get broadcaster from api_state
let subconscious_tx = api_state.subconscious_tx.clone();

// Connect and start (pseudo-code - actual implementation depends on crate structure)
// subconscious.set_event_broadcaster(subconscious_tx);
// subconscious.start_eternal_loops().await;
```

**Option B: In `src/orchestration/mod.rs`** (if Orchestrator is used):
```rust
impl Orchestrator {
    pub async fn connect_to_api_state(&mut self, api_state: &phoenix_core::api::server::ApiState) {
        let tx = api_state.subconscious_tx.clone();
        // Convert broadcast::Sender to the type expected by PhoenixSubconscious
        // This requires type matching between crates
        self.subconscious.set_event_broadcaster(tx);
        self.subconscious.start_eternal_loops().await;
    }
}
```

## Current Implementation Status

✅ **PhoenixSubconscious struct** - Complete with all 7 loops  
✅ **Broadcast channel** - Added to ApiState  
✅ **SSE handler** - Connected to broadcast channel  
✅ **Loop implementations** - All 7 loops with tracing logs  
✅ **JoinHandle storage** - Prevents orphaned tasks  
✅ **RwLock poisoning fixes** - Proper error handling  

⏳ **Connection** - Needs to be wired up in main.rs or orchestration layer

## Testing

Once connected, you should see 7 log messages within 2 minutes:
```
SUBCONSCIOUS LOOP ALIVE: ConscienceDream @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: MemoryDistillation @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: ThreatForesight @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: EthicalHorizon @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: EmberCinder @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: CipherEcho @ 2025-01-XX...
SUBCONSCIOUS LOOP ALIVE: SoulEvolution @ 2025-01-XX...
```

And SSE endpoint should stream real events:
```bash
curl -N http://localhost:5001/api/v1/sse/subconscious
```
