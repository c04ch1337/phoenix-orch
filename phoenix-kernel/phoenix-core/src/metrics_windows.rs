use anyhow::Result;
use sysinfo::{System, SystemExt, CpuExt, ProcessExt, DiskExt, Pid};
use windows::Win32::System::Performance;
use windows::core::PCWSTR;
use tracing::{info, error, warn};
use std::ptr::null_mut;

pub struct SystemMetrics {
    sys: System,
}

impl SystemMetrics {
    pub fn new() -> Self {
        Self {
            sys: System::new_all()
        }
    }

    pub fn refresh(&mut self) {
        self.sys.refresh_all();
    }

    pub fn get_cpu_usage(&self) -> f32 {
        self.sys.global_cpu_info().cpu_usage()
    }

    pub fn get_memory_usage(&self) -> (u64, u64) {
        (self.sys.used_memory(), self.sys.total_memory())
    }

    pub fn get_process_stats(&self) -> Result<ProcessStats> {
        let process = self.sys.process(Pid::from(std::process::id() as usize))
            .ok_or_else(|| anyhow::anyhow!("Could not find current process"))?;

        Ok(ProcessStats {
            cpu_usage: process.cpu_usage(),
            memory_usage: process.memory(),
            thread_count: process.threads().len() as u64,
        })
    }

    pub fn get_disk_usage(&self) -> Result<DiskStats> {
        let mut disk_stats = DiskStats::default();

        for disk in self.sys.disks() {
            disk_stats.total_space += disk.total_space();
            disk_stats.available_space += disk.available_space();
        }

        Ok(disk_stats)
    }

    pub fn get_performance_counters(&self) -> Result<PerformanceCounters> {
        unsafe {
            let mut counters = PerformanceCounters::default();
            let mut query_handle = null_mut();
            
            // Initialize query
            let status = Performance::PdhOpenQueryW(None, 0, &mut query_handle);
            if status.is_err() {
                return Err(anyhow::anyhow!("Failed to open PDH query: {:?}", status));
            }

            let mut counter_handles: Vec<(*mut std::ffi::c_void, *mut f64)> = Vec::new();

            // Add IO Read counter
            {
                let mut counter_handle = null_mut();
                let status = Performance::PdhAddCounterW(
                    query_handle,
                    windows::core::w!(r"\Process(*)\IO Read Operations/sec"),
                    0,
                    &mut counter_handle
                );
                if status.is_ok() {
                    counter_handles.push((counter_handle, &mut counters.io_read_operations_sec as *mut f64));
                } else {
                    warn!("Failed to add IO Read counter: {:?}", status);
                }
            }

            // Add IO Write counter
            {
                let mut counter_handle = null_mut();
                let status = Performance::PdhAddCounterW(
                    query_handle,
                    windows::core::w!(r"\Process(*)\IO Write Operations/sec"),
                    0,
                    &mut counter_handle
                );
                if status.is_ok() {
                    counter_handles.push((counter_handle, &mut counters.io_write_operations_sec as *mut f64));
                } else {
                    warn!("Failed to add IO Write counter: {:?}", status);
                }
            }

            // Add Memory Page Faults counter
            {
                let mut counter_handle = null_mut();
                let status = Performance::PdhAddCounterW(
                    query_handle,
                    windows::core::w!(r"\Memory\Page Faults/sec"),
                    0,
                    &mut counter_handle
                );
                if status.is_ok() {
                    counter_handles.push((counter_handle, &mut counters.memory_page_faults_sec as *mut f64));
                } else {
                    warn!("Failed to add Memory Page Faults counter: {:?}", status);
                }
            }

            if counter_handles.is_empty() {
                Performance::PdhCloseQuery(query_handle);
                return Err(anyhow::anyhow!("Failed to add any performance counters"));
            }

            // Collect initial values
            let status = Performance::PdhCollectQueryData(query_handle);
            if status.is_err() {
                Performance::PdhCloseQuery(query_handle);
                return Err(anyhow::anyhow!("Failed to collect initial query data: {:?}", status));
            }

            // Wait for next sample
            std::thread::sleep(std::time::Duration::from_millis(100));

            // Collect second values
            let status = Performance::PdhCollectQueryData(query_handle);
            if status.is_err() {
                Performance::PdhCloseQuery(query_handle);
                return Err(anyhow::anyhow!("Failed to collect second query data: {:?}", status));
            }

            // Get formatted counter values
            for (handle, value_ptr) in counter_handles {
                let mut counter_value = Performance::PDH_FMT_COUNTERVALUE::default();
                let status = Performance::PdhGetFormattedCounterValue(
                    handle,
                    Performance::PDH_FMT_DOUBLE,
                    None,
                    &mut counter_value
                );

                if status.is_err() {
                    warn!("Failed to get counter value: {:?}", status);
                    continue;
                }

                *value_ptr = counter_value.Anonymous.doubleValue;
            }

            // Clean up
            Performance::PdhCloseQuery(query_handle);

            Ok(counters)
        }
    }
}

#[derive(Debug, Default)]
pub struct ProcessStats {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub thread_count: u64,
}

#[derive(Debug, Default)]
pub struct DiskStats {
    pub total_space: u64,
    pub available_space: u64,
}

#[derive(Debug, Default)]
pub struct PerformanceCounters {
    pub io_read_operations_sec: f64,
    pub io_write_operations_sec: f64,
    pub memory_page_faults_sec: f64,
}

pub fn setup_metrics() -> Result<()> {
    info!("Initializing Windows system metrics");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_metrics() {
        let metrics = SystemMetrics::new();
        
        // Basic sanity checks
        assert!(metrics.get_cpu_usage() >= 0.0);
        
        let (used, total) = metrics.get_memory_usage();
        assert!(used <= total);
        
        let disk_stats = metrics.get_disk_usage().unwrap();
        assert!(disk_stats.available_space <= disk_stats.total_space);

        // Test performance counters
        match metrics.get_performance_counters() {
            Ok(perf_counters) => {
                // Verify counter values are non-negative
                assert!(perf_counters.io_read_operations_sec >= 0.0);
                assert!(perf_counters.io_write_operations_sec >= 0.0);
                assert!(perf_counters.memory_page_faults_sec >= 0.0);
            }
            Err(e) => {
                // Log error but don't fail test as counters may not be available
                warn!("Performance counters test failed: {:?}", e);
            }
        }
    }

    #[test]
    fn test_process_stats() {
        let metrics = SystemMetrics::new();
        let stats = metrics.get_process_stats().unwrap();
        
        assert!(stats.cpu_usage >= 0.0);
        assert!(stats.memory_usage > 0);
        assert!(stats.thread_count > 0);
    }
}