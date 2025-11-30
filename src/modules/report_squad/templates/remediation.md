# Remediation Plan

## Finding Overview
**Title:** {{finding.title}}
**Severity:** {{finding.severity}}
**Priority:** {{finding.remediation.priority}}

## Recommendation
{{finding.remediation.recommendation}}

## Implementation Details

### Effort Level
**Estimated Effort:** {{finding.remediation.effort}}

### Remediation Steps
{{#each finding.remediation.steps}}
1. {{this}}
{{/each}}

### Validation Steps
{{#each finding.attack_path.steps}}
1. Verify mitigation of: {{this}}
{{/each}}

## Asset-Specific Considerations
{{#each finding.affected_assets}}
### {{this.name}}
- **Asset Type:** {{this.asset_type}}
- **Location:** {{this.location}}
- **Required Changes:** Based on the impact "{{this.impact}}", implement appropriate controls.
{{/each}}

## References and Resources
{{#each finding.remediation.references}}
- {{this}}
{{/each}}

## Timeline Recommendations
- **Priority Level:** {{finding.remediation.priority}}
- **Suggested Timeline:** {{#if (eq finding.remediation.priority "High")}}Within 30 days{{else if (eq finding.remediation.priority "Medium")}}Within 90 days{{else}}Within 180 days{{/if}}

## Post-Implementation Verification
To verify successful implementation:
1. Conduct technical testing to validate fixes
2. Verify each remediation step
3. Perform impact analysis
4. Document changes
5. Update security baseline

## Risk After Remediation
- Original CVSS: {{finding.cvss.score}}
- Expected Residual Risk: Low

---
Generated: {{generated_at}}
Phoenix Signature: {{finding.signature}}