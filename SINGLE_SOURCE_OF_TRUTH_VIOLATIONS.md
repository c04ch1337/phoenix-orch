# 🔥 SINGLE SOURCE OF TRUTH: VIOLATION AUDIT

## CRITICAL ARCHITECTURE MISMATCH

**Current State:** React 18 + Vite + TypeScript  
**Requested State:** Leptos (Rust web framework)

**⚠️ WARNING:** Leptos is a Rust framework incompatible with React. This would require a complete rewrite of the frontend.

**Assuming:** You want to enforce single sources within the React ecosystem, with eventual migration path to Leptos.

---

## VIOLATIONS FOUND

### 1. STATE MANAGEMENT — ❌ MULTIPLE SYSTEMS

#### Zustand (PRIMARY VIOLATION)
**Files to DELETE:**
- `frontend/app/providers/ZustandProvider.tsx` (534 lines)
- `frontend/app/hooks/usePhoenixContext.ts` (uses Zustand)
- `frontend/app/hooks/useSubconscious.ts` (uses Zustand)

**Files to MODIFY:**
- `frontend/app/layout.tsx:10,149,243` - Remove ZustandProvider wrapper
- `frontend/app/components/ConscienceGauge.tsx:11` - Remove Zustand imports
- `frontend/package.json:28` - Remove `"zustand": "^5.0.9"`

**Lines to Remove:**
```
frontend/app/layout.tsx:10
  import ZustandProvider from "@/providers/ZustandProvider";

frontend/app/layout.tsx:149-243
  <ZustandProvider>
    ...children...
  </ZustandProvider>

frontend/app/providers/ZustandProvider.tsx:1-534
  (ENTIRE FILE - DELETE)

frontend/app/hooks/usePhoenixContext.ts:3
  import { create } from 'zustand';

frontend/app/hooks/usePhoenixContext.ts:222-534
  (Zustand store creation - REPLACE with Leptos signals)

frontend/app/hooks/useSubconscious.ts:20
  import { create } from 'zustand';

frontend/app/hooks/useSubconscious.ts:42-989
  (Zustand store - REPLACE with Leptos signals)

frontend/app/components/ConscienceGauge.tsx:11
  import { usePhoenixContext, useSubconscious } from '../providers/ZustandProvider';
```

#### React Context (SECONDARY VIOLATION)
**Files to MODIFY:**
- `frontend/app/providers/ZustandProvider.tsx:366-370` - ZustandContext (DELETE)
- `frontend/app/providers/ZustandProvider.tsx:527-529` - Context.Provider (DELETE)

**Lines to Remove:**
```
frontend/app/providers/ZustandProvider.tsx:4
  import { createContext, useContext, ... } from 'react';

frontend/app/providers/ZustandProvider.tsx:366-370
  const ZustandContext = createContext<ZustandContextType>(null);
  export function usePhoenix() {
    const context = useContext(ZustandContext);
    ...
  }

frontend/app/providers/ZustandProvider.tsx:527-529
  <ZustandContext.Provider value={{ store: usePhoenixStore }}>
    {children}
  </ZustandContext.Provider>
```

**REPLACEMENT:** Leptos signals (requires Rust rewrite)

---

### 2. STYLING SYSTEM — ✅ MOSTLY COMPLIANT

#### Tailwind + clsx (CORRECT)
- ✅ `frontend/package.json:19,27` - clsx and tailwindcss present
- ✅ Most components use Tailwind classes

#### CSS Files (VIOLATIONS)
**Files to DELETE:**
- `frontend/app/features/system/styles/PhoenixContextPanel.css`
- `frontend/app/styles/globals.css` (if duplicate)
- `frontend/style.css` (if not needed)

**Files to KEEP:**
- `frontend/app/globals.css` (Tailwind directives only)

**Lines to Check:**
```
frontend/app/features/system/components/PhoenixContextPanel.tsx
  (Check for CSS imports - REMOVE if present)
```

**REPLACEMENT:** Move all styles to Tailwind classes + clsx

---

### 3. ROUTING — ❌ NEXT.JS ROUTER (BUT USING VITE)

**Note:** Codebase uses Vite, not Next.js, but has Next.js-style routing patterns.

**Files to MODIFY:**
- `frontend/app/auth/login/page.tsx:4,7` - Remove `useRouter` from next/navigation
- `frontend/app/forge/error.tsx:4` - Remove `Link` from next/link
- `frontend/components/RouteError.tsx:2` - Remove `Link` from next/link
- `frontend/tests/navigation.test.tsx:3,9` - Remove Next.js router mocks

**Lines to Remove:**
```
frontend/app/auth/login/page.tsx:4
  import { useRouter, useSearchParams } from 'next/navigation';

frontend/app/auth/login/page.tsx:7
  const router = useRouter();

frontend/app/forge/error.tsx:4
  import Link from 'next/link';

frontend/components/RouteError.tsx:2
  import Link from 'next/link';

frontend/tests/navigation.test.tsx:3
  import { useRouter, useSearchParams } from 'next/navigation';
```

**REPLACEMENT:** Leptos Router (requires Rust rewrite) OR Vite file-based routing

---

### 4. REAL-TIME — ❌ MULTIPLE WEBSOCKET IMPLEMENTATIONS

#### WebSocket Services (ALL VIOLATIONS)
**Files to DELETE:**
- `frontend/app/services/socket.ts` (273 lines) - WebSocketService class
- `frontend/app/lib/socket.ts` - WebSocket hook implementation
- `frontend/lib/socket.ts` - Another WebSocket implementation

**Files to MODIFY:**
- `frontend/app/page.tsx:96,108,124,146,195,199,205,246,362` - Remove WebSocket calls
- `frontend/app/components/ServiceInitializer.tsx:51,52,58` - Remove WebSocket init
- `frontend/app/config/index.ts:52,89,103` - Remove `ws:` config entries
- `frontend/vite.config.ts:56-61` - Remove WebSocket proxy
- `frontend/app/features/ember-unit/services/emberUnitSocket.ts` - DELETE or convert to SSE
- `frontend/app/features/ember-unit/types/index.ts:29` - Remove WebSocketMessage type

**Lines to Remove:**
```
frontend/app/services/socket.ts:1-273
  (ENTIRE FILE - DELETE)

frontend/app/lib/socket.ts:1-201
  (ENTIRE FILE - DELETE)

frontend/lib/socket.ts:1-173
  (ENTIRE FILE - DELETE)

frontend/app/page.tsx:96-108
  // Send via WebSocket with user_id for relationship detection
  if (socket.isConnected()) {
    ...
  } else {
    console.error('🔥 WebSocket not connected, cannot send message');
  }

frontend/app/page.tsx:124,146
  // Also send via WebSocket for backend processing
  socket.sendMessage(...)

frontend/app/page.tsx:195-362
  // Initialize WebSocket and SSE connections
  useEffect(() => {
    console.log('🔥 Initializing WebSocket connection...');
    ...
    socket.onMessage((data) => {
      console.log('🔥 Received WebSocket message:', data);
    });
    ...
    console.warn('🔥 Unhandled WebSocket message:', data);
  }, []);

frontend/app/components/ServiceInitializer.tsx:51-58
  // Initialize WebSocket and SSE connections
  console.log('🔥 Initializing WebSocket connection...');
  ...
  console.log('🔥 WebSocket status:', connected ? 'CONNECTED' : 'DISCONNECTED');

frontend/app/config/index.ts:52
    ws: 'ws://127.0.0.1:5001/ws/dad',

frontend/app/config/index.ts:89
    ws: 'wss://staging.phoenix-orch.io/ws',

frontend/app/config/index.ts:103
    ws: 'wss://phoenix-orch.io/ws',

frontend/vite.config.ts:56-61
  '/ws': {
    target: 'ws://127.0.0.1:5001',
    ws: true,
    changeOrigin: true,
    secure: false
  }

frontend/app/features/ember-unit/services/emberUnitSocket.ts:1-*
  (ENTIRE FILE - DELETE or convert to SSE)

frontend/app/features/ember-unit/types/index.ts:29
  export interface WebSocketMessage { ... }
```

**REPLACEMENT:** SSE only (already implemented for subconscious, extend to all real-time)

---

### 5. CONTEXT — ❌ MULTIPLE CONTEXT SYSTEMS

#### ZustandContext (VIOLATION)
**Already covered in #1** - Delete ZustandProvider.tsx

#### Other Contexts (CHECK)
**Files to AUDIT:**
- Search for `createContext` usage
- Search for `Context.Provider` usage

**REPLACEMENT:** Single PhoenixContext (Leptos signals when migrated)

---

## BACKEND WEBSOCKET REMOVAL

### Rust Backend
**Files to MODIFY:**
- `phoenix-kernel/phoenix-core/src/api/server.rs` - Remove WebSocket handlers
- Search for `ws_handler`, `WebSocket`, `actix_web_actors::ws`

**Lines to Check:**
```
phoenix-kernel/phoenix-core/src/api/server.rs
  (Search for .route("/ws/...") - REMOVE all WebSocket routes)
  (Search for ws_handler - REMOVE all handlers)
```

---

## SUMMARY OF DELETIONS

### Files to DELETE (Complete):
1. `frontend/app/providers/ZustandProvider.tsx` (534 lines)
2. `frontend/app/services/socket.ts` (273 lines)
3. `frontend/app/lib/socket.ts` (201 lines)
4. `frontend/lib/socket.ts` (173 lines)
5. `frontend/app/features/ember-unit/services/emberUnitSocket.ts`
6. `frontend/app/features/system/styles/PhoenixContextPanel.css`
7. `frontend/app/styles/globals.css` (if duplicate)
8. `frontend/style.css` (if not needed)

### Files to MODIFY (Partial):
1. `frontend/app/layout.tsx` - Remove ZustandProvider
2. `frontend/app/hooks/usePhoenixContext.ts` - Replace Zustand with Leptos signals
3. `frontend/app/hooks/useSubconscious.ts` - Replace Zustand with Leptos signals
4. `frontend/app/components/ConscienceGauge.tsx` - Remove Zustand imports
5. `frontend/app/page.tsx` - Remove all WebSocket calls
6. `frontend/app/components/ServiceInitializer.tsx` - Remove WebSocket init
7. `frontend/app/config/index.ts` - Remove `ws:` entries
8. `frontend/vite.config.ts` - Remove WebSocket proxy
9. `frontend/package.json` - Remove `zustand` dependency
10. `phoenix-kernel/phoenix-core/src/api/server.rs` - Remove WebSocket routes

---

## MIGRATION PATH

### Phase 1: Remove Violations (React)
1. Delete all WebSocket code
2. Delete Zustand
3. Replace with React Context temporarily
4. Convert all real-time to SSE

### Phase 2: Leptos Migration (Future)
1. Rewrite frontend in Rust + Leptos
2. Use Leptos signals for state
3. Use Leptos Router for routing
4. Keep SSE for real-time

---

**Total Violations:** ~15 files, ~2000+ lines of code to remove/replace
