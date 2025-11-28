# Frontend-Backend Integration Guide

## Architecture Overview

```
phoenix-project/
├── frontend/              # React + TypeScript + Vite
│   └── src/
│       ├── components/    # HealthPanel component
│       ├── pages/         # Dashboard page
│       ├── services/      # API client (axios)
│       └── types/         # TypeScript types
│
└── phoenix-kernel/        # Rust backend
    └── phoenix-core/
        └── src/
            └── api.rs     # HTTP API with /health endpoint
```

## API Endpoints

### Health Endpoint
- **URL**: `http://localhost:5001/health`
- **Method**: GET
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": {
      "memory_integrity": 0.98,
      "conscience_alignment": 0.95,
      "world_model_coherence": 0.92,
      "learning_rate": 0.15,
      "value_drift": 0.05,
      "perception_latency": 45.2,
      "timestamp": "2025-01-XX..."
    },
    "uptime": 3600,
    "version": "1.0.0"
  },
  "error": null
}
```

## CORS Configuration

The backend is configured to allow CORS from any origin:
```rust
.with(warp::cors().allow_any_origin())
```

This allows the frontend (running on port 5000) to make requests to the backend (port 5001).

## Data Flow

1. **Frontend** (`HealthPanel.tsx`):
   - Polls `/health` endpoint every 5 seconds
   - Uses `healthApi.getHealth()` from `services/api.ts`
   - Displays metrics with color-coded status bars

2. **Backend** (`api.rs`):
   - Handles GET `/health` requests
   - Retrieves `SystemHealth` from `SystemState`
   - Returns JSON response with health metrics

3. **Types**:
   - Frontend types in `frontend/src/types/health.ts` match backend `SystemHealth` structure
   - Both use same field names and types

## Running Both Services

### Terminal 1 - Backend
```bash
cd phoenix-kernel/phoenix-core
cargo run --release -- daemon --data-dir ./data
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install  # First time only
npm run dev
```

### Browser
Open `http://localhost:5000`

## Health Metrics Thresholds

The frontend uses the same thresholds as the backend:

- **Memory Integrity**: > 0.95 (95%)
- **Conscience Alignment**: > 0.9 (90%)
- **World Model Coherence**: > 0.85 (85%)
- **Learning Rate**: > 0.1 (10%)
- **Value Drift**: < 0.3 (30%)
- **Perception Latency**: < 100ms

Metrics are color-coded:
- 🟢 Green: Healthy (above/below threshold)
- 🔴 Red: Unhealthy (below/above threshold)

## Troubleshooting

### Frontend can't connect to backend
1. Verify backend is running: `curl http://localhost:5001/health`
2. Check CORS configuration in `phoenix-core/src/api.rs`
3. Verify `VITE_API_BASE_URL` in frontend `.env`

### Health metrics not updating
1. Check browser console for errors
2. Verify backend is returning valid JSON
3. Check network tab in browser dev tools

### Type mismatches
1. Ensure `frontend/src/types/health.ts` matches backend `SystemHealth`
2. Both use same field names (snake_case)
3. Timestamp is ISO string in frontend, `DateTime<Utc>` in backend

## Next Steps

- Add more dashboard panels (memory stats, conscience details, etc.)
- Add WebSocket support for real-time updates
- Add authentication/authorization
- Add error boundaries and retry logic
- Add unit tests for components

