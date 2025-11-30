# Technical Details

## Vulnerability Information
**Title:** {{finding.title}}
**Severity:** {{finding.severity}}

### CVSS Details
- **Score:** {{finding.cvss.score}}
- **Vector:** {{finding.cvss.vector}}
- **Version:** {{finding.cvss.version}}

## Technical Description
{{finding.description}}

## Attack Path Analysis
### Prerequisites
{{#each finding.attack_path.prerequisites}}
- {{this}}
{{/each}}

### Attack Steps
{{#each finding.attack_path.steps}}
1. {{this}}
{{/each}}

### Impact Chain
{{#each finding.attack_path.impact_chain}}
- {{this}}
{{/each}}

## Affected Assets
{{#each finding.affected_assets}}
### {{this.name}}
- **Type:** {{this.asset_type}}
- **Location:** {{this.location}}
- **Impact:** {{this.impact}}
{{/each}}

## Evidence
{{#each finding.evidence}}
### Evidence {{@index}}
- **Type:** {{this.evidence_type}}
- **Timestamp:** {{this.timestamp}}
- **Description:** {{this.description}}
{{#if this.screenshot_path}}
- **Screenshot:** [View]({{this.screenshot_path}})
{{/if}}
{{/each}}

## Technical Validation
```
{{#each finding.evidence}}
{{this.data}}
{{/each}}
```

---
Generated: {{generated_at}}
Phoenix Signature: {{finding.signature}}