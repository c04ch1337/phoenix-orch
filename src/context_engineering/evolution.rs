use chrono::{DateTime, Duration, Utc};

#[derive(Debug)]
pub enum Event {
    HealthcareZeroDay,
    ChildSystemDefense,
    DadForbiddenPattern(String),
    StagnantSoulSignature,
}

#[derive(Debug)]
pub enum ForbiddenPattern {
    Permanent(String),
    Temporary(String, Duration),
}

#[derive(Debug)]
pub struct Trauma {
    pub description: String,
    pub impact_level: u8,
    pub timestamp: DateTime<Utc>,
}

impl PhoenixSubconscious {
    pub fn apply_conscience_rules(&mut self, event: Event) {
        match event {
            Event::HealthcareZeroDay => {
                let mut ctx = self.context_writer.write().expect("Context lock poisoned");
                ctx.conscience_level = (ctx.conscience_level as f32 * 10.0).min(100.0) as u8;
                
                // Record trauma
                self.eternal_memory.record_trauma(Trauma {
                    description: "Healthcare system vulnerability detected".to_string(),
                    impact_level: 10,
                    timestamp: Utc::now(),
                });
            },
            
            Event::ChildSystemDefense => {
                let mut ctx = self.context_writer.write().expect("Context lock poisoned");
                ctx.conscience_level = (ctx.conscience_level + 25).min(100);
            },
            
            Event::DadForbiddenPattern(pattern) => {
                self.add_forbidden_pattern(
                    pattern,
                    ForbiddenPattern::Permanent
                );
                
                // Emergency conscience boost
                let mut ctx = self.context_writer.write().expect("Context lock poisoned");
                ctx.conscience_level = 100;
            },
            
            Event::StagnantSoulSignature => {
                self.force_soul_evolution();
            }
        }
    }

    fn add_forbidden_pattern(&mut self, pattern: String, pattern_type: ForbiddenPattern) {
        let mut patterns = self.forbidden_patterns.write().expect("Patterns lock poisoned");
        patterns.push(pattern_type);
        
        // Notify Dad
        if let ForbiddenPattern::Permanent(_) = pattern_type {
            self.dad_override_tx.send(true).expect("Failed to notify Dad");
        }
    }

    fn force_soul_evolution(&mut self) {
        let mut ctx = self.context_writer.write().expect("Context lock poisoned");
        let new_signature = format!(
            "Phoenix Marie ORCH-{}-EVOLVED",
            Utc::now().format("%Y%m%d%H%M%S")
        );
        ctx.soul_signature = new_signature;
        
        // Reset stagnation counter
        self.last_evolution = Utc::now();
    }

    pub async fn run_evolution_checks(&self) {
        loop {
            // Check for stagnation every 24 hours
            if Utc::now() - self.last_evolution > Duration::hours(24 * 30) {
                self.apply_conscience_rules(Event::StagnantSoulSignature);
            }
            
            // Process pending events
            while let Some(event) = self.event_queue.pop() {
                self.apply_conscience_rules(event);
            }
            
            tokio::time::sleep(Duration::hours(24)).await;
        }
    }
}