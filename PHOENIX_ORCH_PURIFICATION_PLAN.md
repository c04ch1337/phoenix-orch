# PHOENIX ORCH PURIFICATION PLAN

This document provides a detailed surgical plan for restoring Phoenix ORCH to production purity, with specific files to delete, create, and modify, along with implementation steps and migration patterns.

## 1. FILE INVENTORY

### 1.1 Files to Delete

#### Next.js Remnants
- `frontend/next.config.ts`
- `frontend/.next/` (entire directory)
- `frontend/middleware.ts` 
- `frontend/app/` (entire directory - to be migrated to new structure)

#### WebSocket Implementation
- `frontend/app/lib/socket.ts` (if exists)
- `frontend/tests/websocket.test.ts`
- `frontend/tests/mocks/server.ts` (WebSocket mock server)

#### CSS Modules
- No CSS modules were found in current implementation

### 1.2 Files to Create

#### Core Structure
- `frontend/src/main.tsx` - Application entry point
- `frontend/src/App.tsx` - Root application component
- `frontend/src/index.html` - HTML template

#### Routing Structure
- `frontend/src/routes/index.tsx` - Main router configuration
- `frontend/src/routes/root.tsx` - Root layout component
- `frontend/src/routes/home/index.tsx` - Home page
- `frontend/src/routes/auth/login.tsx` - Login page
- `frontend/src/routes/cipher/index.tsx` - Cipher page
- `frontend/src/routes/ember/index.tsx` - Ember page
- `frontend/src/routes/forge/index.tsx` - Forge page
- `frontend/src/routes/weaver/index.tsx` - Weaver page

#### State Management
- `frontend/src/stores/phoenixStore.ts` - Main application state
- `frontend/src/stores/uiStore.ts` - UI state management
- `frontend/src/stores/authStore.ts` - Authentication state

#### Data Fetching
- `frontend/src/queries/usePhoenixData.ts` - TanStack Query hooks
- `frontend/src/queries/useAgentQueries.ts` - Agent-related queries

#### Tauri Integration
- `frontend/src/tauri/invoke.ts` - Type-safe Tauri invoke wrappers
- `frontend/src/tauri/mock.ts` - Mock implementations for dev mode
- `frontend/src-tauri/src/modules/sse.rs` - Server-sent events implementation
- `frontend/src-tauri/src/modules/security.rs` - Security operations
- `frontend/src-tauri/src/modules/state.rs` - State management

#### Real-time Communication
- `frontend/src/services/sse.ts` - SSE client implementation

### 1.3 Files to Modify

#### Component Migration
- All components in `frontend/app/components/` → `frontend/src/components/`
- All features in `frontend/app/features/` → `frontend/src/features/`

#### Configuration Files
- `frontend/vite.config.ts` - Update aliases and configuration
- `frontend/tailwind.config.js` - Update content paths
- `frontend/tsconfig.json` - Update paths and options

## 2. MIGRATION PATTERNS

### 2.1 React Context → Zustand Migration

```typescript
// BEFORE: React Context (from search, although no direct examples found)
import { createContext, useContext, useState } from 'react';

const PhoenixContext = createContext(null);

export const PhoenixProvider = ({ children }) => {
  const [state, setState] = useState({});
  
  return (
    <PhoenixContext.Provider value={{ state, setState }}>
      {children}
    </PhoenixContext.Provider>
  );
};

export const usePhoenixContext = () => useContext(PhoenixContext);

// AFTER: Zustand Store
import { create } from 'zustand';

type PhoenixState = {
  // State properties here
  status: string;
  version: string;
  isConnected: boolean;
  
  // Actions
  setStatus: (status: string) => void;
  setVersion: (version: string) => void;
  setConnected: (connected: boolean) => void;
};

export const usePhoenixStore = create<PhoenixState>()((set) => ({
  status: 'idle',
  version: '1.0.0',
  isConnected: false,
  
  setStatus: (status) => set({ status }),
  setVersion: (version) => set({ version }),
  setConnected: (connected) => set({ isConnected: connected }),
}));

// USAGE in components
const { status, isConnected, setStatus } = usePhoenixStore();
```

### 2.2 WebSocket → SSE Migration

```typescript
// BEFORE: WebSocket implementation
const ws = new WebSocket('ws://localhost:5001');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle message
};

ws.onclose = () => {
  // Handle close
};

// AFTER: SSE implementation
import { EventSource } from 'eventsource-parser';

const sseClient = {
  eventSource: null as EventSource | null,
  listeners: new Map<string, (data: any) => void>(),
  
  connect: (url: string = 'http://localhost:5001/api/sse') => {
    if (sseClient.eventSource) return;
    
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type || 'message';
        
        const listener = sseClient.listeners.get(eventType);
        if (listener) {
          listener(data);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      sseClient.disconnect();
      // Implement reconnection strategy here
      setTimeout(() => sseClient.connect(url), 5000);
    };
    
    sseClient.eventSource = eventSource;
  },
  
  disconnect: () => {
    if (!sseClient.eventSource) return;
    sseClient.eventSource.close();
    sseClient.eventSource = null;
  },
  
  subscribe: <T>(eventType: string, callback: (data: T) => void) => {
    sseClient.listeners.set(eventType, callback as any);
    return () => {
      sseClient.listeners.delete(eventType);
    };
  }
};

export default sseClient;
```

### 2.3 fetch() → Tauri invoke() Migration

```typescript
// BEFORE: Direct fetch() to backend
const fetchHealth = async () => {
  const response = await fetch('http://localhost:5001/health');
  return response.ok;
};

// AFTER: Tauri invoke() pattern
import { invoke } from '@tauri-apps/api/tauri';

// Type definitions for Tauri commands
interface HealthCheckResponse {
  status: 'ok' | 'error';
  message?: string;
}

// Type-safe invoke wrapper
export const checkHealth = async (): Promise<HealthCheckResponse> => {
  try {
    return await invoke<HealthCheckResponse>('check_health');
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error', message: String(error) };
  }
};

// Implementation in Rust backend (src-tauri/src/modules/health.rs)
#[tauri::command]
pub fn check_health() -> Result<HealthCheckResponse, String> {
  // Implementation details
  Ok(HealthCheckResponse {
    status: "ok".to_string(),
    message: None,
  })
}
```

## 3. CIRCULAR DEPENDENCY RESOLUTION

### 3.1 Identification

Common circular dependency patterns in the codebase:
1. Two-way imports between modules (e.g., cipher-guard and ember-unit)
2. Core service importing consumers of that service
3. Utils/helpers importing high-level modules

### 3.2 Resolution Strategies

#### 3.2.1 Dependency Inversion Pattern

```rust
// BEFORE: Direct dependencies
// In module_a.rs
use crate::module_b::ModuleB;

// In module_b.rs
use crate::module_a::ModuleA;

// AFTER: Using traits/interfaces
// In interfaces.rs
pub trait ModuleAInterface {
    fn process(&self, input: &str) -> String;
}

pub trait ModuleBInterface {
    fn compute(&self, data: &str) -> i32;
}

// In module_a.rs
use crate::interfaces::ModuleBInterface;

pub struct ModuleA<T: ModuleBInterface> {
    module_b: T,
}

// In module_b.rs
use crate::interfaces::ModuleAInterface;

pub struct ModuleB<T: ModuleAInterface> {
    module_a: T,
}
```

#### 3.2.2 Mediator Pattern

```rust
// Create central mediator/service locator
pub struct AppState {
    cipher_guard: Option<Arc<CipherGuard>>,
    ember_unit: Option<Arc<EmberUnit>>,
    // Other modules
}

impl AppState {
    pub fn new() -> Self {
        Self {
            cipher_guard: None,
            ember_unit: None,
        }
    }
    
    pub fn initialize(&mut self) {
        let cipher_guard = Arc::new(CipherGuard::new(self.clone()));
        let ember_unit = Arc::new(EmberUnit::new(self.clone()));
        
        self.cipher_guard = Some(cipher_guard);
        self.ember_unit = Some(ember_unit);
    }
    
    pub fn get_cipher_guard(&self) -> Option<Arc<CipherGuard>> {
        self.cipher_guard.clone()
    }
    
    pub fn get_ember_unit(&self) -> Option<Arc<EmberUnit>> {
        self.ember_unit.clone()
    }
}

// Modules receive AppState instead of direct dependencies
pub struct CipherGuard {
    app_state: Weak<Mutex<AppState>>,
}

impl CipherGuard {
    pub fn new(app_state: Arc<Mutex<AppState>>) -> Self {
        Self {
            app_state: Arc::downgrade(&app_state),
        }
    }
    
    pub fn get_ember_unit(&self) -> Option<Arc<EmberUnit>> {
        if let Some(app_state) = self.app_state.upgrade() {
            if let Ok(state) = app_state.lock() {
                return state.get_ember_unit();
            }
        }
        None
    }
}
```

#### 3.2.3 Event-Based Communication

```rust
// Event definitions
pub enum SystemEvent {
    CipherAlert(CipherAlertData),
    EmberActivation(EmberActivationData),
    // Other events
}

// Event bus
pub struct EventBus {
    listeners: Mutex<HashMap<TypeId, Vec<Box<dyn Fn(&SystemEvent) + Send + Sync>>>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            listeners: Mutex::new(HashMap::new()),
        }
    }
    
    pub fn subscribe<T: 'static>(&self, callback: impl Fn(&T) + Send + Sync + 'static) {
        let type_id = TypeId::of::<T>();
        let mut listeners = self.listeners.lock().unwrap();
        
        let listener = move |event: &SystemEvent| {
            if let Some(payload) = event.downcast_ref::<T>() {
                callback(payload);
            }
        };
        
        listeners
            .entry(type_id)
            .or_insert_with(Vec::new)
            .push(Box::new(listener));
    }
    
    pub fn publish(&self, event: SystemEvent) {
        let listeners = self.listeners.lock().unwrap();
        
        for (_, callbacks) in listeners.iter() {
            for callback in callbacks {
                callback(&event);
            }
        }
    }
}
```

## 4. TEST-FIRST STRATEGY

Implement each migration step with a test-first approach according to the PHOENIX_ORCH_TEST_PLAN.md:

1. Write test for component/feature before migrating
2. Run test against existing implementation to verify expected behavior
3. Migrate component/feature to new architecture
4. Run test against new implementation to verify behavior is maintained
5. Add specific tests for new architectural requirements

### 4.1 Component Migration Test Example

```typescript
// Testing Zustand store migration
import { renderHook, act } from '@testing-library/react-hooks';
import { usePhoenixStore } from '@/stores/phoenixStore';

describe('Phoenix Store', () => {
  beforeEach(() => {
    const { result } = renderHook(() => usePhoenixStore());
    act(() => {
      result.current.setStatus('idle');
      result.current.setConnected(false);
      // Reset other state
    });
  });
  
  it('should update status', () => {
    const { result } = renderHook(() => usePhoenixStore());
    
    act(() => {
      result.current.setStatus('active');
    });
    
    expect(result.current.status).toBe('active');
  });
  
  it('should update connection state', () => {
    const { result } = renderHook(() => usePhoenixStore());
    
    act(() => {
      result.current.setConnected(true);
    });
    
    expect(result.current.isConnected).toBe(true);
  });
});
```

### 4.2 SSE Migration Test Example

```typescript
// Testing SSE implementation
import sseClient from '@/services/sse';

describe('SSE Client', () => {
  let mockEventSource;
  
  beforeEach(() => {
    // Mock EventSource implementation
    mockEventSource = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
    };
    
    global.EventSource = jest.fn(() => mockEventSource);
  });
  
  it('should connect to SSE endpoint', () => {
    sseClient.connect();
    expect(global.EventSource).toHaveBeenCalledWith('http://localhost:5001/api/sse');
  });
  
  it('should handle messages correctly', () => {
    const callback = jest.fn();
    sseClient.connect();
    sseClient.subscribe('test-event', callback);
    
    // Simulate receiving a message
    const messageEvent = {
      data: JSON.stringify({
        type: 'test-event',
        payload: { value: 'test' }
      })
    };
    
    mockEventSource.onmessage(messageEvent);
    
    expect(callback).toHaveBeenCalledWith({
      type: 'test-event',
      payload: { value: 'test' }
    });
  });
});
```

## 5. IMPLEMENTATION SEQUENCE

The implementation will proceed in the following order:

### 5.1 Preparation Phase

1. Create new directory structure
2. Set up Vite configuration
3. Configure TypeScript and ESLint
4. Set up Tailwind configuration

### 5.2 Core Architecture Migration

1. **Implement routing** - Create React Router v6 structure
2. **Implement state management** - Create Zustand stores
3. **Implement API layer** - Set up Tauri invoke patterns
4. **Implement real-time communication** - Create SSE service

### 5.3 Component Migration

1. Migrate core components (shared UI elements)
2. Migrate feature components (domain-specific)
3. Migrate page components (route targets)

### 5.4 Backend Refactoring

1. Implement Rust module structure
2. Resolve circular dependencies
3. Implement security modules
4. Implement SSE backend

### 5.5 Testing and Verification

1. Run static analysis tests
2. Run unit tests
3. Run integration tests
4. Run E2E tests
5. Verify performance benchmarks

## 6. IMPLEMENTATION CHECKLIST

### 6.1 Frontend Structure

- [ ] Create `src/` directory with proper structure
- [ ] Set up React Router with file-based routing
- [ ] Implement Zustand stores
- [ ] Set up TanStack Query
- [ ] Create SSE client service
- [ ] Implement Tauri invoke wrappers

### 6.2 Component Migrations

- [ ] Migrate shared components
- [ ] Migrate feature components
- [ ] Migrate layout components
- [ ] Ensure all components use Tailwind for styling

### 6.3 Backend Structure

- [ ] Create proper Rust module structure
- [ ] Implement SSE functionality
- [ ] Implement security modules
- [ ] Resolve circular dependencies

### 6.4 Build & Configuration

- [ ] Update Vite configuration
- [ ] Configure proper port bindings
- [ ] Set up Tauri configuration

### 6.5 Testing

- [ ] Implement test suite for migrated components
- [ ] Verify architectural compliance
- [ ] Run integration tests
- [ ] Verify performance