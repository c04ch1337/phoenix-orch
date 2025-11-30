# Executive Summary

## Overview
{{finding.title}}

**Risk Level:** {{finding.severity}}
**CVSS Score:** {{finding.cvss.score}} ({{finding.cvss.vector}})

## Key Findings
{{finding.description}}

## Business Impact
{{#each finding.affected_assets}}
- **{{this.name}}**: {{this.impact}}
{{/each}}

## Recommendations
{{finding.remediation.recommendation}}

**Priority:** {{finding.remediation.priority}}
**Effort:** {{finding.remediation.effort}}

---
Generated: {{generated_at}}
Phoenix Signature: {{finding.signature}}