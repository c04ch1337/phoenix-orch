import { useState } from 'react';
import { ChevronDown, Download, Eye, FileText, X } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  severity: string;
  status: string;
  timestamp: string;
  preview: string;
}

interface ReportPreviewProps {
  report: Report;
}

const getSeverityColors = (severity: string) => {
  const lower = severity.toLowerCase();
  switch (lower) {
    case 'critical':
      return {
        bg: 'bg-red-900/30',
        border: 'border-red-700/50',
        text: 'text-red-400',
        badge: 'bg-red-600 text-white'
      };
    case 'high':
      return {
        bg: 'bg-orange-900/30',
        border: 'border-orange-700/50',
        text: 'text-orange-400',
        badge: 'bg-orange-600 text-white'
      };
    case 'medium':
      return {
        bg: 'bg-yellow-900/30',
        border: 'border-yellow-700/50',
        text: 'text-yellow-400',
        badge: 'bg-yellow-600 text-white'
      };
    case 'low':
      return {
        bg: 'bg-green-900/30',
        border: 'border-green-700/50',
        text: 'text-green-400',
        badge: 'bg-green-600 text-white'
      };
    default:
      return {
        bg: 'bg-zinc-900/30',
        border: 'border-zinc-700/50',
        text: 'text-zinc-400',
        badge: 'bg-zinc-600 text-white'
      };
  }
};

export default function ReportPreview({ report }: ReportPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const colors = getSeverityColors(report.severity);

  const handleDownload = async (format: string) => {
    try {
      const response = await fetch(`/api/reports/${report.id}/download?format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${report.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  return (
    <>
      {/* Report Card */}
      <div className={`p-4 border rounded ${colors.border} ${colors.bg} hover:border-opacity-75 transition-all duration-300`}>
        <div className="flex justify-between items-start gap-4">
          {/* Left Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h3 className="text-lg font-semibold text-white font-mono truncate">
                {report.title}
              </h3>
              <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${colors.badge} flex-shrink-0`}>
                {report.severity}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Generated: {new Date(report.timestamp).toLocaleString()}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setPreviewOpen(true)}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDownload('pdf')}
              className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className={`p-2 rounded hover:bg-zinc-800 transition-all duration-300 text-zinc-400 hover:text-white ${
                expanded ? 'rotate-180' : ''
              }`}
              title="Show more"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-zinc-700/50 space-y-4">
            <div className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">
              {report.preview}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDownload('md')}
                className="px-3 py-1.5 text-xs border border-zinc-700 rounded hover:border-zinc-600 hover:bg-zinc-800 transition-colors text-zinc-300 font-mono"
              >
                <FileText className="w-3 h-3 inline mr-1.5" />
                Markdown
              </button>
              <button
                onClick={() => handleDownload('html')}
                className="px-3 py-1.5 text-xs border border-zinc-700 rounded hover:border-zinc-600 hover:bg-zinc-800 transition-colors text-zinc-300 font-mono"
              >
                <FileText className="w-3 h-3 inline mr-1.5" />
                HTML
              </button>
              <button
                onClick={() => handleDownload('docx')}
                className="px-3 py-1.5 text-xs border border-zinc-700 rounded hover:border-zinc-600 hover:bg-zinc-800 transition-colors text-zinc-300 font-mono"
              >
                <FileText className="w-3 h-3 inline mr-1.5" />
                Word
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border-2 border-red-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white font-mono">
                  {report.title}
                </h2>
                <span className={`px-2 py-1 rounded text-xs font-mono uppercase ${colors.badge}`}>
                  {report.severity}
                </span>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-2 rounded hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="prose prose-invert prose-red max-w-none">
                <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap bg-black/30 p-4 rounded border border-zinc-800">
                  {report.preview}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 border border-zinc-700 rounded hover:border-zinc-600 hover:bg-zinc-800 transition-colors text-zinc-300 font-mono text-sm"
              >
                Close
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded transition-colors text-white font-mono text-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
