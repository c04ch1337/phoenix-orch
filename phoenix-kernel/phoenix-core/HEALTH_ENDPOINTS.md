# Health Monitoring Endpoints

This document describes the production-grade health monitoring endpoints implemented for the Phoenix kernel API.

## Overview

Two endpoints provide different levels of health checking:
- `/health` - Lightweight liveness check
- `/ready` - Comprehensive readiness check with subsystem validation

## Endpoints

### GET /health

**Purpose**: Lightweight liveness probe to confirm the process is alive and responsive.

**Response Codes**:
- `200 OK` - Process is alive

**Response Body**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime_seconds": 123
}
```

**Fields**:
- `status`: Always "healthy" when endpoint responds
- `timestamp`: Current server time in ISO 8601 format
- `uptime_seconds`: Number of seconds since API server started

**Use Cases**:
- Kubernetes liveness probes
- Load balancer health checks
- Basic monitoring heartbeat
- Quick validation that the process hasn't crashed

**Performance**: Very lightweight, sub-millisecond response time.

---

### GET /ready

**Purpose**: Comprehensive readiness check to determine if the system can handle requests.

**Subsystems Checked**:
1. **memory_layer** - Persistent memory system (PlasticLTM)
2. **conscience_engine** - Triune conscience framework
3. **world_model** - World and self-model system

**Response Codes**:
- `200 OK` - All subsystems ready
- `503 Service Unavailable` - One or more subsystems not ready

**Response Body (All Ready)**:
```json
{
  "status": "ready",
  "subsystems": {
    "memory_layer": true,
    "conscience_engine": true,
    "world_model": true
  }
}
```

**Response Body (Not Ready)**:
```json
{
  "status": "not_ready",
  "missing": ["memory_layer", "world_model"],
  "ready": ["conscience_engine"]
}
```

**Subsystem Check Details**:

#### memory_layer
- **Check**: Attempts to list all memory entries
- **Ready When**: `PersistenceService.list_all()` succeeds
- **Not Ready When**: Database connection fails or data corruption detected

#### conscience_engine
- **Check**: Verifies ConscienceFramework initialization
- **Ready When**: Framework is initialized (always ready once created)
- **Not Ready When**: Never (fails during startup if initialization fails)

#### world_model
- **Check**: Queries component health status from PhoenixCore
- **Ready When**: Component status is `ComponentStatus::Healthy`
- **Not Ready When**: Component not found or status is degraded/failed/unknown

**Use Cases**:
- Kubernetes readiness probes
- API gateway routing decisions
- Pre-deployment validation
- System startup monitoring
- Dependencies for other services

**Performance**: Requires actual subsystem queries, typically 10-50ms response time.

## Implementation Details

### Location
- **File**: [`phoenix-kernel/phoenix-core/src/api/server.rs`](src/api/server.rs)
- **Handlers**: `health_handler()`, `ready_handler()`
- **Routes**: Registered in `start_server()` function

### State Management

The `ApiState` struct tracks:
```rust
pub struct ApiState {
    pub memory: Arc<Mutex<PersistenceService>>,
    pub conscience: Arc<ConscienceFramework>,
    pub core: Arc<PhoenixCore>,
    pub startup_time: DateTime<Utc>,
}
```

### Error Handling

- `/health` never fails (if it responds, system is alive)
- `/ready` returns 503 with detailed subsystem status on failures
- All errors are logged but don't crash the endpoint

### Testing

Tests are included in the module:
- `test_health_endpoint_returns_200` - Validates 200 status code
- `test_health_endpoint_returns_valid_json` - Validates response structure
- `test_health_endpoint_includes_timestamp` - Validates ISO 8601 timestamp
- `test_ready_endpoint_structure` - Validates response codes (200/503)
- `test_ready_endpoint_when_not_ready` - Validates 503 response structure

Run tests:
```bash
cd phoenix-kernel/phoenix-core
cargo test --lib api::server::tests
```

## Integration

### Kubernetes Example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: phoenix-kernel
spec:
  containers:
  - name: phoenix-core
    image: phoenix-kernel:latest
    ports:
    - containerPort: 8080
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      initialDelaySeconds: 3
      periodSeconds: 10
      timeoutSeconds: 1
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 2
      failureThreshold: 3
```

### Prometheus Monitoring

```yaml
- job_name: 'phoenix-health'
  scrape_interval: 30s
  metrics_path: /health
  static_configs:
  - targets: ['localhost:8080']
```

### Load Balancer Configuration

HAProxy example:
```
backend phoenix_backend
    option httpchk GET /ready
    http-check expect status 200
    server phoenix1 127.0.0.1:8080 check
```

## Future Enhancements

Potential improvements:
1. Add `/health/live` and `/health/ready` for clearer separation
2. Include resource usage metrics (CPU, memory) in responses
3. Add configurable health check timeouts
4. Implement graceful degradation indicators
5. Add subsystem-specific health details
6. Include last successful check timestamps
7. Add alerts for prolonged unready states

## Monitoring Recommendations

### Alert Thresholds

- **Critical**: `/health` fails for >30 seconds
- **Warning**: `/ready` returns 503 for >2 minutes
- **Info**: Individual subsystem transitions to not ready

### Metrics to Track

- Health endpoint response time (p50, p95, p99)
- Ready endpoint success rate
- Time spent in not-ready state per subsystem
- Subsystem transition frequency

## Troubleshooting

### /health returns 503
This should never happen. If it does:
1. Check if the API server process is running
2. Verify network connectivity
3. Check for OS-level resource exhaustion

### /ready returns 503
Check the response body for `missing` array:

- **memory_layer not ready**: 
  - Verify database files exist and are readable
  - Check disk space
  - Review memory system logs

- **world_model not ready**:
  - Check PhoenixCore initialization logs
  - Verify all dependencies are loaded
  - Review component health checks

- **conscience_engine not ready**:
  - This is rare - indicates initialization failure
  - Check conscience configuration
  - Review startup logs for errors

## References

- API Server Implementation: [`src/api/server.rs`](src/api/server.rs)
- System Health Types: [`phoenix-common/src/types.rs`](../phoenix-common/src/types.rs)
- Component Status: [`phoenix-common/src/types.rs:124-135`](../phoenix-common/src/types.rs:124)
- Main Integration: [`src/main.rs:314-327`](src/main.rs:314)