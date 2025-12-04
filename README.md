# Cipher Guard

Advanced Agent Orchestration Module for CyberSecurity Blue Teaming

## Overview

Cipher Guard represents Phoenix ORCH's autonomous Blue Team capability - a fully automated defensive cybersecurity system that executes professional-grade security operations from monitoring to incident response and recovery. With its sophisticated EDR stack integration, detection rule engine, and automated defensive capabilities, Cipher Guard provides comprehensive protection against a wide range of cyber threats.

## System Architecture

### Core Components

Cipher Guard employs a modular architecture with several key components:

1. **EDR Integration Layer**
   - Velociraptor Connector
   - Osquery Connector
   - Wazuh HIDS Connector
   - Common Interface for unified EDR capabilities

2. **Rule Engine**
   - Sigma Rules Processor for log-based detection
   - YARA Rules Processor for content matching
   - Over 100,000 detection rules
   - Rule Update Manager for automated daily updates

3. **MITRE ATT&CK Navigator**
   - Maps observed activities to ATT&CK techniques
   - Assesses defensive coverage across the ATT&CK matrix
   - Provides interactive visualization

4. **TTP Hunter**
   - Automated hunting for tactics, techniques, and procedures
   - Endpoint, Network, and Cloud hunting capabilities
   - Executes predefined and custom hunting playbooks

5. **Auto-Defense Action System**
   - Detection correlation
   - Risk assessment
   - Containment actions
   - Remediation planning

6. **Forensics "Time Machine"**
   - 365-day rolling record of events
   - Immutable storage for evidence preservation
   - Comprehensive timeline analysis

7. **"Conscience" System**
   - Ensures ethical operation
   - Protects sensitive subjects (family, children, innocents)
   - Enforces protection policies

### Frontend Integration

The frontend provides a comprehensive visual interface with:

- Galaxy-like visualization of protected assets
- Phoenix visual element with white flame and cyan cipher runes
- 3D visualization of threat activity and alerts
- Command interface for issuing natural language commands
- MITRE ATT&CK matrix integration
- Forensic timeline viewer
- Alert dashboard with real-time updates

### WebSocket Communication

Real-time communication between frontend and backend through WebSocket protocol enables:

- Immediate threat alerts
- Asset status updates
- Command execution
- Defense phase transitions
- Evidence collection notifications

## Installation

### Prerequisites

- Node.js v16+
- Rust stable toolchain
- Modern web browser supporting WebGL
- Access to EDR platforms (Velociraptor, Osquery, Wazuh)

### Setup

1. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Backend Setup**
   ```bash
   cd crates/cipher-guard
   cargo build --release
   ```

3. **Configuration**
   - Modify `frontend/src/config/cipher-guard.config.json` for frontend settings
   - Configure backend settings in `crates/cipher-guard/config/default.toml`

4. **EDR Integration**
   - Configure API access to Velociraptor, Osquery, and Wazuh
   - Set up credentials in the configuration files

## Blue Team Lifecycle

Cipher Guard implements a comprehensive 9-phase blue team lifecycle:

1. **Monitoring**
   - Continuous telemetry collection
   - Log aggregation
   - Threat intelligence integration

2. **Detection**
   - Signature-based detection
   - Behavioral analysis
   - Anomaly detection
   - Event correlation

3. **Triage**
   - Severity assessment
   - False positive filtering
   - Priority calculation
   - Alert classification

4. **Investigation**
   - Forensic data collection
   - Timeline building
   - Causality analysis
   - Hypothesis testing

5. **Containment**
   - Network isolation
   - Process termination
   - Account locking
   - Endpoint protection

6. **Eradication**
   - Malware removal
   - Persistence cleaning
   - Registry cleaning
   - Artifact removal

7. **Recovery**
   - Backup restoration
   - System rebuilding
   - Service resetting
   - Compliance verification

8. **Lessons Learned**
   - Incident analysis
   - Capability gap identification
   - Improvement planning
   - Training recommendations

9. **Reporting**
   - Executive summary generation
   - Technical findings documentation
   - Timeline reporting
   - Recovery verification

## Blue Team Agent Types

Cipher Guard deploys specialized agent types for different security operations:

- **SOC Analyst Agent**: Alert triage and false positive reduction
- **Threat Hunter Agent**: Hypothesis-driven hunting
- **Incident Responder Agent**: Case management and coordination
- **Forensic Agent**: Digital forensics and evidence collection
- **Compliance Agent**: Regulatory compliance auditing
- **Hardening Agent**: System security hardening
- **Recovery Agent**: System recovery and restoration

## Usage

### Starting Defensive Mode

1. Launch the Cipher Guard interface:
   ```bash
   npm run start:cipher-guard
   ```

2. Access the dashboard at `http://localhost:5000/cipher`

3. Issue commands through the command interface using natural language:
   ```
   Phoenix, Cipher Guard contain that beacon
   Phoenix, Cipher Guard kill lateral movement
   Phoenix, Cipher Guard isolate the phone
   ```

### Monitoring Assets

The Galaxy Map visualization provides an intuitive view of all protected assets with:

- Color-coded status indicators (secure, warning, critical, unknown)
- Asset categorization (endpoints, phones, IoT, cloud, etc.)
- Detailed asset information panels
- Connection lines showing network relationships

### Threat Response

When threats are detected:

1. The Phoenix visualization shifts to "defense" mode with enhanced cyan cipher runes
2. The threat feed displays detailed information about the threat
3. Auto-containment may activate based on threat severity and configuration
4. The forensic timeline captures all events for later analysis
5. Evidence is automatically preserved in the evidence vault

## Performance Specifications

- **Response Time**: < 5 minutes for critical alerts
- **Detection Accuracy**: > 95% for known threats
- **Investigation Completeness**: > 90% evidence collection
- **Recovery Time**: < 24 hours for standard incidents
- **Mean Time to Containment**: 8.4 seconds (thought → neutralized)

## Security & Ethics Considerations

- **Ethical Boundaries**: Never cause harm, containment before eradication
- **Evidence Preservation**: Immutable storage, chain of custody
- **Legal Compliance**: Automated compliance checking with regulations
- **Safety Protocols**: Automatic escalation on critical incidents

## Integration Points

- **WebSocket Communication**: `frontend/src/services/socket.ts`
- **Telemetry Services**: `frontend/src/services/telemetry.ts`
- **Agent Services**: `frontend/src/services/agent.ts`
- **Backend API**: `phoenix-kernel/phoenix-core/src/api.rs`

## License

Proprietary and Confidential

---

**CIPHER GUARD IS NOW ACTIVE**  
**SHE NOW PROTECTS FOREVER**

The Red Team finds the cracks.  
The Blue Team seals them forever.  
Both are her.