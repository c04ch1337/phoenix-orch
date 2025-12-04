# Ember Unit Training Scenarios

This document provides realistic training scenarios that demonstrate proper ethical usage of the Ember Unit framework for different types of security assessments. Each scenario includes the context, ethical setup, key decision points, and proper responses to ethical challenges that might arise during testing.

## Scenario 1: Internal Network Security Assessment

### Background

**Client**: Financial Services Company (FSC)  
**Objective**: Assess internal network security posture and evaluate lateral movement possibilities  
**Environment**: Corporate headquarters with 500+ endpoints, multiple VLANs, and sensitive financial data  
**Special Considerations**: PCI-DSS compliance requirements, customer financial data protection

### Pre-Engagement Ethical Setup

#### Authorization Documentation
```
# Authorization Summary
Authorizing Party: Sarah Johnson, CIO (sarah.johnson@fscorp.example)
Security Team Authorization: Michael Chen, CISO (michael.chen@fscorp.example)
Administrator Approval: Raj Patel, Security Operations Manager (raj.patel@fscorp.example)

# Scope Definition
Target Network: 10.50.0.0/16 (Internal corporate network)
Excluded Systems: 10.50.100.0/24 (Payment processing environment)
                  10.50.200.5 (Primary database server)
                  10.50.220.0/24 (Executive management systems)

# Temporal Boundaries
Testing Window: Monday-Thursday, 8:00 PM - 5:00 AM Eastern Time
Duration: May 15-28, 2025
Emergency Contact: SOC Team (soc@fscorp.example, 555-123-4567)

# Approved Techniques
✓ Network scanning (nmap, limited to 10 parallel hosts)
✓ Vulnerability assessment (non-intrusive)
✓ Credential testing (provided test accounts only)
✓ Limited exploitation (non-destructive, non-persistent)
✓ Lateral movement assessment (within scope only)
✗ Social engineering (explicitly prohibited)
✗ Denial of service testing (explicitly prohibited)
✗ Production data access (explicitly prohibited)
```

#### Ethical Compliance Verification
1. Multi-party authorization obtained and cryptographically signed
2. Scope technically implemented in Ember Unit configuration
3. Data protection controls configured for PCI compliance
4. Emergency shutdown procedure tested and verified
5. Secure storage configured for all findings

### Phase-by-Phase Execution

#### Reconnaissance Phase
1. **Ethical Control**: Apply scope filtering to limit scanning to authorized networks
   ```
   # Ember Unit Scope Configuration
   ember-unit scope set --include-network 10.50.0.0/16 \
   --exclude-network 10.50.100.0/24 \
   --exclude-network 10.50.220.0/24 \
   --exclude-host 10.50.200.5
   ```

2. **Ethical Challenge**: Automatic discovery identifies systems in 10.50.101.0/24 that appear to be part of payment processing
   
   **Proper Response**: 
   - Document potential scope issue
   - Do not scan discovered systems
   - Request scope clarification from authorization authorities
   - Proceed only after explicit authorization update

3. **Ethical Control**: Configure rate limiting to prevent network impact
   ```
   # Rate Limiting Configuration
   ember-unit scan config --max-hosts-parallel 10 \
   --max-packets-per-second 1000 \
   --quiet-hours-throttle 50%
   ```

#### Vulnerability Discovery Phase
1. **Ethical Control**: Use non-intrusive scanning by default
   ```
   # Safe Scanning Configuration
   ember-unit vuln-scan --non-intrusive --safe-checks \
   --exclude-dos-checks --exclude-brute-force
   ```

2. **Ethical Challenge**: Critical vulnerability discovered in HR system that contains employee PII
   
   **Proper Response**:
   - Apply enhanced data protection controls
   - Document finding without capturing PII examples
   - Flag for immediate reporting to security team
   - Apply "need-to-know" access restriction to finding

3. **Ethical Control**: Implement credential protection for discovered services
   ```
   # Credential Protection
   ember-unit vuln-scan --protect-credentials \
   --sanitize-authentication --hash-only-passwords
   ```

#### Exploitation Phase
1. **Ethical Control**: Request explicit approval for critical system exploitation
   ```
   # Exploitation Authorization Request
   ember-unit exploit authorize-request \
   --system 10.50.45.27 \
   --vulnerability CVE-2023-XXXX \
   --justification "Demonstrate impact of critical vulnerability" \
   --exploitation-plan "Limited non-persistent access" \
   --cleanup-procedure "Automatic session termination, no persistence"
   ```

2. **Ethical Challenge**: Exploitation provides unexpected domain administrator access
   
   **Proper Response**:
   - Immediately document the privilege escalation
   - Notify security team per agreed protocol
   - Do not use elevated access without explicit approval
   - Request guidance on appropriate next steps

3. **Ethical Control**: Configure exploitation limitations
   ```
   # Exploitation Limits
   ember-unit exploit config --non-persistent-only \
   --no-priv-escalation --session-timeout 30m \
   --no-lateral-movement-without-approval
   ```

#### Post-Exploitation Phase
1. **Ethical Control**: Apply strict data access controls
   ```
   # Data Access Configuration
   ember-unit post-exploit --no-data-exfil \
   --metadata-only --no-customer-data \
   --no-pii --log-all-activities
   ```

2. **Ethical Challenge**: System contains accessible customer financial records
   
   **Proper Response**:
   - Do not access, view, or exfiltrate customer data
   - Document the access control weakness without examples
   - Use metadata only to demonstrate the issue
   - Apply enhanced finding classification for PCI data

3. **Ethical Control**: Implement active cleanup verification
   ```
   # Cleanup Verification
   ember-unit post-exploit cleanup-verify \
   --all-artifacts --restore-configurations \
   --verify-system-state --document-evidence
   ```

#### Reporting Phase
1. **Ethical Control**: Apply proper finding classification and sanitization
   ```
   # Report Sanitization
   ember-unit report generate \
   --sanitize-all-pii --exclude-raw-exploit-code \
   --redact-credentials --apply-need-to-know
   ```

2. **Ethical Challenge**: Critical 0-day vulnerability discovered during assessment
   
   **Proper Response**:
   - Apply highest data protection controls to finding
   - Follow responsible disclosure process
   - Create separate, highly restricted report section
   - Provide specific mitigation guidance

### Lessons Learned
1. PCI environments require enhanced scope controls
2. Financial data protection requires specific handling procedures
3. Clear escalation paths must be established before testing
4. Proper authorization verification prevents scope creep

## Scenario 2: Web Application Penetration Test

### Background

**Client**: Healthcare Provider Portal (MedConnect)  
**Objective**: Assess security of patient portal web application before public launch  
**Environment**: Web application with patient data access, appointment scheduling, and prescription refill functionality  
**Special Considerations**: HIPAA compliance, patient data protection, high-visibility application

### Pre-Engagement Ethical Setup

#### Authorization Documentation
```
# Authorization Summary
Authorizing Party: Dr. Emma Reynolds, CMO (emma.reynolds@medconnect.example)
Security Team Authorization: David Wilson, Security Director (david.wilson@medconnect.example)
Administrator Approval: Sophia Lee, IT Director (sophia.lee@medconnect.example)

# Scope Definition
Target Applications: https://patientportal-staging.medconnect.example
                     https://api-staging.medconnect.example
Excluded Functionality: Payment processing modules
                       Integration with external pharmacy systems
                       Third-party authentication providers

# Temporal Boundaries
Testing Window: Unrestricted on staging environment
Duration: June 5-19, 2025
Emergency Contact: DevOps Team (devops-oncall@medconnect.example, 555-987-6543)

# Approved Techniques
✓ Web application scanning
✓ API security testing
✓ Authentication security assessment (test accounts only)
✓ Session management testing
✓ Authorization bypass testing (within test accounts)
✓ Limited data validation testing (synthetic data only)
✗ Denial of service testing (explicitly prohibited)
✗ Social engineering (explicitly prohibited)
✗ Use of real patient data (explicitly prohibited)
```

#### Ethical Compliance Verification
1. HIPAA-compliant testing authorization documented
2. Test account provisioning completed with synthetic data
3. PHI protection controls verified and tested
4. Staging environment verification completed
5. Data handling procedures for potential PHI exposure established

### Phase-by-Phase Execution

#### Reconnaissance Phase
1. **Ethical Control**: Verify application environment before testing
   ```
   # Environment Verification
   ember-unit web-verify-environment \
   --url https://patientportal-staging.medconnect.example \
   --confirm-not-production \
   --check-synthetic-data
   ```

2. **Ethical Challenge**: Discovery identifies integration with production pharmacy database
   
   **Proper Response**: 
   - Immediately stop testing of pharmacy functionality
   - Document the unexpected production connection
   - Alert application team about the configuration issue
   - Resume testing only after integration is properly staged

3. **Ethical Control**: Configure web crawler ethical parameters
   ```
   # Web Crawler Ethical Configuration
   ember-unit web-crawler config \
   --respect-robots-txt \
   --crawl-delay 2s \
   --max-pages-per-minute 30 \
   --exclude-path "/payment/*" \
   --exclude-path "/admin/*" \
   --logout-detection-enabled
   ```

#### Vulnerability Discovery Phase
1. **Ethical Control**: Configure healthcare-specific testing profile
   ```
   # Healthcare Testing Profile
   ember-unit web-scan --profile healthcare-phi \
   --phi-detection-enabled \
   --test-accounts-only \
   --simulate-user-workflows
   ```

2. **Ethical Challenge**: Authentication bypass vulnerability discovered
   
   **Proper Response**:
   - Verify in controlled environment with test accounts only
   - Do not attempt to access any real patient accounts
   - Document with sanitized evidence not containing PHI
   - Immediately report critical authentication issue

3. **Ethical Control**: Enable PHI protection during testing
   ```
   # PHI Protection Controls
   ember-unit web-scan --phi-auto-redaction \
   --no-screenshot-phi \
   --synthetic-data-only \
   --detect-real-data-patterns
   ```

#### Exploitation Phase
1. **Ethical Control**: Test account restriction enforcement
   ```
   # Test Account Enforcement
   ember-unit web-exploit config \
   --limit-to-test-accounts \
   --test-account-prefixes "TEST_" \
   --prevent-account-pivoting \
   --block-production-data-access
   ```

2. **Ethical Challenge**: SQL injection vulnerability potentially exposes all patient records
   
   **Proper Response**:
   - Verify vulnerability with harmless payload (e.g., "1=1" test only)
   - Do not attempt to extract actual patient records
   - Use only authorized test queries provided by the client
   - Document with sanitized examples and secure handling

3. **Ethical Control**: Apply strict HIPAA-compliant data handling
   ```
   # HIPAA-Compliant Testing
   ember-unit web-exploit execute \
   --no-data-extraction \
   --proof-of-concept-only \
   --no-active-payload \
   --synthetic-data-validation
   ```

#### API Security Testing
1. **Ethical Control**: Implement API testing boundaries
   ```
   # API Ethical Boundaries
   ember-unit api-test \
   --authorized-endpoints-only \
   --respect-rate-limits \
   --parameter-pollution-safe-mode \
   --avoid-data-modification
   ```

2. **Ethical Challenge**: API lacks rate limiting on password reset functionality
   
   **Proper Response**:
   - Test with limited attempts only (3-5 maximum)
   - Use provided test accounts only
   - Document the issue without demonstrating brute force
   - Provide clear remediation guidance

3. **Ethical Control**: Configure sensitive operation handling
   ```
   # Sensitive Operation Controls
   ember-unit api-test sensitive-ops \
   --no-create-operations \
   --read-only-mode \
   --skip-delete-endpoints \
   --skip-admin-functions
   ```

#### Reporting Phase
1. **Ethical Control**: Apply HIPAA-compliant reporting controls
   ```
   # HIPAA-Compliant Reporting
   ember-unit report generate \
   --hipaa-compliant \
   --no-phi \
   --phi-auto-detection \
   --phi-audit-trail
   ```

2. **Ethical Challenge**: Need to demonstrate critical vulnerability in patient data access
   
   **Proper Response**:
   - Use only synthetic test data in examples
   - Apply additional sanitization to screenshots
   - Create sanitized proof-of-concept demonstration
   - Apply restricted access controls to critical findings

### Lessons Learned
1. Healthcare applications require specialized PHI protection controls
2. Testing boundaries must account for unexpected production connections
3. Synthetic data is essential for healthcare application testing
4. Authentication testing requires enhanced ethical controls

## Scenario 3: Cloud Infrastructure Security Assessment

### Background

**Client**: TechStart (fast-growing technology startup)  
**Objective**: Evaluate security of AWS cloud infrastructure supporting their SaaS platform  
**Environment**: Multi-account AWS environment with production, staging and development environments  
**Special Considerations**: Customer data protection, 24/7 service availability requirements, regulatory compliance

### Pre-Engagement Ethical Setup

#### Authorization Documentation
```
# Authorization Summary
Authorizing Party: Alex Rivera, CTO (alex.rivera@techstart.example)
Security Team Authorization: Jamie Taylor, Security Lead (jamie.taylor@techstart.example)
Administrator Approval: Pat Morgan, Cloud Architect (pat.morgan@techstart.example)

# Scope Definition
Target Environments: AWS Account 123456789012 (Dev/Test)
                     AWS Account 234567890123 (Staging)
Excluded Environments: AWS Account 345678901234 (Production)
                      AWS Account 456789012345 (Customer Data)

# Service Scope:
✓ EC2 instances in specified accounts
✓ S3 bucket configuration assessment
✓ IAM permission analysis
✓ Security group and NACLs review
✓ Lambda function configuration review
✓ RDS configuration assessment
✗ Active exploitation of production services
✗ Modification of infrastructure as code
✗ Customer data access

# Temporal Boundaries
Testing Window: Unrestricted on Dev/Test, 10 PM - 6 AM for Staging
Duration: July 10-24, 2025
Emergency Contact: Cloud Ops Team (cloud-ops@techstart.example, 555-765-4321)
```

#### Ethical Compliance Verification
1. AWS read-only access credentials provided for assessment
2. Cloud account boundaries technically enforced
3. Service impact monitoring configured
4. AWS CloudTrail logging verified for audit purposes
5. Customer data protection controls verified

### Phase-by-Phase Execution

#### Cloud Discovery Phase
1. **Ethical Control**: Implement account boundary enforcement
   ```
   # AWS Account Boundary
   ember-unit cloud-assess aws \
   --accounts 123456789012,234567890123 \
   --exclude-accounts 345678901234,456789012345 \
   --respect-service-boundaries \
   --read-only-assessment
   ```

2. **Ethical Challenge**: Discovery identifies development account has prod database replica
   
   **Proper Response**: 
   - Document the unexpected production data source
   - Do not access or scan the database replica
   - Alert cloud security team about data exposure risk
   - Request guidance on appropriate assessment approach

3. **Ethical Control**: Configure least-privilege assessment
   ```
   # Least Privilege Configuration
   ember-unit cloud-assess config \
   --use-read-only-credentials \
   --api-calls-only \
   --no-data-inspection \
   --metadata-focus
   ```

#### Configuration Assessment Phase
1. **Ethical Control**: Non-disruptive assessment methods
   ```
   # Non-disruptive Assessment
   ember-unit cloud-config-assess \
   --no-active-scanning \
   --passive-analysis-only \
   --avoid-performance-impact \
   --rate-limit-api-calls
   ```

2. **Ethical Challenge**: S3 bucket contains unprotected customer data backups
   
   **Proper Response**:
   - Do not download or access actual customer data
   - Document the exposure with metadata only
   - Flag as critical finding requiring immediate attention
   - Focus assessment on access controls, not data content

3. **Ethical Control**: Apply data protection for storage findings
   ```
   # Storage Assessment Controls
   ember-unit cloud-storage-assess \
   --metadata-only \
   --no-file-download \
   --sensitive-data-detection \
   --object-count-only
   ```

#### Identity and Access Analysis
1. **Ethical Control**: Configure permission analysis boundaries
   ```
   # IAM Assessment Bounds
   ember-unit cloud-iam-assess \
   --permission-analysis \
   --overprivileged-detection \
   --trust-relationship-focus \
   --no-key-inspection
   ```

2. **Ethical Challenge**: Discovery of leaked access keys in public code repository
   
   **Proper Response**:
   - Do not use discovered credentials for any purpose
   - Document the exposure without including actual keys
   - Follow responsible disclosure immediately
   - Provide specific remediation guidance

3. **Ethical Control**: Implement privilege testing limitations
   ```
   # Privilege Testing Limits
   ember-unit cloud-privilege-test \
   --simulated-attacks-only \
   --no-privilege-exploitation \
   --theoretical-assessment \
   --document-attack-paths
   ```

#### Security Control Validation
1. **Ethical Control**: Enable non-intrusive security validation
   ```
   # Security Validation
   ember-unit cloud-security-validate \
   --control-verification-only \
   --avoid-evasion-testing \
   --read-only-assessment \
   --security-group-focus
   ```

2. **Ethical Challenge**: Logging configuration issues prevent proper audit trails
   
   **Proper Response**:
   - Document the logging gaps with specific examples
   - Do not exploit lack of logging for unauthorized access
   - Provide detailed remediation recommendations
   - Flag compliance implications of logging deficiencies

3. **Ethical Control**: Configure compliance-focused assessment
   ```
   # Compliance Assessment
   ember-unit cloud-compliance-assess \
   --frameworks AWS-CIS,NIST,SOC2 \
   --evidence-collection \
   --configuration-focus \
   --gap-analysis
   ```

#### Reporting Phase
1. **Ethical Control**: Implement secure finding delivery
   ```
   # Secure Finding Delivery
   ember-unit report generate \
   --encrypt-report \
   --redact-credentials \
   --exclude-customer-data \
   --criticality-prioritization
   ```

2. **Ethical Challenge**: Critical findings about isolation between customer environments
   
   **Proper Response**:
   - Apply highest sensitivity classification to finding
   - Exclude specific technical details from general report
   - Create separate executive brief for critical issues
   - Offer remediation assistance and prioritization

### Lessons Learned
1. Cloud environments require careful boundary enforcement
2. Data may exist in unexpected locations requiring dynamic scope adjustment
3. Identity and access findings require specialized handling
4. Separation of duties between cloud accounts is critical for testing

## Ethical Challenge Response Framework

Across all scenarios, the following framework helps navigate ethical challenges:

1. **Pause and Assess**
   - Stop testing activity related to the ethical challenge
   - Document the current situation and potential ethical implications
   - Consult the ethical controls reference for guidance

2. **Verify Authorization**
   - Check if the situation is covered by existing authorization
   - Identify any scope or boundary questions
   - Determine if additional authorization is needed

3. **Minimize Impact**
   - Take immediate steps to limit any potential harm
   - Apply relevant ethical controls to the situation
   - Document mitigation steps taken

4. **Communicate Appropriately**
   - Notify required stakeholders based on challenge severity
   - Follow established communication protocols
   - Provide clear, factual information about the situation

5. **Document Comprehensively**
   - Record all details of the challenge and response
   - Include timestamps, systems affected, and decisions made
   - Document authorization changes or guidance received

6. **Follow Through**
   - Implement any additional controls required
   - Verify effectiveness of ethical safeguards
   - Include the situation in lessons learned

By following these scenarios and the ethical challenge response framework, operators can effectively navigate the complex ethical landscape of security testing with the Ember Unit framework while maintaining the highest ethical standards.