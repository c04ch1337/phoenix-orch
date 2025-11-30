# Phoenix ORCH - Pure Implementation Architecture

This document outlines the comprehensive architectural plan for the restoration of Phoenix ORCH to production-grade purity according to the specified requirements.

## 1. Architectural Overview

The Phoenix ORCH application follows the architecture below:

```
frontend/
├── src/                    # Frontend source code
│   ├── main.tsx           # Application entry point
│   ├── App.tsx            # Root application component
│   ├── routes/            # File-based routing
│   ├── components/        # Reusable React components
│   ├── stores/            # Zustand state management
│   ├── queries/           # TanStack Query definitions
│   ├── tauri/             # Tauri invoke() wrappers
│   ├── services/          # Service layer
│   ├── types/             # TypeScript type definitions
│   └── styles/            # Global Tailwind styles
├── src-tauri/             # Tauri/Rust backend
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri configuration
│   └── src/               # Rust source code
│       ├── main.rs        # Main application entry point
│       └── modules/       # Rust module structure
│           ├── cipher.rs  # Cipher operations
│           ├── ember.rs   # Ember Unit functionality
│           ├── security.rs # Security operations
│           ├── state.rs   # State management
│           ├── sse.rs     # SSE implementation
│           └── mod.rs     # Module exports
└── public/               # Static assets
```

## 2. Implementation Details

### 2.1. Frontend Framework: Vite + React 19 + TypeScript

- **Pure Vite Configuration**: Configured for optimal performance with React 19
- **Zero Next.js Dependencies**: Removed all Next.js imports, components, hooks, and logic
- **TypeScript Integration**: Strict type checking throughout the application

### 2.2. Routing: React Router v6.26+ (file-based)

- **File-Based Structure**: Routes defined in `src/routes/` mimicking file system paths
- **Clean URL Structure**: URL patterns match file structure for intuitive navigation
- **Type-Safety**: Route parameters fully typed with TypeScript

### 2.3. State Management

- **Zustand Global State**: All global state managed through Zustand stores
    - Application state (`src/stores/phoenixStore.ts`)
    - UI state (`src/stores/uiStore.ts`)
    - Authentication state (`src/stores/authStore.ts`)
    
- **TanStack Query Server State**: All server data fetching managed through TanStack Query
    - Custom hooks for data fetching (`src/queries/usePhoenixData.ts`)
    - Caching and revalidation strategies
    
- **Zero React Context Usage**: No React Context API used for state management

### 2.4. Real-time Communication

- **SSE Only**: Server-Sent Events for all real-time communication
    - SSE service (`src/services/sse.ts`) for frontend
    - Rust SSE implementation (`src-tauri/src/modules/sse.rs`) for backend
    - Port 5001 for all SSE traffic
    
- **WebSockets Removed**: Eliminated all WebSocket code

### 2.5. Styling: Tailwind Only

- **Pure Tailwind Usage**: All components styled using Tailwind utility classes
- **Zero Inline Styles**: No inline style attributes in React components
- **No CSS Modules**: Removed all CSS module usage

### 2.6. Security

- **Rust Backend Security**: All security-critical operations moved to Rust backend
    - Cryptographic operations (`src-tauri/src/modules/security.rs`)
    - Input validation
    - Memory analysis and protection
    
- **Type-Safe Communications**: Strong typing between frontend and backend

### 2.7. Backend Communications

- **Tauri invoke() Only**: All communications with backend through Tauri's invoke()
    - Type-safe wrapper (`src/tauri/invoke.ts`)
    - Mock implementation for development (`src/tauri/mock.ts`)
    
- **Zero Direct fetch()**: No direct fetch() calls to localhost:5001

### 2.8. Port Configuration

- **Backend**: Locked to port 5001
- **Frontend Dev**: Locked to port 5000
- **Port Security**: Configuration enforced in both code and configuration

### 2.9. Module Structure

- **Rust-Side Logic**: All business logic lives in `src-tauri/src/modules/`
- **Logical Grouping**: Modules organized by domain responsibility
- **Clear Interfaces**: Well-defined module interfaces

## 3. Circular Dependency Resolution

The implementation breaks circular dependencies in the Rust code through:

1. **Dependency Inversion**: Module interfaces depend on abstractions, not concrete implementations
2. **Mediator Pattern**: Central state (`AppState`) acts as mediator between modules
3. **Event-Based Communication**: SSE for asynchronous communication between components
4. **Interface Segregation**: Modules expose minimal, focused interfaces
5. **Composition Over Inheritance**: Modules composed rather than inherited

## 4. Implementation Approach

The implementation follows this approach:

1. **Scaffold Architecture**: Create basic structure with correct folders and files
2. **Remove Next.js**: Systematically remove all Next.js code and dependencies
3. **Implement Core Framework**: Set up Vite, React Router, Zustand, and TanStack Query
4. **Migrate Components**: Convert components to new architecture
5. **Implement Rust Backend**: Create modular Rust backend structure
6. **Connect Frontend-Backend**: Implement Tauri invoke() communication
7. **Style Conversion**: Convert all styling to Tailwind utility classes
8. **Testing**: Verify implementation against requirements

## 5. File Inventory

### 5.1. Files to Create

- Frontend React + Vite structure
- Tauri configuration and Rust backend
- New component structure
- New routing structure
- Zustand stores
- TanStack Query hooks
- SSE service implementation
- Tailwind configuration

### 5.2. Files to Delete

- All Next.js configuration files
- App Router structure
- `pages/` directory
- WebSocket implementation
- CSS modules
- Context API providers
- Direct fetch() implementations

## 6. Testing Strategy

The testing strategy is detailed in `PHOENIX_ORCH_TEST_PLAN.md` and includes:

- Unit tests for all components and modules
- Integration tests for module interactions
- End-to-end tests for complete workflows
- Performance benchmarks against previous implementation
- Security testing for the new architecture

## 7. Conclusion

This pure implementation of Phoenix ORCH provides:

- Enhanced performance through modern frontend technologies
- Improved security through Rust backend
- Better developer experience with clear architecture
- Simplified state management
- Type-safe communications
- Maintainable and testable codebase

The architecture strictly adheres to the specified requirements while providing a solid foundation for future development.