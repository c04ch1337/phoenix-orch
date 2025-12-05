import React, { useState, useEffect, useCallback } from 'react';
import { runAccessibilityAudit, AccessibilityAuditResult, AccessibilityIssue } from '../../utils/accessibilityAuditor';
import { useAccessibility } from '../../context/AccessibilityContext';
import { Text, Heading, Section, Container, Card } from '../layout/AccessibleLayout';

interface WCAGComplianceReportProps {
  autoScan?: boolean;
  target?: HTMLElement;
  className?: string;
}

const WCAGComplianceReport: React.FC<WCAGComplianceReportProps> = ({
  autoScan = false,
  target,
  className = '',
}) => {
  const [auditResult, setAuditResult] = useState<AccessibilityAuditResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});
  const { preferences } = useAccessibility();

  // Function to run the accessibility audit
  const runAudit = useCallback(async () => {
    setIsScanning(true);
    try {
      const result = await runAccessibilityAudit(target || document.body);
      setAuditResult(result);
      
      // Reset expanded issues
      setExpandedIssues({});
    } catch (error) {
      console.error('Error running accessibility audit:', error);
    } finally {
      setIsScanning(false);
    }
  }, [target]);
  
  // Run an initial scan if autoScan is enabled
  useEffect(() => {
    if (autoScan) {
      runAudit();
    }
  }, [autoScan, runAudit]);

  // Toggle expanded state for a specific issue
  const toggleIssue = (index: number) => {
    setExpandedIssues(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Calculate compliance percentage
  const calculateCompliance = () => {
    if (!auditResult) return 0;
    
    const totalChecks = auditResult.issues.length;
    if (totalChecks === 0) return 100;
    
    const errors = auditResult.issues.filter(issue => issue.type === 'error').length;
    return Math.round(((totalChecks - errors) / totalChecks) * 100);
  };

  // Group issues by WCAG guideline
  const issuesByGuideline = () => {
    if (!auditResult) return {};
    
    return auditResult.issues.reduce((acc: Record<string, AccessibilityIssue[]>, issue) => {
      if (!acc[issue.guideline]) {
        acc[issue.guideline] = [];
      }
      acc[issue.guideline].push(issue);
      return acc;
    }, {});
  };

  // Get the appropriate class based on compliance level
  const getComplianceClass = () => {
    const compliance = calculateCompliance();
    if (compliance >= 90) return 'text-green-500';
    if (compliance >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={`wcag-compliance-report ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <Heading level={2}>WCAG 2.2 AA Compliance Report</Heading>
        <button
          onClick={runAudit}
          disabled={isScanning}
          className="px-4 py-2 bg-phoenix-orange hover:bg-phoenix-orange-light text-black font-medium rounded transition-colors disabled:opacity-50"
        >
          {isScanning ? 'Scanning...' : 'Run Accessibility Scan'}
        </button>
      </div>

      {auditResult ? (
        <div>
          <Card className="mb-6">
            <div className="flex flex-col md:flex-row justify-between">
              <div>
                <Text className="font-bold">Scan Date:</Text>
                <Text>{new Date(auditResult.timestamp).toLocaleString()}</Text>
              </div>
              <div className="mt-4 md:mt-0">
                <Text className="font-bold">Compliance Score:</Text>
                <Text className={`text-2xl font-bold ${getComplianceClass()}`}>
                  {calculateCompliance()}%
                </Text>
              </div>
              <div className="mt-4 md:mt-0">
                <Text className="font-bold">Issues Found:</Text>
                <Text>
                  <span className="text-red-500">{auditResult.summary.errors} errors</span>, 
                  <span className="text-yellow-500 ml-2">{auditResult.summary.warnings} warnings</span>,
                  <span className="text-blue-500 ml-2">{auditResult.summary.info} info</span>
                </Text>
              </div>
            </div>
          </Card>

          <Section title="Issues by WCAG 2.2 Guidelines">
            {Object.entries(issuesByGuideline()).map(([guideline, issues], idx) => (
              <Card key={idx} className="mb-4 overflow-hidden">
                <div className="flex justify-between items-center">
                  <Heading level={3} className="text-lg">
                    {guideline} 
                    <span className="ml-2 text-sm">
                      ({issues.filter(i => i.type === 'error').length} errors, 
                      {issues.filter(i => i.type === 'warning').length} warnings)
                    </span>
                  </Heading>
                  <button
                    onClick={() => {
                      setExpandedIssues(prev => {
                        const isExpanded = prev[idx];
                        // Create an object with all issues for this guideline
                        const guidelineIssues = issues.reduce((acc, _, i) => {
                          acc[`${idx}-${i}`] = !isExpanded;
                          return acc;
                        }, {} as Record<string, boolean>);
                        
                        return { ...prev, ...guidelineIssues, [idx]: !isExpanded };
                      });
                    }}
                    className="text-sm text-gray-400 hover:text-white"
                    aria-expanded={expandedIssues[idx]}
                  >
                    {expandedIssues[idx] ? 'Collapse all' : 'Expand all'}
                  </button>
                </div>

                <div className="mt-2">
                  {issues.map((issue, issueIdx) => {
                    const issueKey = `${idx}-${issueIdx}`;
                    const isExpanded = expandedIssues[issueKey];
                    
                    return (
                      <div 
                        key={issueKey} 
                        className="border-t border-gray-700 pt-3 pb-2"
                      >
                        <button
                          onClick={() => toggleIssue(parseInt(issueKey))}
                          className="w-full text-left flex justify-between items-center"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center">
                            <span 
                              className={`inline-block w-3 h-3 rounded-full mr-2 ${
                                issue.type === 'error' ? 'bg-red-500' :
                                issue.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                              aria-hidden="true"
                            ></span>
                            <span className="font-medium">{issue.message}</span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </button>
                        
                        {isExpanded && (
                          <div className="mt-2 pl-5 text-gray-300">
                            <p><strong>Impact:</strong> {issue.impact}</p>
                            <p><strong>Recommendation:</strong> {issue.recommendation}</p>
                            {issue.selector && (
                              <p className="mt-2">
                                <strong>Selector:</strong>
                                <code className="ml-2 bg-gray-800 px-1 py-0.5 rounded text-xs">
                                  {issue.selector}
                                </code>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </Section>

          <Section title="WCAG 2.2 AA Compliance Status">
            <Card>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-4 border-b border-gray-700">Guideline</th>
                    <th className="text-left py-2 px-4 border-b border-gray-700">Status</th>
                    <th className="text-left py-2 px-4 border-b border-gray-700">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: '1.1.1', name: 'Non-text Content' },
                    { id: '1.2.1-1.2.5', name: 'Time-based Media' },
                    { id: '1.3.1-1.3.5', name: 'Adaptable' },
                    { id: '1.4.1-1.4.13', name: 'Distinguishable' },
                    { id: '2.1.1-2.1.4', name: 'Keyboard Accessible' },
                    { id: '2.2.1-2.2.2', name: 'Enough Time' },
                    { id: '2.3.1-2.3.3', name: 'Seizures and Physical Reactions' },
                    { id: '2.4.1-2.4.7', name: 'Navigable' },
                    { id: '2.5.1-2.5.8', name: 'Input Modalities' },
                    { id: '3.1.1-3.1.2', name: 'Readable' },
                    { id: '3.2.1-3.2.6', name: 'Predictable' },
                    { id: '3.3.1-3.3.6', name: 'Input Assistance' },
                    { id: '4.1.1-4.1.3', name: 'Compatible' },
                  ].map(guideline => {
                    const guidelineIssues = 
                      auditResult?.issues.filter(issue => 
                        issue.guideline.startsWith(guideline.id) || 
                        issue.guideline.includes(guideline.name)
                      ) || [];
                      
                    const hasErrors = guidelineIssues.some(issue => issue.type === 'error');
                    const hasWarnings = guidelineIssues.some(issue => issue.type === 'warning');
                    
                    let status = 'Passed';
                    let statusColor = 'text-green-500';
                    
                    if (hasErrors) {
                      status = 'Failed';
                      statusColor = 'text-red-500';
                    } else if (hasWarnings) {
                      status = 'Warning';
                      statusColor = 'text-yellow-500';
                    }
                    
                    return (
                      <tr key={guideline.id} className="border-b border-gray-700">
                        <td className="py-2 px-4">
                          <strong>{guideline.id}</strong>: {guideline.name}
                        </td>
                        <td className={`py-2 px-4 ${statusColor} font-medium`}>
                          {status}
                        </td>
                        <td className="py-2 px-4">
                          {guidelineIssues.length > 0 ? guidelineIssues.length : 'None'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </Section>
        </div>
      ) : (
        <div className="text-center py-12">
          <Text className="text-lg mb-4">Click "Run Accessibility Scan" to evaluate WCAG 2.2 AA compliance</Text>
          <Text className="text-gray-400">
            The accessibility scan will check for common accessibility issues and provide recommendations
            for improving accessibility in accordance with WCAG 2.2 AA guidelines.
          </Text>
        </div>
      )}
    </div>
  );
};

export default WCAGComplianceReport;