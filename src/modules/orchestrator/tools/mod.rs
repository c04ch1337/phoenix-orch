//! Tools Module
//!
//! This module contains tool implementations for the OrchestratorAgent.

pub mod av_capture;
pub mod chat;
pub mod filesystem;
pub mod home_orchestrator;
pub mod neural_emotion;
pub mod hardware_master;
pub mod mobile_master;
pub mod hak5_master;
pub mod wireshark_orchestrator;
pub mod burp_orchestrator;

pub use av_capture::AVCaptureTool;
pub use chat::ChatTool;
pub use filesystem::FilesystemTool;
pub use home_orchestrator::HomeOrchestratorTool;
pub use neural_emotion::NeuralEmotionTool;
pub use hardware_master::{process_hardware_command, hardware_status};
pub use mobile_master::{process_mobile_command, mobile_status, set_cybersecurity_mode};
pub use hak5_master::{process_hak5_command, hak5_status, get_network_map};
pub use wireshark_orchestrator::{process_wireshark_command, wireshark_status};
pub use burp_orchestrator::{process_burp_command, burp_status};
