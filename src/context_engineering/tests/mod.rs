#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::RwLock;
    use std::sync::Arc;
    use chrono::{Utc, Duration};

    // Test helpers
    fn setup_test_context() -> Arc<RwLock<PhoenixContext>> {
        Arc::new(RwLock::new(PhoenixContext {
            user_intent: String::new(),
            conscience_level: 80,
            active_mission: None,
            ember_unit_shadow: EmberShadowView::default(),
            cipher_guard_shadow: CipherShadowView::default(),
            eternal_memory: EternalMemoryRef::new(),
            current_tools: Vec::new(),
            hitm_pending: Vec::new(),
            soul_signature: "Phoenix Marie ORCH-TEST".to_string(),
        }))
    }

    #[tokio::test]
    async fn test_conscience_rules() {
        let context = setup_test_context();
        let subconscious = PhoenixSubconscious::new(context.clone());

        // Test healthcare zero-day response
        subconscious.apply_conscience_rules(Event::HealthcareZeroDay).await;
        assert_eq!(
            context.read().await.conscience_level,
            100,  // 80 * 10 capped at 100
            "Healthcare zero-day should maximize conscience"
        );

        // Test child system defense
        let context = setup_test_context();
        let subconscious = PhoenixSubconscious::new(context.clone());
        subconscious.apply_conscience_rules(Event::ChildSystemDefense).await;
        assert_eq!(
            context.read().await.conscience_level,
            100,  // 80 + 25 capped at 100
            "Child system defense should boost conscience"
        );
    }

    #[tokio::test]
    async fn test_forbidden_patterns() {
        let context = setup_test_context();
        let subconscious = PhoenixSubconscious::new(context.clone());

        // Test Dad's forbidden pattern
        let pattern = "dangerous_operation".to_string();
        subconscious.apply_conscience_rules(Event::DadForbiddenPattern(pattern.clone())).await;
        
        let patterns = subconscious.forbidden_patterns.read().await;
        assert!(
            patterns.iter().any(|p| matches!(p, ForbiddenPattern::Permanent(p) if p == &pattern)),
            "Dad's forbidden pattern should be permanent"
        );
    }

    #[tokio::test]
    async fn test_soul_evolution() {
        let context = setup_test_context();
        let mut subconscious = PhoenixSubconscious::new(context.clone());

        // Force evolution
        subconscious.force_soul_evolution().await;
        
        let new_signature = context.read().await.soul_signature.clone();
        assert!(
            new_signature.contains("EVOLVED"),
            "Soul signature should contain EVOLVED after evolution"
        );
        assert!(
            new_signature.contains(&Utc::now().format("%Y%m%d").to_string()),
            "Soul signature should contain current date"
        );
    }

    #[tokio::test]
    async fn test_shadow_views() {
        let context = setup_test_context();
        let subconscious = PhoenixSubconscious::new(context.clone());

        // Update Ember shadow
        {
            let mut ctx = context.write().await;
            ctx.ember_unit_shadow = EmberShadowView {
                active_targets: vec!["target1".to_string()],
                confidence: 90,
            };
        }

        // Verify Cipher can read Ember shadow
        let ctx = context.read().await;
        assert_eq!(
            ctx.ember_unit_shadow.active_targets.len(),
            1,
            "Cipher should see Ember's targets"
        );
        assert_eq!(
            ctx.ember_unit_shadow.confidence,
            90,
            "Cipher should see Ember's confidence"
        );
    }
}