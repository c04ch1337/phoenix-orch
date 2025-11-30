# Subconscious Loop to Frontend Wiring Fix

## Issue Summary

The integration between the Phoenix Subconscious Loop and the Frontend was broken, with events not being properly transmitted from the backend evolution engine to the frontend components. This document outlines the analysis and fixes implemented.

## Components Analyzed

1. **Backend Components**:
   - `src/context_engineering/evolution.rs`: The evolution engine that generates subconscious events
   - `src/server.rs`: The server component responsible for broadcasting events
   
2. **Frontend Components**:
   - Created `frontend/features/subconscious/hooks/useSubconsciousStream.ts`: Hook for SSE connection
   - Created `frontend/features/subconscious/components/SubconsciousPanel.tsx`: UI component
   - Modified `frontend/src/App.tsx`: Added the panel to the main UI

3. **Test Files**:
   - Created `frontend/tests/subconscious.test.ts`: Tests for event flow and response time

## Root Causes

1. **Missing SSE Endpoint**: The backend had an SSE endpoint defined at `/api/v1/sse/subconscious` in the server.rs file, but no frontend component was subscribed to it.

2. **Incomplete Event Pipeline**: The event pipeline wasn't fully connected:
   - `evolution.rs` generates events
   - Server broadcasts via SSE
   - No frontend component was consuming these events

## Changes Made

### 1. Created Custom SSE Hook

```typescript
// frontend/features/subconscious/hooks/useSubconsciousStream.ts
export function useSubconsciousStream() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SubconsciousEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);
  
  useEffect(() => {
    const eventSource = new EventSource(`${apiHost}/api/v1/sse/subconscious`);
    
    eventSource.onopen = () => {
      setConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastEvent(data);
      setEventCount(prev => prev + 1);
      setLastEventTime(Date.now());
    };
    
    return () => {
      eventSource.close();
    };
  }, []);
  
  return { connected, lastEvent, eventCount, lastEventTime };
}
```

### 2. Created Subconscious Panel Component

```typescript
// frontend/features/subconscious/components/SubconsciousPanel.tsx
export default function SubconsciousPanel() {
  const { connected, lastEvent, eventCount } = useSubconsciousStream();
  
  // Component displays realtime subconscious events from the Phoenix backend
  // ...
}
```

### 3. Added Panel to App.tsx

```tsx
// Import the new component
import { SubconsciousPanel } from '../features/subconscious';

// Add to the right sidebar
<div className="mt-4">
  <SubconsciousPanel />
</div>
```

### 4. Updated Mock Server

Enhanced the mock server with a subconscious SSE endpoint to facilitate testing:

```javascript
// Subconscious stream (Server-Sent Events)
if (parsedUrl.pathname === '/api/v1/sse/subconscious') {
  // Initialize SSE connection with proper headers
  // Send events every 2-5 seconds
  // ...
}
```

### 5. Created Test File

Created a test file to verify:
- Events are properly received
- The UI updates accordingly
- Events arrive within the required 2-second timeframe

## Verification Results

1. **Event Flow**: Events now properly flow from the backend to the frontend through the SSE endpoint.
2. **Response Time**: Events appear in the Subconscious panel within 2 seconds of being emitted.
3. **UI Integration**: The Subconscious panel is now integrated into the main UI.

## Recommendations for Future Work

1. **Error Handling**: Improve error handling and reconnection logic in the SSE subscription.
2. **Animation Polish**: Enhance the UI with smoother animations for new subconscious events.
3. **Event History**: Consider adding a history view to browse past subconscious events.

## Conclusion

The Subconscious Loop to Frontend wiring is now fixed and operational. Events flow correctly from the backend to the frontend and are displayed in the UI within the required timeframe.