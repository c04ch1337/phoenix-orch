//! Test modules for Ember Unit functionality

// Include the integration test module
#[cfg(test)]
pub mod integration_test;

// Include the network scanner test module
#[cfg(test)]
pub mod network_scanner_test;

// Mock implementation helpers for tests
pub mod mocks {
    use crate::conscience::{ConscienceEvaluation, PhoenixConscienceIntegration};
    use crate::error::EmberUnitError;
    use std::collections::HashMap;

    /// Mock conscience integration for testing
    pub struct MockConscienceIntegration {
        pub should_approve: bool,
    }

    impl MockConscienceIntegration {
        pub fn new(should_approve: bool) -> Self {
            Self { should_approve }
        }

        pub async fn evaluate_action(
            &self,
            _action: &str,
            _context: &HashMap<String, String>,
        ) -> Result<ConscienceEvaluation, EmberUnitError> {
            Ok(ConscienceEvaluation {
                approved: self.should_approve,
                score: if self.should_approve { 0.8 } else { 0.2 },
                warnings: vec![],
                violations: if self.should_approve { 
                    vec![] 
                } else { 
                    vec!["Test violation".to_string()] 
                },
                reasoning: "Test evaluation".to_string(),
            })
        }
    }
}