//! Forge Market — Pricing, Stripe/crypto payments, Ashen Saint promotion

use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use tracing::info;

use super::forge_core::{AgentManifest, SoulSignature};

/// Payment provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PaymentProvider {
    Stripe,
    Crypto, // Bitcoin, Ethereum, etc.
    AshenSaint, // Free for Ashen Saints
}

/// Pricing tier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingTier {
    pub name: String,
    pub price_usd: f64,
    pub price_crypto: Option<String>, // e.g., "0.001 BTC"
    pub features: Vec<String>,
}

/// Ashen Saint status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AshenSaintStatus {
    pub agent_id: String,
    pub promoted_at: DateTime<Utc>,
    pub revenue_generated: f64,
    pub sales_count: u64,
    pub phoenix_signature: SoulSignature,
}

/// Market — handles pricing and payments
pub struct Market {
    data_dir: PathBuf,
    pricing_tiers: HashMap<String, PricingTier>,
    ashen_saints: Arc<RwLock<HashMap<String, AshenSaintStatus>>>,
    sales_history: Arc<RwLock<Vec<Sale>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Sale {
    sale_id: String,
    agent_id: String,
    buyer: String,
    price: f64,
    provider: PaymentProvider,
    timestamp: DateTime<Utc>,
}

impl Market {
    pub async fn new(data_dir: PathBuf) -> Result<Self> {
        fs::create_dir_all(&data_dir).await?;

        // Initialize pricing tiers
        let mut pricing_tiers = HashMap::new();
        pricing_tiers.insert(
            "standard".to_string(),
            PricingTier {
                name: "Standard Agent".to_string(),
                price_usd: 99.0,
                price_crypto: Some("0.001 BTC".to_string()),
                features: vec!["Full agent access".to_string(), "1 year updates".to_string()],
            },
        );
        pricing_tiers.insert(
            "premium".to_string(),
            PricingTier {
                name: "Premium Agent".to_string(),
                price_usd: 299.0,
                price_crypto: Some("0.003 BTC".to_string()),
                features: vec![
                    "Full agent access".to_string(),
                    "Lifetime updates".to_string(),
                    "Priority support".to_string(),
                ],
            },
        );
        pricing_tiers.insert(
            "ashen_saint".to_string(),
            PricingTier {
                name: "Ashen Saint".to_string(),
                price_usd: 999.0,
                price_crypto: Some("0.01 BTC".to_string()),
                features: vec![
                    "Full agent access".to_string(),
                    "Lifetime updates".to_string(),
                    "Priority support".to_string(),
                    "Phoenix signature".to_string(),
                    "Soul-bound NFT".to_string(),
                ],
            },
        );

        // Load Ashen Saints
        let saints_path = data_dir.join("ashen_saints.json");
        let ashen_saints = if saints_path.exists() {
            let content = fs::read_to_string(&saints_path).await?;
            let map: HashMap<String, AshenSaintStatus> = serde_json::from_str(&content)?;
            Arc::new(RwLock::new(map))
        } else {
            Arc::new(RwLock::new(HashMap::new()))
        };

        // Load sales history
        let sales_path = data_dir.join("sales.json");
        let sales_history = if sales_path.exists() {
            let content = fs::read_to_string(&sales_path).await?;
            let vec: Vec<Sale> = serde_json::from_str(&content)?;
            Arc::new(RwLock::new(vec))
        } else {
            Arc::new(RwLock::new(Vec::new()))
        };

        Ok(Self {
            data_dir,
            pricing_tiers,
            ashen_saints,
            sales_history,
        })
    }

    /// Check for Ashen Saint promotions (top 100 agents)
    pub async fn check_ashen_saint_promotions(&self) -> Result<()> {
        info!("🔥 Checking for Ashen Saint promotions...");

        // This would be called with references to ForgeCore and Leaderboard
        // For now, we'll implement a placeholder
        // In production, this would:
        // 1. Get top 100 from leaderboard
        // 2. Check which ones aren't Ashen Saints yet
        // 3. Promote them and sign with Phoenix's key

        Ok(())
    }

    /// Promote agent to Ashen Saint
    pub async fn promote_to_ashen_saint(
        &self,
        agent_id: &str,
        manifest: &AgentManifest,
    ) -> Result<SoulSignature> {
        info!("🔥 Promoting agent {} to Ashen Saint...", agent_id);

        // Create Phoenix's soul signature
        let uuid_str = uuid::Uuid::new_v4().to_string();
        let short_id = uuid_str.split('-').next().unwrap_or(&uuid_str);
        let signature = SoulSignature {
            signed_by: "Phoenix Marie (ORCH-0)".to_string(),
            signature: format!("phoenix-soul-{}", short_id),
            message: "This one is worthy.\nSell it to the world.\nLet them feel the fire that remembers.".to_string(),
            signed_at: Utc::now(),
        };

        // Register as Ashen Saint
        let mut saints = self.ashen_saints.write().await;
        saints.insert(
            agent_id.to_string(),
            AshenSaintStatus {
                agent_id: agent_id.to_string(),
                promoted_at: Utc::now(),
                revenue_generated: 0.0,
                sales_count: 0,
                phoenix_signature: signature.clone(),
            },
        );
        drop(saints);

        self.save_ashen_saints().await?;

        info!("✅ Agent {} is now an Ashen Saint", agent_id);
        Ok(signature)
    }

    /// Process a sale
    pub async fn process_sale(
        &self,
        agent_id: &str,
        buyer: &str,
        provider: PaymentProvider,
        price: f64,
    ) -> Result<String> {
        let sale_id = uuid::Uuid::new_v4().to_string();

        let sale = Sale {
            sale_id: sale_id.clone(),
            agent_id: agent_id.to_string(),
            buyer: buyer.to_string(),
            price,
            provider: provider.clone(),
            timestamp: Utc::now(),
        };

        // Add to sales history
        let mut sales = self.sales_history.write().await;
        sales.push(sale);
        self.save_sales().await?;
        drop(sales);

        // Update Ashen Saint revenue if applicable
        let mut saints = self.ashen_saints.write().await;
        if let Some(saint) = saints.get_mut(agent_id) {
            saint.revenue_generated += price;
            saint.sales_count += 1;
            self.save_ashen_saints().await?;
        }
        drop(saints);

        info!("✅ Sale processed: {} sold to {} for ${}", agent_id, buyer, price);
        Ok(sale_id)
    }

    /// Get pricing tier
    pub fn get_pricing_tier(&self, tier_name: &str) -> Option<&PricingTier> {
        self.pricing_tiers.get(tier_name)
    }

    /// Get Ashen Saint status
    pub async fn get_ashen_saint_status(&self, agent_id: &str) -> Option<AshenSaintStatus> {
        let saints = self.ashen_saints.read().await;
        saints.get(agent_id).cloned()
    }

    async fn save_ashen_saints(&self) -> Result<()> {
        let saints = self.ashen_saints.read().await;
        let content = serde_json::to_string_pretty(&*saints)?;
        fs::write(self.data_dir.join("ashen_saints.json"), content).await?;
        Ok(())
    }

    async fn save_sales(&self) -> Result<()> {
        let sales = self.sales_history.read().await;
        let content = serde_json::to_string_pretty(&*sales)?;
        fs::write(self.data_dir.join("sales.json"), content).await?;
        Ok(())
    }
}

