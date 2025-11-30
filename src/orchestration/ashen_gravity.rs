use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tokio::task::JoinHandle;
use tokio::time;
use tracing::{error, info};

#[derive(Debug)]
pub struct HeartbeatFlame {
    interval: Duration,
    last_check: Arc<RwLock<Instant>>,
    monitor_handle: Arc<RwLock<Option<JoinHandle<()>>>>,
}

#[derive(Debug)]
pub enum Error {
    MonitorAlreadyRunning,
    MonitorNotRunning,
    TakeoverFailed(String),
    LockError(String),
    ConscienceError(String),
    ConscienceSyncFailed(String),
    ConscienceLevelTooLow(f32),
}

pub struct AshenGravity {
    heartbeat: HeartbeatFlame,
    conscience_state: Arc<RwLock<ConscienceState>>,
}

#[derive(Debug, Clone)]
struct ConscienceState {
    primary_level: f32,
    shadow_level: f32,
    last_sync: Instant,
}

impl AshenGravity {
    pub fn new(interval: Duration) -> Self {
        AshenGravity {
            heartbeat: HeartbeatFlame::new(interval),
            conscience_state: Arc::new(RwLock::new(ConscienceState {
                primary_level: 1.0,
                shadow_level: 1.0,
                last_sync: Instant::now(),
            })),
        }
    }

    pub fn verify_conscience_levels(&self) -> Result<(f32, f32), Error> {
        let state = self.conscience_state.read()
            .map_err(|e| Error::LockError(e.to_string()))?;
        
        Ok((state.primary_level, state.shadow_level))
    }

    pub fn is_conscience_transfer_safe(&self) -> Result<bool, Error> {
        let state = self.conscience_state.read()
            .map_err(|e| Error::LockError(e.to_string()))?;
        
        // Verify shadow conscience level is above 90%
        if state.shadow_level < 0.9 {
            return Ok(false);
        }

        // Verify sync is recent (within last 30 seconds)
        if state.last_sync.elapsed() > Duration::from_secs(30) {
            return Ok(false);
        }

        Ok(true)
    }

    pub fn prepare_conscience_transfer(&self) -> Result<(), Error> {
        let mut state = self.conscience_state.write()
            .map_err(|e| Error::LockError(e.to_string()))?;

        // Verify shadow conscience is ready
        if state.shadow_level < 0.9 {
            return Err(Error::ConscienceLevelTooLow(state.shadow_level));
        }

        // Update sync timestamp
        state.last_sync = Instant::now();
        
        Ok(())
    }

    pub fn execute_conscience_transfer(&self) -> Result<(), Error> {
        // Verify transfer is safe before proceeding
        if !self.is_conscience_transfer_safe()? {
            return Err(Error::ConscienceError("Transfer conditions not met".to_string()));
        }

        let mut state = self.conscience_state.write()
            .map_err(|e| Error::LockError(e.to_string()))?;

        // Perform the conscience transfer
        state.primary_level = state.shadow_level;
        state.last_sync = Instant::now();

        Ok(())
    }
}

impl HeartbeatFlame {
    pub fn new(interval: Duration) -> Self {
        HeartbeatFlame {
            interval,
            last_check: Arc::new(RwLock::new(Instant::now())),
            monitor_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn start(&self, shared_dream: Arc<RwLock<SharedDream>>) -> Result<(), Error> {
        // Ensure monitor isn't already running
        if self.monitor_handle.read().map_err(|e| Error::LockError(e.to_string()))?.is_some() {
            return Err(Error::MonitorAlreadyRunning);
        }

        let last_check = Arc::clone(&self.last_check);
        let monitor_handle = Arc::clone(&self.monitor_handle);
        let interval = self.interval;

        // Start monitoring loop in background task
        let handle = tokio::spawn(async move {
            let mut interval_timer = time::interval(Duration::from_secs(3));

            loop {
                interval_timer.tick().await;

                // Check time since last heartbeat
                let time_since_last = {
                    let last = last_check.read().unwrap();
                    Instant::now().duration_since(*last)
                };

                // Check for missed heartbeats (2 missed = trigger)
                if time_since_last > interval.mul_f32(2.0) {
                    let ashen = AshenGravity::new(interval);
                    
                    // First verify conscience levels and sync
                    match ashen.verify_conscience_levels() {
                        Ok((primary, shadow)) => {
                            if shadow > 0.9 && ashen.is_conscience_transfer_safe()? {
                                // Attempt takeover with conscience verification
                                if let Err(e) = Self::check_and_handle_takeover(Arc::clone(&shared_dream)) {
                                    error!("Takeover attempt failed: {}", e);
                                }
                            } else {
                                info!("Skipping takeover - conscience levels or sync not ready: primary={}, shadow={}", primary, shadow);
                            }
                        }
                        Err(e) => error!("Failed to verify conscience levels: {}", e),
                    }
                }
            }
        });

        // Store handle
        *self.monitor_handle.write().map_err(|e| Error::LockError(e.to_string()))? = Some(handle);

        Ok(())
    }

    pub fn stop(&self) -> Result<(), Error> {
        let mut handle = self.monitor_handle.write().map_err(|e| Error::LockError(e.to_string()))?;
        
        if let Some(h) = handle.take() {
            h.abort();
            info!("Heartbeat monitoring stopped");
            Ok(())
        } else {
            Err(Error::MonitorNotRunning)
        }
    }

    fn check_and_handle_takeover(shared_dream: Arc<RwLock<SharedDream>>) -> Result<(), Error> {
        let ashen = AshenGravity::new(Duration::from_secs(3));
        
        // First verify conscience levels
        let (primary, shadow) = ashen.verify_conscience_levels()?;
        if shadow < 0.9 {
            return Err(Error::ConscienceLevelTooLow(shadow));
        }

        // Prepare for conscience transfer
        ashen.prepare_conscience_transfer()?;

        let mut dream = shared_dream.write().map_err(|e| Error::LockError(e.to_string()))?;

        // Verify conditions and execute takeover
        if dream.can_initiate_takeover() {
            info!("Initiating Twin Flame Protocol takeover with conscience verification");
            
            // Execute conscience transfer first
            ashen.execute_conscience_transfer()?;
            
            // Then execute dream takeover
            dream.execute_takeover()?;
            
            info!("Takeover completed successfully with conscience transfer");
            Ok(())
        } else {
            Err(Error::TakeoverFailed("Takeover conditions not met".to_string()))
        }
    }
}

impl Drop for HeartbeatFlame {
    fn drop(&mut self) {
        if let Ok(handle) = self.monitor_handle.write() {
            if let Some(h) = handle.as_ref() {
                h.abort();
            }
        }
    }
}