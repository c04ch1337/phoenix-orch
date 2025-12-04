# Cipher Guard Automation System

The Cipher Guard Automation System is a comprehensive automation framework for the Professional Digital Twin, providing scheduled job orchestration, daily briefings, Obsidian integration, Teams notifications, and voice alerts.

## Architecture

The system is composed of several key modules:

### 1. Job Scheduler (`job_scheduler.rs`)
- Manages scheduled automation tasks using `tokio-cron-scheduler`
- Supports configurable job definitions with retry policies
- Provides job status tracking and monitoring
- Implements concurrent job execution with configurable limits

### 2. Briefing Generator (`briefing.rs`)
- Generates daily security briefings in markdown format
- Collects and aggregates data from multiple security tools
- Includes sections for:
  - Top 5 active incidents
  - New high/critical vulnerabilities
  - Phishing campaign statistics
  - Overnight EDR alerts
  - Assigned JIRA tickets
- Provides trend analysis and recommendations

### 3. Obsidian Integration (`obsidian.rs`)
- Implements file system watcher for Obsidian vault
- Manages note templates and automatic linking
- Handles metadata management
- Provides automatic backup functionality
- Supports custom note creation for security events

### 4. Teams Integration (`teams.rs`)
- Posts daily briefings to specified channels
- Implements interactive message cards
- Manages notification rules and priorities
- Handles reaction acknowledgments
- Creates threaded discussions for incidents
- Implements rate limiting and retry logic

### 5. Voice System (`voice.rs`)
- Provides text-to-speech capabilities
- Supports configurable voice profiles
- Implements priority-based voice alerts
- Handles voice command acknowledgments
- Includes background noise filtering
- Manages audio device configuration

### 6. Automation Engine (`engine.rs`)
- Core automation framework
- Implements rule-based triggers
- Manages conditional execution paths
- Provides action templating
- Handles comprehensive audit logging
- Includes performance monitoring
- Implements error handling and recovery

## Configuration

The system uses a YAML-based configuration system with the following structure:

```yaml
job_scheduler:
  max_concurrent_jobs: 10
  job_history_retention_days: 30
  metrics_enabled: true

briefing:
  max_incidents: 5
  max_vulnerabilities: 10
  template_path: "templates/briefing"
  output_path: "output/briefings"
  data_retention_days: 90

obsidian:
  vault_path: "vault"
  template_path: "templates/obsidian"
  backup_path: "backups/obsidian"
  watch_patterns: ["*.md"]
  auto_backup_enabled: true
  backup_interval_hours: 24

teams:
  webhook_url: "https://..."
  channel_id: "..."
  notification_preferences:
    incident_threshold: "High"
    vulnerability_threshold: "Critical"
    quiet_hours_start: "22:00"
    quiet_hours_end: "06:00"
    weekend_notifications: false
  message_retention_days: 30
  rate_limit:
    messages_per_minute: 30
    burst_limit: 5

voice:
  enabled: true
  default_profile:
    voice_id: "default"
    language: "en-US"
    speed: 1.0
    pitch: 1.0
    volume: 1.0
  audio_output_device: "default"
  noise_reduction_enabled: true

engine:
  rules_path: "config/rules"
  templates_path: "config/templates"
  max_action_timeout_seconds: 300
  audit_log_path: "logs/audit"
  performance_monitoring:
    enabled: true
    metrics_retention_days: 30
    alert_threshold_ms: 1000
```

## Usage Examples

### 1. Creating a Scheduled Job

```rust
let job = JobDefinition {
    id: "daily-briefing".to_string(),
    name: "Daily Security Briefing".to_string(),
    schedule: "0 9 * * *".to_string(), // Daily at 9 AM
    enabled: true,
    retry_policy: RetryPolicy {
        max_attempts: 3,
        backoff_seconds: 300,
        max_backoff_seconds: 3600,
    },
    actions: vec![
        AutomationAction {
            action_type: ActionType::GenerateBriefing,
            parameters: HashMap::new(),
        },
        AutomationAction {
            action_type: ActionType::PostToTeams,
            parameters: HashMap::new(),
        },
    ],
    conditions: vec![],
};

automation_system.job_scheduler.add_job(job).await?;
```

### 2. Creating a Voice Alert

```rust
let alert = VoiceAlert {
    message: "Critical vulnerability detected".to_string(),
    priority: AlertPriority::High,
    profile: VoiceProfile {
        voice_id: "alert".to_string(),
        language: "en-US".to_string(),
        speed: 1.2,
        pitch: 1.1,
        volume: 1.0,
    },
};

automation_system.voice_system.alert(alert).await?;
```

### 3. Creating an Obsidian Note

```rust
let mut params = HashMap::new();
params.insert("title".to_string(), "Security Incident Report".to_string());
params.insert("severity".to_string(), "High".to_string());
params.insert("description".to_string(), "Unauthorized access detected".to_string());

let note_path = automation_system.obsidian_integration
    .create_note("incident", params).await?;
```

## Error Handling

The system implements comprehensive error handling using custom error types:

```rust
#[derive(Debug, thiserror::Error)]
pub enum AutomationError {
    #[error("Job scheduling error: {0}")]
    JobScheduling(String),
    
    #[error("Briefing generation error: {0}")]
    BriefingGeneration(String),
    
    #[error("Teams integration error: {0}")]
    TeamsIntegration(String),
    
    #[error("Obsidian integration error: {0}")]
    ObsidianIntegration(String),
    
    #[error("Voice system error: {0}")]
    VoiceSystem(String),
    
    #[error("Automation engine error: {0}")]
    Engine(String),
}
```

## Testing

The system includes comprehensive test coverage:

- Unit tests for each module
- Integration tests for component interactions
- Performance tests for critical paths
- Mock implementations for external dependencies
- Scenario-based testing for automation rules

Run tests using:
```bash
cargo test --all-features
```

## Monitoring and Metrics

The system provides monitoring capabilities through:

- Performance metrics for action execution
- Job execution statistics
- Voice system health metrics
- Teams integration status
- Obsidian sync status
- Audit logs for all automation actions

## Security Considerations

- All sensitive configuration is stored securely
- Teams webhook URLs are encrypted at rest
- Obsidian vault access is restricted
- Voice alerts require authentication
- Audit logging for all actions
- Rate limiting for external integrations

## Dependencies

See `Cargo.toml` for the complete list of dependencies and their versions.