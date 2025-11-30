//! Tests for payment flow

use anyhow::Result;
use phoenix_core::ember_forge::forge_market::{Market, PaymentProvider};
use std::path::PathBuf;
use tokio_test;

#[tokio::test]
async fn test_process_sale() -> Result<()> {
    let temp_dir = std::env::temp_dir().join("market_test");
    std::fs::create_dir_all(&temp_dir)?;

    let market = Market::new(temp_dir).await?;

    let sale_id = market
        .process_sale(
            "agent-123",
            "buyer@example.com",
            PaymentProvider::Stripe,
            99.0,
        )
        .await?;

    assert!(!sale_id.is_empty());

    Ok(())
}

