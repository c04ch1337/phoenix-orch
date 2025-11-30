# 🔥 SINGLE SOURCE OF TRUTH: VIOLATION REMOVAL PLAN

## ⚠️ CRITICAL ARCHITECTURE NOTE

**Current Stack:** React 18 + Vite + TypeScript  
**Requested Stack:** Leptos (Rust web framework)

**INCOMPATIBILITY:** Leptos is a Rust framework that cannot coexist with React. This requires either:
1. Complete frontend rewrite in Rust + Leptos, OR
2. Enforce single sources within React ecosystem (preparing for future Leptos migration)

**Proceeding with:** Option 2 - Remove violations within React, document Leptos migration path.

---

## VIOLATIONS TO REMOVE

### 1. STATE MANAGEMENT — ❌ ZUSTAND (PRIMARY VIOLATION)

#### Files to DELETE:
1. `frontend/app/providers/ZustandProvider.tsx` (534 lines)
2. `frontend/app/hooks/usePhoenixContext.ts` (632 lines - Zustand implementation)
3. `frontend/app/hooks/useSubconscious.ts` (991 lines - Zustand store)

#### Files to MODIFY:
1. `frontend/app/layout.tsx:10,149,243` - Remove ZustandProvider
2. `frontend/app/components/ConscienceGauge.tsx:11` - Remove Zustand imports
3. `frontend/package.json:28` - Remove `"zustand": "^5.0.9"`

#### Exact Lines to Remove:

**frontend/app/layout.tsx:10**
```typescript
import ZustandProvider from "@/providers/ZustandProvider";
```

**frontend/app/layout.tsx:149-243**
```typescript
<ZustandProvider>
  ...children...
</ZustandProvider>
```

**frontend/app/components/ConscienceGauge.tsx:11**
```typescript
import { usePhoenixContext, useSubconscious } from '../providers/ZustandProvider';
```

**REPLACEMENT:** PhoenixContext (React Context) → Eventually Leptos signals

---

### 2. REAL-TIME — ❌ WEBSOCKETS (ALL VIOLATIONS)

#### Files to DELETE:
1. `frontend/app/services/socket.ts` (273 lines)
2. `frontend/app/lib/socket.ts` (201 lines)
3. `frontend/lib/socket.ts` (173 lines)
4. `frontend/app/features/ember-unit/services/emberUnitSocket.ts`

#### Files to MODIFY:
1. `frontend/app/page.tsx:96-108,124,146,195-362` - Remove WebSocket calls
2. `frontend/app/components/ServiceInitializer.tsx:51-58` - Remove WebSocket init
3. `frontend/app/config/index.ts:52,89,103` - Remove `ws:` config
4. `frontend/vite.config.ts:56-61` - Remove WebSocket proxy
5. `frontend/app/features/ember-unit/types/index.ts:29` - Remove WebSocketMessage

#### Backend Files to MODIFY:
1. `phoenix-kernel/phoenix-core/src/api/server.rs:3,453,526-1026,1466-1542,1595,1607,1624` - Remove all WebSocket handlers

#### Exact Lines to Remove:

**frontend/app/page.tsx:96-108**
```typescript
// Send via WebSocket with user_id for relationship detection
if (socket.isConnected()) {
  socket.send({ type: 'chat', content: content.trim(), user_id: userId });
  setIsTyping(true);
} else {
  console.error('🔥 WebSocket not connected, cannot send message');
}
```

**frontend/app/page.tsx:124,146**
```typescript
// Also send via WebSocket for backend processing
socket.send({ type: 'protect' });
socket.send({ type: 'kill', target });
```

**frontend/app/page.tsx:195-362**
```typescript
// Initialize WebSocket and SSE connections
useEffect(() => {
  console.log('🔥 Initializing WebSocket connection...');
  socket.onMessage((data) => { ... });
}, []);
```

**frontend/vite.config.ts:56-61**
```typescript
'/ws': {
  target: 'ws://127.0.0.1:5001',
  ws: true,
  changeOrigin: true,
  secure: false
}
```

**phoenix-kernel/phoenix-core/src/api/server.rs:1595,1607,1624**
```rust
.route("/ws/dad", web::get().to(ws_handler))
.route("/ws/ember", web::get().to(ember_ws_handler))
.route("/ws", web::get().to(heartbeat_ws_handler))
```

**REPLACEMENT:** SSE only (already implemented for subconscious, extend to all)

---

### 3. ROUTING — ❌ NEXT.JS ROUTER (VIOLATIONS)

#### Files to MODIFY:
1. `frontend/app/auth/login/page.tsx:4,7` - Remove Next.js router
2. `frontend/app/forge/error.tsx:4` - Remove Next.js Link
3. `frontend/components/RouteError.tsx:2` - Remove Next.js Link
4. `frontend/tests/navigation.test.tsx:3,9` - Remove Next.js mocks

#### Exact Lines to Remove:

**frontend/app/auth/login/page.tsx:4,7**
```typescript
import { useRouter, useSearchParams } from 'next/navigation';
const router = useRouter();
```

**frontend/app/forge/error.tsx:4**
```typescript
import Link from 'next/link';
```

**frontend/components/RouteError.tsx:2**
```typescript
import Link from 'next/link';
```

**REPLACEMENT:** Vite file-based routing OR Leptos Router (future)

---

### 4. STYLING — ⚠️ CSS FILES (VIOLATIONS)

#### Files to DELETE:
1. `frontend/app/features/system/styles/PhoenixContextPanel.css`
2. `frontend/app/styles/globals.css` (if duplicate of app/globals.css)
3. `frontend/style.css` (if not needed)

#### Files to MODIFY:
1. `frontend/app/features/system/components/PhoenixContextPanel.tsx:4` - Remove CSS import
2. `frontend/app/features/system/components/PhoenixContextPanel.tsx:22-56` - Convert to Tailwind

#### Exact Lines to Remove:

**frontend/app/features/system/components/PhoenixContextPanel.tsx:4**
```typescript
import '@/features/system/styles/PhoenixContextPanel.css';
```

**REPLACEMENT:** Convert all styles to Tailwind classes + clsx

---

### 5. CONTEXT — ❌ MULTIPLE CONTEXTS (VIOLATIONS)

#### Files to MODIFY:
1. `frontend/app/providers/ZustandProvider.tsx:366-370,527-529` - Remove ZustandContext

#### Exact Lines to Remove:

**frontend/app/providers/ZustandProvider.tsx:366-370**
```typescript
const ZustandContext = createContext<ZustandContextType>(null);
export function usePhoenix() {
  const context = useContext(ZustandContext);
  ...
}
```

**frontend/app/providers/ZustandProvider.tsx:527-529**
```typescript
<ZustandContext.Provider value={{ store: usePhoenixStore }}>
  {children}
</ZustandContext.Provider>
```

**REPLACEMENT:** Single PhoenixContext (React Context) → Eventually Leptos signals

---

## SUMMARY: FILES TO DELETE

1. ✅ `frontend/app/providers/ZustandProvider.tsx` (534 lines)
2. ✅ `frontend/app/services/socket.ts` (273 lines)
3. ✅ `frontend/app/lib/socket.ts` (201 lines)
4. ✅ `frontend/lib/socket.ts` (173 lines)
5. ✅ `frontend/app/features/ember-unit/services/emberUnitSocket.ts`
6. ✅ `frontend/app/features/system/styles/PhoenixContextPanel.css`
7. ✅ `frontend/app/styles/globals.css` (if duplicate)
8. ✅ `frontend/app/hooks/usePhoenixContext.ts` (Zustand version)
9. ✅ `frontend/app/hooks/useSubconscious.ts` (Zustand version)

**Total:** ~2,500+ lines to delete

---

## SUMMARY: FILES TO MODIFY

1. `frontend/app/layout.tsx` - Remove ZustandProvider wrapper
2. `frontend/app/page.tsx` - Remove all WebSocket calls
3. `frontend/app/components/ServiceInitializer.tsx` - Remove WebSocket init
4. `frontend/app/components/ConscienceGauge.tsx` - Remove Zustand imports
5. `frontend/app/config/index.ts` - Remove `ws:` entries
6. `frontend/vite.config.ts` - Remove WebSocket proxy
7. `frontend/package.json` - Remove `zustand` dependency
8. `frontend/app/features/system/components/PhoenixContextPanel.tsx` - Remove CSS, convert to Tailwind
9. `phoenix-kernel/phoenix-core/src/api/server.rs` - Remove WebSocket routes/handlers

---

## EXECUTION ORDER

1. Delete WebSocket files (frontend)
2. Remove WebSocket routes (backend)
3. Delete Zustand files
4. Remove Zustand from layout
5. Convert CSS to Tailwind
6. Remove Next.js routing imports
7. Update package.json

---

**Ready to execute removals.**
