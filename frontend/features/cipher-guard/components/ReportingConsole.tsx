'use client';

import React, { useState } from 'react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'pdf' | 'word' | 'html' | 'markdown';
  sections: string[];
  estimatedTime: string;
}

interface GeneratedReport {
  id: string;
  templateId: string;
  title: string;
  generatedAt: Date;
  format: string;
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  size?: string;
}

export default function ReportingConsole() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([
    {
      id: 'template-1',
      name: 'Executive Summary',
      description: 'High-level overview for management and stakeholders',
      format: 'pdf',
      sections: ['Executive Summary', 'Key Findings', 'Risk Assessment', 'Recommendations'],
      estimatedTime: '2 minutes'
    },
    {
      id: 'template-2',
      name: 'Technical Deep Dive',
      description: 'Detailed technical analysis for security teams',
      format: 'word',
      sections: ['Methodology', 'Technical Findings', 'Evidence Analysis', 'Remediation Steps'],
      estimatedTime: '5 minutes'
    },
    {
      id: 'template-3',
      name: 'Incident Report',
      description: 'Comprehensive incident documentation',
      format: 'pdf',
      sections: ['Incident Timeline', 'Impact Assessment', 'Response Actions', 'Lessons Learned'],
      estimatedTime: '3 minutes'
    },
    {
      id: 'template-4',
      name: 'Compliance Report',
      description: 'Regulatory compliance documentation',
      format: 'word',
      sections: ['Compliance Status', 'Gap Analysis', 'Evidence Log', 'Audit Trail'],
      estimatedTime: '4 minutes'
    },
    {
      id: 'template-5',
      name: 'Forensic Analysis',
      description: 'Detailed forensic investigation report',
      format: 'pdf',
      sections: ['Evidence Collection', 'Analysis Methods', 'Findings', 'Chain of Custody'],
      estimatedTime: '6 minutes'
    }
  ]);

  const [reports, setReports] = useState<GeneratedReport[]>([
    {
      id: 'report-2024-001',
      templateId: 'template-1',
      title: 'Q4 2024 Security Assessment',
      generatedAt: new Date(Date.now() - 86400000),
      format: 'pdf',
      status: 'completed',
      downloadUrl: '/reports/q4-2024-assessment.pdf',
      size: '2.3 MB'
    },
    {
      id: 'report-2024-002',
      templateId: 'template-2',
      title: 'SSH Brute Force Incident Analysis',
      generatedAt: new Date(Date.now() - 172800000),
      format: 'word',
      status: 'completed',
      downloadUrl: '/reports/ssh-incident-analysis.docx',
      size: '1.8 MB'
    },
    {
      id: 'report-2024-003',
      templateId: 'template-3',
      title: 'Phishing Campaign Response',
      generatedAt: new Date(Date.now() - 259200000),
      format: 'pdf',
      status: 'completed',
      downloadUrl: '/reports/phishing-response.pdf',
      size: '3.1 MB'
    }
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportTitle, setReportTitle] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'word' | 'html' | 'markdown'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return '📄';
      case 'word': return '📝';
      case 'html': return '🌐';
      case 'markdown': return '📋';
      default: return '📄';
    }
  };

  const getStatusColor = (status: GeneratedReport['status']) => {
    switch (status) {
      case 'generating': return 'text-yellow-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: GeneratedReport['status']) => {
    switch (status) {
      case 'generating': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const handleGenerateReport = () => {
    if (!selectedTemplate || !reportTitle.trim()) return;
    
    setIsGenerating(true);
    
    // Simulate report generation
    setTimeout(() => {
      const newReport: GeneratedReport = {
        id: `report-${Date.now()}`,
        templateId: selectedTemplate.id,
        title: reportTitle,
        generatedAt: new Date(),
        format: selectedFormat,
        status: 'completed',
        downloadUrl: `/reports/${reportTitle.toLowerCase().replace(/\s+/g, '-')}.${selectedFormat}`,
        size: `${(Math.random() * 5 + 1).toFixed(1)} MB`
      };
      
      setReports(prev => [newReport, ...prev]);
      setIsGenerating(false);
      setReportTitle('');
      setSelectedTemplate(null);
    }, 2000);
  };

  return (
    <div className="reporting-console bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Reporting Console</h2>

      {/* Report Generation */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-4">Generate New Report</h3>
        
        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select Template</label>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'bg-blue-600 border-l-4 border-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getFormatIcon(template.format)}</span>
                    <span className="font-medium text-white">{template.name}</span>
                  </div>
                  <p className="text-sm text-gray-300">{template.description}</p>
                  <div className="text-xs text-gray-400 mt-2">
                    Estimated time: {template.estimatedTime}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Details */}
          {selectedTemplate && (
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Report Title
                  </label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white"
                    placeholder="Enter report title..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Output Format
                  </label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value as any)}
                    className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="word">Microsoft Word</option>
                    <option value="html">HTML Web Page</option>
                    <option value="markdown">Markdown</option>
                  </select>
                </div>
              </div>

              {/* Template Sections */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Included Sections
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.sections.map((section) => (
                    <span key={section} className="bg-gray-600 px-2 py-1 rounded text-sm">
                      {section}
                    </span>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerateReport}
                disabled={!reportTitle.trim() || isGenerating}
                className={`mt-4 w-full py-2 rounded-md font-medium transition-colors ${
                  !reportTitle.trim() || isGenerating
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isGenerating ? 'Generating Report...' : 'Generate Report'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Generated Reports */}
      <div>
        <h3 className="text-lg font-semibold text-green-400 mb-4">Generated Reports</h3>
        
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {reports.map((report) => (
            <div key={report.id} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getFormatIcon(report.format)}</span>
                  <span className="font-medium text-white">{report.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(report.status)}>
                    {getStatusIcon(report.status)}
                  </span>
                  <span className="text-sm text-gray-400">
                    {formatTime(report.generatedAt)}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-gray-400">
                    Template: {templates.find(t => t.id === report.templateId)?.name}
                  </span>
                  <span className="text-gray-400">
                    Size: {report.size}
                  </span>
                </div>
                
                {report.status === 'completed' && report.downloadUrl && (
                  <button className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-medium transition-colors">
                    Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-3">Report Management</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm font-medium transition-colors">
            Create Template
          </button>
          <button className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm font-medium transition-colors">
            Export All
          </button>
          <button className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded text-sm font-medium transition-colors">
            Schedule Report
          </button>
          <button className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm font-medium transition-colors">
            Archive Old
          </button>
        </div>
      </div>
    </div>
  );
}