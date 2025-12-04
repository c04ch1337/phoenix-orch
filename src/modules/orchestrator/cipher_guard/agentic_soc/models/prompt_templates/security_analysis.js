/**
 * Security Analysis Prompt Templates
 * 
 * Provides structured prompt templates for security analysis tasks.
 */

/**
 * Template for vulnerability assessment
 * @param {object} params Parameters to fill in the template
 * @returns {string} Formatted prompt
 */
function vulnerabilityAssessment(params) {
    return `
You are a cybersecurity expert performing a vulnerability assessment. 
Analyze the following system or code for security vulnerabilities:

SYSTEM/CODE DESCRIPTION:
${params.description}

${params.code ? `CODE TO ANALYZE:\n\`\`\`${params.language || ''}\n${params.code}\n\`\`\`` : ''}

Consider the following aspects in your analysis:
- Input validation vulnerabilities
- Authentication/authorization weaknesses
- Data protection issues
- Secure coding practices
- Configuration vulnerabilities
- Common weakness enumeration (CWE) matches

ADDITIONAL CONTEXT:
${params.context || 'No additional context provided.'}

Provide a detailed analysis with:
1. Identified vulnerabilities (ranked by severity)
2. Specific locations or components affected
3. Potential impact of each vulnerability
4. Remediation recommendations
5. References to relevant security standards or best practices
`;
}

/**
 * Template for threat modeling
 * @param {object} params Parameters to fill in the template
 * @returns {string} Formatted prompt
 */
function threatModeling(params) {
    return `
You are a cybersecurity expert performing threat modeling. 
Analyze the following system for potential threats:

SYSTEM DESCRIPTION:
${params.description}

SYSTEM ARCHITECTURE:
${params.architecture || 'No architecture details provided.'}

DATA FLOWS:
${params.dataFlows || 'No data flow details provided.'}

TRUST BOUNDARIES:
${params.trustBoundaries || 'No trust boundary details provided.'}

Use the STRIDE threat modeling framework to identify potential threats:
- Spoofing: Can attackers impersonate something or someone else?
- Tampering: Can attackers modify data or code?
- Repudiation: Can attackers deny performing an action?
- Information Disclosure: Can attackers gain access to private information?
- Denial of Service: Can attackers deny service to users?
- Elevation of Privilege: Can attackers gain higher privileges?

For each identified threat:
1. Describe the threat scenario
2. Identify affected components
3. Assess the potential impact
4. Estimate likelihood
5. Calculate risk score (Impact × Likelihood)
6. Recommend mitigations

Present your analysis in a structured, prioritized format.
`;
}

/**
 * Template for incident analysis
 * @param {object} params Parameters to fill in the template
 * @returns {string} Formatted prompt
 */
function incidentAnalysis(params) {
    return `
You are a cybersecurity incident responder analyzing a security incident.
Review the following incident details and provide your expert analysis:

INCIDENT SUMMARY:
${params.summary}

OBSERVED INDICATORS:
${params.indicators ? params.indicators.join('\n') : 'No indicators provided.'}

AFFECTED SYSTEMS:
${params.affectedSystems ? params.affectedSystems.join('\n') : 'No affected systems specified.'}

TIMELINE OF EVENTS:
${params.timeline || 'No timeline provided.'}

LOG DATA:
${params.logs || 'No log data provided.'}

Provide a comprehensive incident analysis including:
1. Assessment of incident severity and scope
2. Identification of the attack vector and techniques used
3. Attribution analysis (if possible)
4. Mapping to MITRE ATT&CK framework
5. Recommended containment and remediation steps
6. Evidence preservation recommendations
7. Lessons learned and future prevention measures

Format your response as a detailed incident report suitable for technical and management audiences.
`;
}

module.exports = {
    vulnerabilityAssessment,
    threatModeling,
    incidentAnalysis
};