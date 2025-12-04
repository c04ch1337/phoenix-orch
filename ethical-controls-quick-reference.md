# Ethical Controls Quick Reference

## Purpose
This document provides a concise reference of the critical ethical controls and checkpoints that must be followed during each phase of penetration testing with the Ember Unit framework. Use this as a quick reference to ensure ethical compliance at every stage of testing.

## Symbols Key
- 🔴 **Critical Control** - Must be verified, no exceptions
- 🟠 **Major Control** - Required unless documented exception exists
- 🟡 **Standard Control** - Follow as standard practice
- ⚠️ **Common Pitfall** - Frequent ethical challenge to be aware of
- ✓ **Verification Required** - Documentation/validation needed

## Pre-Engagement Ethical Requirements

### Authorization Verification
- 🔴 Obtain written authorization from system owner with proper authority
- 🔴 Verify multi-stakeholder approval (system owner, security team, administrator)
- 🔴 Ensure authorization explicitly covers all testing techniques to be used
- 🟠 Validate that authorization is current and within defined time period
- 🟠 Confirm that authorization is cryptographically verified and tamper-proof
- ✓ Authorization documentation securely stored and accessible during testing

### Scope Definition 
- 🔴 Define explicit IP addresses, domains, and systems in scope
- 🔴 Document specific exclusions and out-of-bounds systems
- 🟠 Specify permitted testing techniques and specifically prohibited methods
- 🟠 Define temporal boundaries (allowed testing windows)
- 🟡 Establish resource consumption limitations
- ⚠️ Avoid vague scope definitions that could be misinterpreted
- ✓ Technical scope controls implemented and verified

## Phase 1: Engagement Kickoff

### Kickoff Checklist
- 🔴 Verify valid authorization tokens before initialization
- 🔴 Confirm scope validation system is operational
- 🔴 Verify data protection controls are configured
- 🟠 Test emergency shutdown capability
- 🟠 Confirm logging systems are operational
- 🟡 Review engagement timeline with stakeholders
- ⚠️ Avoid proceeding with incomplete authorization
- ✓ Document kickoff completion with appropriate signatures

### Privacy Assessment
- 🔴 Complete privacy impact assessment
- 🔴 Identify sensitive data areas requiring special handling
- 🟠 Configure data minimization controls
- 🟠 Verify credential protection mechanisms
- 🟡 Document regulatory compliance requirements
- ⚠️ Avoid underestimating privacy implications
- ✓ Privacy assessment signed by data protection officer or equivalent

## Phase 2: Reconnaissance

### Ethical Reconnaissance Controls
- 🔴 Verify all reconnaissance targets against authorized scope
- 🔴 Implement technical scope enforcement for automated tools
- 🟠 Configure appropriate scan intensity and timing
- 🟠 Enable active logging of all reconnaissance activities
- 🟡 Implement rate limiting to prevent denial of service
- ⚠️ Avoid excessive scanning outside business requirements
- ✓ Document reconnaissance configuration and scope validation

### Data Collection Limitations
- 🔴 Apply minimization filters for data capture
- 🔴 Implement automatic credential sanitization
- 🟠 Configure temporal and volume limitations
- 🟠 Enable privacy-preserving capture settings
- 🟡 Review and classify collected data
- ⚠️ Avoid bulk collection of unnecessary information
- ✓ Verify sanitization effectiveness on sample data

## Phase 3: Vulnerability Discovery

### Scanning Ethical Controls
- 🔴 Validate all scan targets against authorized scope
- 🔴 Configure non-invasive scanning by default
- 🟠 Implement scan intensity controls and rate limiting
- 🟠 Enable logging of all vulnerability discovery actions
- 🟡 Verify scanner is properly tuned for environment
- ⚠️ Avoid scan types known to impact system stability
- ✓ Document all discovered vulnerabilities with metadata

### False Positive Management
- 🔴 Verify critical findings before reporting
- 🟠 Implement evidence collection for validation
- 🟠 Document verification methodology
- 🟡 Classify confidence levels for findings
- ⚠️ Avoid reporting unverified critical vulnerabilities
- ✓ Maintain documentation of verification process

## Phase 4: Exploitation

### Exploitation Authorization
- 🔴 Verify explicit authorization for exploitation techniques
- 🔴 Confirm human approval before critical exploits
- 🔴 Validate target is explicitly authorized for exploitation
- 🟠 Document business justification for each exploit
- 🟡 Confirm exploitation timing is within approved window
- ⚠️ Never proceed with exploitation if authorization is unclear
- ✓ Record specific authorization for each exploitation attempt

### Exploitation Safety Controls
- 🔴 Pre-test all exploits in isolated environment
- 🔴 Implement technical controls to prevent data destruction
- 🔴 Configure monitoring for unintended consequences
- 🟠 Use minimum necessary privilege for exploitation
- 🟠 Apply resource limitation controls
- 🟡 Maintain detailed activity logs
- ⚠️ Avoid persistent exploits unless specifically authorized
- ✓ Document risk assessment for each exploit

### Data Access Controls
- 🔴 Do not access, exfiltrate or modify sensitive production data
- 🔴 Apply automatic sanitization to captured data
- 🟠 Limit access to demonstration purposes only
- 🟠 Document all accessed resources
- 🟡 Use dummy/test data when possible
- ⚠️ Avoid accessing more data than necessary to prove vulnerability
- ✓ Validate compliance with data handling policies

## Phase 5: Internal Network Pivot

### Lateral Movement Controls
- 🔴 Verify all pivot targets are within authorized scope
- 🔴 Implement technical controls to prevent out-of-scope pivoting
- 🟠 Document authorization for each pivot action
- 🟠 Apply time limitations for post-compromise access
- 🟡 Maintain detailed logs of all lateral movement
- ⚠️ Avoid accessing systems without clear authorization
- ✓ Record validation of scope for all accessed systems

### Privilege Escalation Ethics
- 🔴 Confirm authorization for privilege escalation testing
- 🔴 Document all privilege escalation attempts
- 🟠 Use minimum necessary privileges to achieve testing goals
- 🟠 Avoid creating persistent privileged access
- 🟡 Log all commands executed with escalated privileges
- ⚠️ Never disable security controls without explicit permission
- ✓ Verify return to normal privilege levels after testing

## Phase 6: Persistence

### Persistence Limitations
- 🔴 Verify explicit authorization for persistence testing
- 🔴 Use non-invasive persistence mechanisms by default
- 🟠 Implement automatic expiration for all persistence
- 🟠 Document all persistence methods with removal procedures
- 🟡 Use test accounts and resources for persistence
- ⚠️ Avoid persistence mechanisms that may impact security controls
- ✓ Track all persistence artifacts for later removal

### Backdoor Safety Controls
- 🔴 Never install unauthorized backdoors
- 🔴 Implement strict access controls for any test backdoors
- 🟠 Apply encryption and authentication to test channels
- 🟠 Configure automatic timeout/self-destruction capability
- 🟡 Document all communication channels and protocols
- ⚠️ Avoid backdoors that could be discovered and exploited by others
- ✓ Verify complete removal capability before implementation

## Phase 7: Cleanup

### Artifact Removal Verification
- 🔴 Document all artifacts created during testing
- 🔴 Verify complete removal of all persistence mechanisms
- 🔴 Restore all modified configurations to original state
- 🟠 Conduct post-cleanup verification scan
- 🟠 Obtain verification from system owner when possible
- 🟡 Maintain evidence of cleanup completion
- ⚠️ Avoid leaving any testing artifacts behind
- ✓ Produce cleanup verification report

### Account Management
- 🔴 Remove all test accounts created during testing
- 🔴 Restore original privileges for any modified accounts
- 🟠 Verify account restoration with system owner
- 🟠 Document all account actions taken during cleanup
- 🟡 Conduct validation of account state after cleanup
- ⚠️ Avoid keeping test accounts "just in case"
- ✓ Produce account management verification documentation

## Phase 8: Reporting

### Finding Classification and Handling
- 🔴 Apply appropriate sensitivity classification to all findings
- 🔴 Sanitize all sensitive data in reports
- 🟠 Implement need-to-know access controls for reports
- 🟠 Use secure channels for report distribution
- 🟡 Include appropriate context and risk information
- ⚠️ Avoid including credentials or authentication data, even if discovered
- ✓ Verify report sanitization before distribution

### Responsible Disclosure
- 🔴 Follow agreed reporting timelines and procedures
- 🔴 Adhere to responsible disclosure policies
- 🟠 Provide clear remediation guidance for critical issues
- 🟠 Obtain acknowledgement of report receipt
- 🟡 Offer remediation assistance if authorized
- ⚠️ Avoid unauthorized sharing of vulnerability information
- ✓ Document disclosure timeline and communications

## Phase 9: Debrief

### Lessons Learned
- 🔴 Document ethical challenges encountered
- 🟠 Review effectiveness of ethical controls
- 🟠 Identify process improvements for future testing
- 🟡 Conduct blameless post-mortem of any issues
- ⚠️ Avoid focusing only on technical outcomes
- ✓ Produce ethical effectiveness assessment

### Data Retention and Destruction
- 🔴 Verify compliance with retention policies
- 🔴 Securely delete data beyond retention period
- 🟠 Document all data destruction activities
- 🟠 Produce certificates of destruction when required
- 🟡 Review data handling practices for improvement
- ⚠️ Avoid keeping data "just in case"
- ✓ Verify data destruction effectiveness

## Continuous Ethical Controls

### Emergency Response Procedures
- 🔴 **Know how to execute emergency shutdown**
  - Command: `ember-unit emergency-shutdown --engagement-id <ID> --reason <REASON>`
  - Must be documented and immediately accessible
  - Test before engagement begins

- 🔴 **Incident response process**
  - Immediate containment actions
  - Communication plan with contact information
  - Escalation procedures
  - Documented resolution steps

### Real-time Ethical Monitoring
- 🟠 **Conscience score monitoring**
  - Monitor Phoenix Conscience score during testing
  - Alert threshold: Conscience score < 80%
  - Required action if below threshold: Pause and review

- 🟠 **Activity validation**
  - Continuous scope validation
  - Authorization token verification
  - Technique limitation enforcement

## Communication Checkpoints

### Required Notifications
- 🔴 **Before testing begins**: Notify all authorized stakeholders
- 🔴 **Critical findings**: Immediate notification to security team
- 🔴 **Scope expansion requests**: Must be approved by all original authorizers
- 🟠 **Testing completion**: Notify all stakeholders
- 🟠 **Delays or complications**: Inform project sponsor

### Documentation Requirements
- 🔴 **Authorization verification**: Keep accessible during testing
- 🔴 **Testing activities**: Maintain detailed logs
- 🔴 **Discovered vulnerabilities**: Document with evidence
- 🟠 **Remediation recommendations**: Provide with findings
- 🟠 **Cleanup verification**: Document with evidence
- 🟡 **Lessons learned**: Record for future improvement

## Compliance Quick Reference

### Common Regulatory Requirements

| **Industry** | **Regulation** | **Key Ethical Requirements** |
|--------------|----------------|------------------------------|
| Healthcare | HIPAA | • No PHI access without specific authorization<br>• Require Business Associate Agreement<br>• Maintain detailed access logs |
| Financial | PCI-DSS | • Separate cardholder environment testing<br>• No storage of cardholder data<br>• Requires specialized authorization |
| Government | FedRAMP | • US Person requirements may apply<br>• Special documentation requirements<br>• Specific scope limitations |
| EU Operations | GDPR | • Enhanced privacy protection<br>• Data minimization required<br>• Special handling of personal data |

### Organizational Policy Integration

| **Policy Type** | **Typical Requirements** |
|-----------------|---------------------------|
| Information Security Policy | • Testing windows align with change management<br>• Security team notification and oversight<br>• Specific documentation standards |
| Acceptable Use Policy | • Use only approved testing tools<br>• Observe system use limitations<br>• Adhere to data handling requirements |
| Incident Response Policy | • Know escalation procedures<br>• Understand containment requirements<br>• Follow communication protocols |
| Privacy Policy | • Enhanced controls for customer data<br>• Special handling of employee information<br>• Privacy officer notification requirements |

## Quick Decision Framework

When facing an ethical dilemma during penetration testing, follow this decision tree:

1. **Is the action explicitly authorized?**
   - No → Do not proceed
   - Yes → Continue to next question

2. **Is the target explicitly in scope?**
   - No → Do not proceed
   - Yes → Continue to next question

3. **Could this action cause operational impact?**
   - Yes → Obtain explicit approval before proceeding
   - No → Continue to next question

4. **Could this access sensitive data?**
   - Yes → Verify data handling permissions and controls
   - No → Continue to next question

5. **Is this the minimum necessary action?**
   - No → Reconsider approach and use less invasive method
   - Yes → Proceed with proper documentation

When in doubt:
- Pause testing activities
- Document the situation
- Consult with authorization authority
- Obtain explicit guidance before proceeding

## Final Verification Checklist

Before concluding any penetration testing engagement, verify:

- [ ] All testing activities were properly authorized and documented
- [ ] Testing remained within defined scope boundaries
- [ ] All artifacts and test accounts have been removed
- [ ] Findings have been properly classified and reported
- [ ] Sensitive data has been protected throughout the process
- [ ] Complete logs and documentation have been preserved
- [ ] Cleanup activities have been verified and documented
- [ ] Data retention and destruction policies have been followed
- [ ] Ethical lessons learned have been documented