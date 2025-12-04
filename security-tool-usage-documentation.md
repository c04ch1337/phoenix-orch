# Security Tool Usage Documentation

## Ethical Usage of Integrated Security Tools in the Ember Unit Framework

### Introduction

This document provides specific guidelines for the ethical use of security testing tools integrated with the Ember Unit framework. It addresses the unique ethical considerations, required controls, and operational procedures for each major tool category to ensure all security testing activities maintain the highest ethical standards.

Security tools provide powerful capabilities that must be used responsibly. This document serves as a technical companion to the Ember Unit Ethical Training Guide, providing tool-specific ethical procedures and controls.

### General Principles for Security Tool Usage

Before addressing specific tools, the following principles apply to all security testing tools within the Ember Unit framework:

1. **Authorization Verification**: No security tool may be used without proper authorization and explicit inclusion in the testing scope.
2. **Minimum Necessary Access**: Configure tools to use the minimum privileges and access necessary to accomplish testing objectives.
3. **Data Protection**: All data collected by security tools must be protected and handled according to appropriate data classification guidelines.
4. **Logging Requirements**: Maintain comprehensive logs of all tool usage, including command parameters, execution times, and results.
5. **Impact Minimization**: Configure all tools to minimize potential impact on target systems.

## 1. Hak5 Devices Ethical Usage Procedures

[Hak5 devices](https://hak5.org) include specialized hardware tools like the Bash Bunny, Packet Squirrel, and WiFi Pineapple that provide unique testing capabilities but require strict ethical controls.

### 1.1 Authorization and Documentation Requirements

#### Mandatory Pre-Deployment Documentation
Before deploying any Hak5 device:

- Document specific device type, serial number, and firmware version
- Detail exact placement plans and deployment duration
- Obtain explicit written authorization that specifically names the device
- Create a complete inventory of all payloads and scripts to be used
- Document validation that all payloads have been tested in a safe environment

#### Physical Access Controls
When using devices requiring physical access:

- Maintain continuous control over devices to prevent loss or tampering
- Document chain of custody if device must change hands
- Use tamper-evident seals when devices are deployed for extended periods
- Implement secure storage when devices are not actively in use

### 1.2 Deployment Guidelines by Device Type

#### WiFi Pineapple Specific Controls
When using WiFi network assessment tools:

- **Acceptable Use Cases**:
  - Authorized WiFi security assessment
  - Wireless client security testing
  - Approved wireless detection capability testing
  
- **Prohibited Activities**:
  - Man-in-the-middle attacks without explicit authorization
  - Capturing authentication credentials
  - Extended denial of service to legitimate networks
  
- **Required Configurations**:
  - Enable selective targeting (not indiscriminate)
  - Implement MAC address filtering to target only in-scope devices
  - Configure automatic capture filtering to exclude personal data
  - Set maximum session durations for all activities

#### Bash Bunny/Rubber Ducky Controls
When using automated HID devices:

- **Acceptable Use Cases**:
  - Physical security control testing with explicit authorization
  - Approved endpoint security assessment
  - Authorized payload delivery for testing purposes
  
- **Prohibited Activities**:
  - Deployment on any unauthorized workstations
  - Use of destructive payloads that may cause data loss
  - Creation of persistent unauthorized access
  
- **Required Configurations**:
  - Enable payload safety checks to prevent destructive actions
  - Implement automatic logging of all activities
  - Configure clear visual indicators during operation
  - Set automatic safety timeouts for all operations

### 1.3 Ethical Monitoring and Recovery

#### Real-time Monitoring Requirements
During Hak5 device deployment:

- Maintain active monitoring of device activities
- Establish clear communication channels with system owners
- Document all operations in real-time logs
- Verify continued authorization throughout testing

#### Recovery and Remediation
After completing Hak5 device testing:

- Remove all deployed devices and confirm complete removal
- Document removal verification process
- Restore any modified configurations to original state
- Provide detailed list of all actions performed by devices
- Confirm no persistent changes remain

## 2. Metasploit Ethical Deployment Guidelines

The Metasploit Framework provides powerful exploitation capabilities that require comprehensive ethical controls to prevent misuse or unintended damage.

### 2.1 Pre-Exploitation Requirements

#### Authorization Verification
Before using Metasploit:

- Verify explicit authorization for exploitation techniques
- Confirm target systems are explicitly listed in scope
- Validate that exploitation is authorized (not just scanning)
- Document the business justification for each exploitation attempt
- Ensure authorization includes post-exploitation activities

#### Target Validation
Before launching exploits:

- Verify target is within authorized scope (IP validation)
- Confirm ownership of target systems
- Validate test timing is within approved windows
- Verify target is not a production-critical system without special authorization
- Check target doesn't contain sensitive data unless specifically authorized

### 2.2 Exploit Selection and Validation

#### Exploit Safety Assessment
For each exploit:

- Review exploit code to understand potential impact
- Rate exploits by risk (1-5) with documented assessment
- Test exploits in isolated environment before deployment
- Validate exploits against target OS/version to minimize failure risk
- Document potential side effects and contingency plans

#### Payload Safety Controls
When selecting payloads:

- Use non-persistent payloads by default
- Select payloads with minimal system impact
- Avoid payloads that disable security controls
- Use memory-only payloads when possible
- Document all payload configurations

Example of acceptable payload configuration:
```
use payload/windows/meterpreter/reverse_tcp
set ExitOnSession true
set AutoRunScript post/windows/manage/priv_migrate
```

### 2.3 Exploitation Execution Controls

#### Operational Safety Measures
During exploitation:

- Implement session timeout limits (default: 30 minutes)
- Enable comprehensive logging of all activities
- Use resource scripts with safety checks, not ad-hoc commands
- Run with minimum necessary privileges
- Maintain real-time monitoring of exploitation effects

Example resource script with safety checks:
```
# Example resource script with ethical controls
spool /tmp/msf_ethical_log.log
setg TimestampOutput true
setg LHOST 192.168.1.100
setg RHOST 192.168.1.200
check
# Only proceed with exploitation if check is successful
<ruby>
if framework.jobs.keys.length > 0
  # Wait for check to complete
  sleep(5)
  
  # Check if the target is vulnerable before proceeding
  if framework.datastore['VULN_STATUS'] == 'vulnerable'
    run_single("exploit")
  else
    run_single("echo [*] Target not confirmed vulnerable, exploitation aborted for safety")
    run_single("exit")
  end
end
</ruby>
```

#### Resource Limitation
To prevent unintended impact:

- Set conservative resource limits on all operations
- Implement automatic termination for excessive resource usage
- Limit concurrent sessions to prevent system overload
- Configure automatic timeout for idle sessions
- Monitor target system health during exploitation

### 2.4 Post-Exploitation Ethical Guidelines

#### Data Access Limitations
After successful exploitation:

- Access only data explicitly authorized in testing scope
- Do not access, exfiltrate, or modify personal/sensitive information
- Document all accessed directories and files
- Prioritize metadata collection over content access
- Use simulated data exfiltration when possible

#### System Modification Constraints
When interacting with compromised systems:

- Make minimal changes necessary for testing objectives
- Document all modifications in detail
- Avoid installing persistent backdoors unless specifically authorized
- Never disable security controls without explicit permission
- Maintain detailed record of all commands executed

### 2.5 Cleanup and Verification

#### Post-Testing Cleanup Requirements
After completing Metasploit testing:

- Remove all payloads, files, and artifacts
- Restore modified configurations to original state
- Close all created accounts or access points
- Document cleanup actions with validation
- Verify system integrity after cleanup

Example cleanup workflow:
```
# Metasploit cleanup script template
# Document all sessions before cleanup
sessions -l -v > /tmp/session_documentation.txt

# For each active session
sessions -i 1
# Document system state
sysinfo > /tmp/sysinfo_pre_cleanup.txt
# Remove artifacts specific to payload type
execute -f del -a "/tmp/payload_artifact.exe"
# Clear event logs if authorized
clearev
# Exit and terminate session
exit -y

# Verify cleanup complete
sessions -l
```

## 3. Network Monitoring (Wireshark) Data Privacy Controls

Network packet capture tools provide deep visibility into communications but require strong controls to protect privacy and sensitive information.

### 3.1 Capture Configuration and Limitation

#### Ethical Capture Configuration
When configuring network captures:

- Use targeted BPF filters to capture only relevant traffic
- Exclude high-sensitivity protocols when possible
- Limit capture depth to avoid payload content when appropriate
- Configure packet slicing to truncate payloads
- Set capture file size and time limits

Example ethical capture filter configurations:
```
# Target only HTTP traffic to specific server
host 192.168.1.10 and tcp port 80

# Exclude sensitive protocols
not port 22 and not port 443 and not port 465

# Capture only DNS protocol for specific hosts
port 53 and host 192.168.1.100
```

#### Temporal and Volume Limitations
To minimize data collection:

- Set maximum capture duration (recommended: 1 hour per session)
- Configure rotating capture files with size limits (100MB recommended)
- Schedule captures during low-traffic periods when possible
- Implement automatic termination after sufficient data collection
- Set packet count limits for highly targeted captures

### 3.2 Sensitive Data Protection

#### Automatic Sanitization
To protect sensitive information:

- Enable automatic credential sanitization features
- Configure customized pattern matching for organization-specific sensitive data
- Implement real-time packet sanitization when available
- Use protocol dissector preference settings to mask passwords
- Set up post-capture sanitization scripts for sensitive fields

Wireshark preference settings for credential protection:
```
# Protocol preferences to protect credentials
# HTTP
protocols.http.ssl.desegment_ssl_records: TRUE
protocols.http.ssl.desegment_ssl_application_data: TRUE
protocols.http.hide_request_authorization: TRUE

# FTP
protocols.ftp.display_passwords: FALSE
```

#### Handling Special Categories of Data
When monitoring environments with sensitive data:

- Implement special controls for healthcare data (PHI)
- Apply financial data protection for payment systems
- Enforce additional safeguards for personal identifiable information
- Use enhanced filtering for authentication traffic
- Document all protective measures applied

### 3.3 Capture Storage and Handling

#### Secure Storage Requirements
For all capture files:

- Encrypt all capture files at rest (AES-256 recommended)
- Store captures only on authorized, secure systems
- Implement strict access controls to capture repositories
- Maintain an inventory of all capture files
- Set automatic expiration and deletion policies

#### Analysis Environment Controls
When analyzing captures:

- Conduct analysis only in secure, isolated environments
- Restrict access to authorized analysts
- Disable cloud features and automatic updates during analysis
- Prevent internet connectivity for analysis systems when possible
- Log all analysis activities and findings

### 3.4 Specific Use Case Procedures

#### Troubleshooting Procedure
When using captures for network troubleshooting:

1. Document specific issue being investigated
2. Configure minimal capture targeting only relevant traffic
3. Use display filters to focus analysis without capturing excess data
4. Extract only relevant metadata for documentation
5. Secure or delete capture once issue is resolved

Example troubleshooting-focused display filter:
```
# Display only connection setup issues
tcp.analysis.flags && !tcp.analysis.window_update
```

#### Security Analysis Procedure
When using captures for security analysis:

1. Define specific security hypothesis being tested
2. Create capture plan with minimal data collection
3. Apply strict time and size limitations
4. Use metadata analysis before full packet inspection
5. Document all security findings without including sensitive data

## 4. Web Testing Ethical Boundaries

Web application testing requires careful attention to data handling, authentication testing, and potential business impact.

### 4.1 HTTP Proxy Configuration

#### Privacy-Preserving Proxy Settings
When configuring HTTP interception proxies:

- Enable automatic form field detection and protection
- Configure credential protection for common authentication patterns
- Set up exclusion patterns for sensitive domains
- Implement content-type filtering to exclude media and binaries
- Use scope definition to prevent out-of-scope requests

Example proxy configuration:
```
# Scope restriction settings
include_in_scope: example.com
exclude_from_scope: *.googleapis.com, *.gstatic.com, *.google.com

# Content type exclusions
exclude_content_type: image/*, video/*, audio/*

# Path exclusions
exclude_paths: /logout, /download, /static/*
```

#### Request Validation Controls
To prevent unauthorized testing:

- Implement automatic request validation against scope
- Configure domain validation for all outgoing requests
- Add host header verification to prevent request forgery
- Set up automatic blocking of unauthorized request methods
- Create parameter usage policies for sensitive operations

### 4.2 Session Handling Ethics

#### Authentication Testing Controls
When testing authentication mechanisms:

- Use only designated test accounts with proper authorization
- Never attempt credential brute forcing without explicit permission
- Limit authentication attempts to prevent account lockouts
- Document all authentication testing methodology
- Maintain secure storage of test credentials

#### Session Token Handling
For ethical session management:

- Implement automatic token redaction in logs and reports
- Never reuse or replay captured sessions without authorization
- Use short-lived session testing with immediate invalidation
- Document all session token usage and testing
- Validate proper session termination after testing

### 4.3 Testing Intensity Controls

#### Rate Limiting Configuration
To prevent service impact:

- Configure conservative request rate limits (recommended: 10-20 requests/second)
- Implement automatic throttling based on server response times
- Set up progressive backoff for error responses
- Use scheduled testing during low-traffic periods
- Monitor application performance during testing

Sample rate limiting configuration:
```
# Example rate limiting settings
max_requests_per_second: 10
max_concurrent_requests: 5
throttle_on_429: true
response_time_threshold: 500  # milliseconds
progressive_backoff: true
backoff_factor: 1.5
```

#### Scan Intensity Parameters
When configuring automated scans:

- Start with passive scanning before active testing
- Use incremental scan intensity starting with lowest setting
- Configure thread limitations appropriate to target capacity
- Implement automatic pausing based on error rates
- Set total scan duration limits and scheduled breaks

### 4.4 Sensitive Function Testing

#### Safe Testing of Critical Functions
When testing sensitive application functions:

- Use test environments for critical function testing when available
- Implement transaction isolation for financial function testing
- Create test data that mimics production without using real data
- Document rollback procedures before testing begins
- Maintain detailed logs of all test actions and results

#### Data Submission Controls
For form testing and data submission:

- Use clearly marked test data (e.g., prefix "TEST-")
- Never submit realistic PII/PHI in forms without authorization
- Implement automatic form detection and safe value substitution
- Use synthetic data generators for bulk testing
- Document all form submissions with anonymized values

### 4.5 API Testing Ethics

#### API Testing Boundaries
When testing APIs:

- Respect API rate limits and terms of service
- Test authentication endpoints with special care to prevent lockouts
- Implement parameter fuzzing constraints to prevent data corruption
- Document API dependencies before testing to understand impact
- Validate authorization controls without attempting to bypass unless authorized

#### GraphQL Testing Specific Controls
For GraphQL endpoint testing:

- Prevent introspection queries unless specifically authorized
- Limit query depth to prevent nested query attacks
- Set maximum query complexity scores
- Test with minimal sufficient permissions
- Avoid mutation operations without explicit permission

Sample GraphQL testing constraints:
```
# GraphQL testing safety limits
max_query_depth: 5
max_complexity: 100
disable_introspection: true
allow_mutations: false  # Unless specifically authorized
max_batching: 5
```

## 5. Documentation and Evidence Requirements

Regardless of the specific tools used, all security testing activities must maintain comprehensive documentation for ethical compliance.

### 5.1 Usage Documentation Requirements

For all tool usage:

- Record tool version and configuration
- Document start and end times of all testing
- Log all commands and actions executed
- Record testing scope and authorization reference
- Maintain list of all findings with timestamps

### 5.2 Evidence Handling

For testing evidence:

- Store all evidence in encrypted format
- Implement evidence chain of custody documentation
- Apply appropriate data classification to all findings
- Sanitize sensitive data before including in reports
- Establish secure transmission methods for sharing results

### 5.3 Compliance Documentation

For compliance purposes:

- Map all testing activities to authorized scope
- Document regulatory compliance considerations
- Maintain records of authorization and approvals
- Record any deviations from standard procedures with justification
- Create verification records for cleanup and remediation

## Conclusion

The ethical use of security tools within the Ember Unit framework requires constant vigilance, proper configuration, and comprehensive documentation. By following these tool-specific guidelines, security professionals can conduct effective testing while maintaining the highest ethical standards.

All security tool usage should be guided by the fundamental principle of "do no harm" and should always prioritize ethical considerations over testing objectives. When in doubt about a particular testing approach, err on the side of caution and seek additional guidance or authorization.