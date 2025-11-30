//! Forge CLI — `forge search`, `forge spawn`, `forge publish`, `forge buy`

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{error, info};

use super::forge_auto_forge::ForgeRequest;
use super::forge_market::PaymentProvider;
use super::EmberForge;

/// Forge CLI — command-line interface for the Ember Forge
#[derive(Parser)]
#[command(name = "forge")]
#[command(about = "Phoenix ORCH Ember Forge — The Eternal Economic Heart")]
pub struct ForgeCli {
    #[command(subcommand)]
    pub command: ForgeCommand,
}

/// Forge commands
#[derive(Subcommand)]
pub enum ForgeCommand {
    /// Search for agents
    Search {
        #[arg(short, long)]
        query: String,
    },
    /// Spawn/forge a new agent
    Spawn {
        #[arg(short, long)]
        name: String,
        #[arg(short, long)]
        description: String,
        #[arg(short, long)]
        domain: String,
        #[arg(short, long)]
        purpose: String,
    },
    /// Publish an agent to the forge
    Publish {
        #[arg(short, long)]
        agent_id: String,
    },
    /// Buy an agent
    Buy {
        #[arg(short, long)]
        agent_id: String,
        #[arg(short, long, default_value = "standard")]
        tier: String,
        #[arg(short, long, default_value = "stripe")]
        provider: String,
    },
    /// List top agents (leaderboard)
    Leaderboard {
        #[arg(short, long, default_value = "10")]
        top: usize,
    },
    /// Show Ashen Saints
    Saints,
}

impl ForgeCli {
    /// Execute a forge command
    pub async fn execute(&self, forge: &EmberForge) -> Result<()> {
        match &self.command {
            ForgeCommand::Search { query } => {
                info!("Searching for agents: {}", query);
                let core = forge.core().read().await;
                let manifests = core.list_manifests().await;
                drop(core);

                let results: Vec<_> = manifests
                    .iter()
                    .filter(|m| {
                        m.name.contains(query)
                            || m.description.contains(query)
                            || m.tags.iter().any(|t| t.contains(query))
                    })
                    .collect();

                println!("Found {} agents:", results.len());
                for manifest in results {
                    println!("  - {}: {}", manifest.id, manifest.name);
                }
            }
            ForgeCommand::Spawn {
                name,
                description,
                domain,
                purpose,
            } => {
                info!("Spawning agent: {}", name);
                let auto_forge = forge.auto_forge().write().await;
                let request = ForgeRequest {
                    name: name.clone(),
                    description: description.clone(),
                    domain: domain.clone(),
                    purpose: purpose.clone(),
                    capabilities: vec![],
                    dependencies: vec![],
                };
                let result = auto_forge.forge_agent(request).await?;
                drop(auto_forge);
                println!("✅ Agent forged: {}", result.agent_id);
                println!("   Path: {:?}", result.code_path);
                println!("   Synced to: {:?}", result.synced_backends);
            }
            ForgeCommand::Publish { agent_id } => {
                info!("Publishing agent: {}", agent_id);
                let repo = forge.repository().write().await;
                let agent_path = PathBuf::from("forge/agents").join(agent_id);
                repo.push_to_github(agent_id, &agent_path).await?;
                drop(repo);
                println!("✅ Agent {} published to GitHub", agent_id);
            }
            ForgeCommand::Buy {
                agent_id,
                tier,
                provider,
            } => {
                info!("Buying agent: {} (tier: {}, provider: {})", agent_id, tier, provider);
                let market = forge.market().write().await;
                let pricing = market.get_pricing_tier(tier).ok_or_else(|| {
                    anyhow::anyhow!("Invalid pricing tier: {}", tier)
                })?;

                let payment_provider = match provider.as_str() {
                    "stripe" => PaymentProvider::Stripe,
                    "crypto" => PaymentProvider::Crypto,
                    _ => return Err(anyhow::anyhow!("Invalid payment provider: {}", provider)),
                };

                // In production, this would process actual payment
                let sale_id = market
                    .process_sale(agent_id, "buyer@example.com", payment_provider, pricing.price_usd)
                    .await?;
                drop(market);

                println!("✅ Purchase complete!");
                println!("   Sale ID: {}", sale_id);
                println!("   Price: ${}", pricing.price_usd);
            }
            ForgeCommand::Leaderboard { top } => {
                info!("Showing top {} agents", top);
                let leaderboard = forge.leaderboard().read().await;
                let top_agents = leaderboard.get_top(*top).await;
                drop(leaderboard);

                println!("Top {} Agents:", top);
                for entry in top_agents {
                    let saint_marker = if entry.is_ashen_saint { "🔥 ASHEN SAINT" } else { "" };
                    println!(
                        "  {}. {} (Score: {:.2}) {}",
                        entry.rank, entry.agent_name, entry.score, saint_marker
                    );
                }
            }
            ForgeCommand::Saints => {
                info!("Showing Ashen Saints");
                let leaderboard = forge.leaderboard().read().await;
                let top_100 = leaderboard.get_top_100().await;
                drop(leaderboard);

                let saints: Vec<_> = top_100.into_iter().filter(|e| e.is_ashen_saint).collect();
                println!("Ashen Saints ({}):", saints.len());
                for entry in saints {
                    println!("  - {} (Rank: {})", entry.agent_name, entry.rank);
                }
            }
        }

        Ok(())
    }
}

