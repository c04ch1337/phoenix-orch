use tokio::sync::mpsc;
use std::sync::Arc;
use tracing::{info, error};
use candle_core::{Device, Tensor};
use crate::modules::report_squad::{
    types::{Finding, AffectedAsset},
    conscience::ConscienceGate,
};

pub struct AssetAnalyzer {
    finding_rx: mpsc::Receiver<Finding>,
    analyzed_tx: mpsc::Sender<Finding>,
    model: Arc<LoraModel>,
    device: Device,
    conscience: Arc<ConscienceGate>,
    asset_cache: Arc<AssetCache>,
}

struct AssetCache {
    known_assets: tokio::sync::RwLock<std::collections::HashMap<String, AssetInfo>>,
}

#[derive(Clone)]
struct AssetInfo {
    name: String,
    asset_type: String,
    location: String,
    criticality: String,
    dependencies: Vec<String>,
}

impl AssetAnalyzer {
    pub async fn new(
        finding_rx: mpsc::Receiver<Finding>,
        analyzed_tx: mpsc::Sender<Finding>,
        conscience: Arc<ConscienceGate>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let device = Device::cuda_if_available(0)?;
        let model = Arc::new(LoraModel::load("models/asset_analyzer.safetensors", &device)?);
        let asset_cache = Arc::new(AssetCache::new());
        
        Ok(Self {
            finding_rx,
            analyzed_tx,
            model,
            device,
            conscience,
            asset_cache,
        })
    }

    pub async fn run(&mut self) {
        info!("Asset Analyzer Agent started");
        
        while let Some(mut finding) = self.finding_rx.recv().await {
            match self.analyze_assets(&mut finding).await {
                Ok(()) => {
                    // Validate through conscience gate
                    let asset_summary = self.generate_asset_summary(&finding);
                    if let Ok(true) = self.conscience.evaluate_risk(&asset_summary).await {
                        if let Ok(simplified) = self.conscience.check_jargon(&asset_summary).await {
                            finding.description = format!("{}\n\nAsset Analysis:\n{}", finding.description, simplified);
                            if let Err(e) = self.analyzed_tx.send(finding).await {
                                error!("Failed to send analyzed finding: {}", e);
                            }
                        }
                    } else {
                        error!("Asset analysis rejected by conscience gate");
                    }
                }
                Err(e) => error!("Failed to analyze assets: {}", e),
            }
        }
    }

    async fn analyze_assets(&self, finding: &mut Finding) -> Result<(), Box<dyn std::error::Error>> {
        // Extract potential assets from finding
        let potential_assets = self.extract_potential_assets(finding)?;
        
        // Analyze each potential asset
        let mut affected_assets = Vec::new();
        for asset in potential_assets {
            if let Some(analyzed_asset) = self.analyze_single_asset(&asset, finding).await? {
                affected_assets.push(analyzed_asset);
            }
        }
        
        // Update finding with analyzed assets
        finding.affected_assets = affected_assets;
        
        // Update asset cache with new information
        self.update_asset_cache(&finding.affected_assets).await?;
        
        Ok(())
    }

    fn extract_potential_assets(&self, finding: &Finding) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        // Prepare input for asset extraction
        let input_text = format!(
            "{}\n{}\n{}",
            finding.description,
            finding.evidence.iter().map(|e| &e.description).collect::<Vec<_>>().join("\n"),
            finding.attack_path.steps.join("\n")
        );
        
        // Tokenize and encode
        let tokens = self.model.tokenize(&input_text)?;
        let input = Tensor::new(tokens.as_slice(), &self.device)?;
        
        // Run asset extraction model
        let output = self.model.forward(&input)?;
        
        // Parse output into potential asset names
        self.parse_asset_names(&output)
    }

    async fn analyze_single_asset(&self, asset_name: &str, finding: &Finding) -> Result<Option<AffectedAsset>, Box<dyn std::error::Error>> {
        // Check cache first
        if let Some(cached_info) = self.asset_cache.get(asset_name).await {
            return Ok(Some(self.create_affected_asset(cached_info, finding)));
        }
        
        // Prepare input for detailed asset analysis
        let input = self.prepare_asset_analysis_input(asset_name, finding)?;
        
        // Run asset analysis model
        let output = self.model.forward(&input)?;
        
        // Parse output into asset information
        if let Some(asset_info) = self.parse_asset_info(&output)? {
            Ok(Some(self.create_affected_asset(asset_info, finding)))
        } else {
            Ok(None)
        }
    }

    fn create_affected_asset(&self, info: AssetInfo, finding: &Finding) -> AffectedAsset {
        AffectedAsset {
            id: uuid::Uuid::new_v4().to_string(),
            name: info.name,
            asset_type: info.asset_type,
            location: info.location,
            impact: self.determine_impact(&info, finding),
        }
    }

    fn determine_impact(&self, asset_info: &AssetInfo, finding: &Finding) -> String {
        // Calculate impact based on asset criticality and finding severity
        let impact = match (asset_info.criticality.as_str(), finding.severity.as_str()) {
            ("Critical", _) | (_, "Critical") => "Severe business impact with potential for significant financial or reputational damage",
            ("High", "High") => "Major impact on business operations and security posture",
            ("High", _) | (_, "High") => "Significant impact requiring immediate attention",
            ("Medium", _) | (_, "Medium") => "Moderate impact on business operations",
            _ => "Limited impact on business operations",
        };
        
        impact.to_string()
    }

    async fn update_asset_cache(&self, assets: &[AffectedAsset]) -> Result<(), Box<dyn std::error::Error>> {
        let mut cache = self.asset_cache.known_assets.write().await;
        
        for asset in assets {
            cache.insert(
                asset.name.clone(),
                AssetInfo {
                    name: asset.name.clone(),
                    asset_type: asset.asset_type.clone(),
                    location: asset.location.clone(),
                    criticality: "High".to_string(), // Placeholder
                    dependencies: Vec::new(),
                },
            );
        }
        
        Ok(())
    }

    fn generate_asset_summary(&self, finding: &Finding) -> String {
        let mut summary = String::new();
        summary.push_str("Asset Impact Summary:\n");
        
        for asset in &finding.affected_assets {
            summary.push_str(&format!(
                "- {} ({}): {}\n  Location: {}\n  Impact: {}\n",
                asset.name,
                asset.asset_type,
                asset.location,
                asset.impact
            ));
        }
        
        summary
    }
}

impl AssetCache {
    fn new() -> Self {
        Self {
            known_assets: tokio::sync::RwLock::new(std::collections::HashMap::new()),
        }
    }

    async fn get(&self, asset_name: &str) -> Option<AssetInfo> {
        self.known_assets.read()
            .await
            .get(asset_name)
            .cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_asset_analyzer() {
        // Add tests here
    }
}