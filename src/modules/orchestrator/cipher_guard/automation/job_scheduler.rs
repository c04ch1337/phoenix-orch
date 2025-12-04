use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler as TokioScheduler};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::modules::orchestrator::cipher_guard::automation::{
    config::AutomationConfig,
    types::{JobDefinition, JobStatus, JobState, RetryPolicy},
};

pub struct JobScheduler {
    config: Arc<RwLock<AutomationConfig>>,
    scheduler: Arc<RwLock<TokioScheduler>>,
    jobs: Arc<RwLock<HashMap<String, JobDefinition>>>,
    job_statuses: Arc<RwLock<HashMap<String, JobStatus>>>,
}

impl JobScheduler {
    pub async fn new(config: Arc<RwLock<AutomationConfig>>) -> Result<Self, Box<dyn std::error::Error>> {
        let scheduler = TokioScheduler::new().await?;
        Ok(Self {
            config,
            scheduler: Arc::new(RwLock::new(scheduler)),
            jobs: Arc::new(RwLock::new(HashMap::new())),
            job_statuses: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.scheduler.write().await.start().await?;
        Ok(())
    }

    pub async fn stop(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.scheduler.write().await.shutdown().await?;
        Ok(())
    }

    pub async fn add_job(&self, job_def: JobDefinition) -> Result<(), Box<dyn std::error::Error>> {
        let job_id = job_def.id.clone();
        
        // Create initial job status
        let status = JobStatus {
            job_id: job_id.clone(),
            status: JobState::Pending,
            last_run: None,
            next_run: None,
            attempt: 0,
            error: None,
        };

        // Store job definition and status
        self.jobs.write().await.insert(job_id.clone(), job_def.clone());
        self.job_statuses.write().await.insert(job_id.clone(), status);

        // Create scheduler job
        let jobs_clone = self.jobs.clone();
        let statuses_clone = self.job_statuses.clone();
        
        let job = Job::new_async(job_def.schedule.as_str(), move |_uuid, _l| {
            let jobs = jobs_clone.clone();
            let statuses = statuses_clone.clone();
            let job_id = job_id.clone();
            
            Box::pin(async move {
                if let Some(job_def) = jobs.read().await.get(&job_id) {
                    let mut status = statuses.write().await;
                    let job_status = status.get_mut(&job_id).unwrap();
                    
                    job_status.status = JobState::Running;
                    job_status.attempt += 1;
                    job_status.last_run = Some(Utc::now());
                    
                    // Execute job actions
                    if let Err(e) = Self::execute_job_actions(job_def).await {
                        job_status.status = if should_retry(job_def.retry_policy, job_status.attempt) {
                            JobState::Retrying
                        } else {
                            JobState::Failed
                        };
                        job_status.error = Some(e.to_string());
                    } else {
                        job_status.status = JobState::Completed;
                        job_status.error = None;
                    }
                }
            })
        })?;

        self.scheduler.write().await.add(job).await?;
        Ok(())
    }

    pub async fn remove_job(&self, job_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(job) = self.jobs.write().await.remove(job_id) {
            self.job_statuses.write().await.remove(job_id);
            // Remove from scheduler
            self.scheduler.write().await.remove(&job.id).await?;
        }
        Ok(())
    }

    pub async fn get_job_status(&self, job_id: &str) -> Option<JobStatus> {
        self.job_statuses.read().await.get(job_id).cloned()
    }

    pub async fn list_jobs(&self) -> Vec<(JobDefinition, JobStatus)> {
        let jobs = self.jobs.read().await;
        let statuses = self.job_statuses.read().await;
        
        jobs.iter()
            .filter_map(|(id, job)| {
                statuses.get(id).map(|status| (job.clone(), status.clone()))
            })
            .collect()
    }

    async fn execute_job_actions(job: &JobDefinition) -> Result<(), Box<dyn std::error::Error>> {
        for action in &job.actions {
            // Check conditions before executing action
            if !Self::check_conditions(&job.conditions).await? {
                continue;
            }

            // Execute the action based on its type
            match action.action_type {
                // Implementation for each action type will go here
                _ => todo!("Implement action execution")
            }
        }
        Ok(())
    }

    async fn check_conditions(conditions: &[AutomationCondition]) -> Result<bool, Box<dyn std::error::Error>> {
        for condition in conditions {
            match condition.condition_type {
                // Implementation for each condition type will go here
                _ => todo!("Implement condition checking")
            }
        }
        Ok(true)
    }
}

fn should_retry(policy: RetryPolicy, attempt: u32) -> bool {
    attempt < policy.max_attempts
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::orchestrator::cipher_guard::automation::types::*;

    #[tokio::test]
    async fn test_job_scheduler() {
        // Test implementation will go here
    }
}