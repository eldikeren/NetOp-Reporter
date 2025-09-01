import React from 'react';

interface Finding {
  summary_line: string;
  severity: 'major_issue' | 'recurring_issue' | 'notable';
  trend: 'worsening_trend' | 'improving_trend' | 'stable_trend' | 'n/a';
  last_occurrence: string;
  avg_duration_minutes: number;
  total_occurrences: number;
}

interface CategorySectionProps {
  category: string;
  findings: Finding[];
}

const SEVERITY_MAP = {
  major_issue: {
    icon: '🚨',
    color: 'text-red-600 border-red-500/50 bg-red-50',
    label: 'Major Issue',
  },
  recurring_issue: {
    icon: '🔄',
    color: 'text-orange-600 border-orange-500/50 bg-orange-50',
    label: 'Recurring Issue',
  },
  notable: {
    icon: 'ℹ️',
    color: 'text-blue-600 border-blue-500/50 bg-blue-50',
    label: 'Notable',
  },
};

const TREND_MAP = {
  worsening_trend: {
    icon: '↗️',
    color: 'text-red-600',
    label: 'Worsening'
  },
  improving_trend: {
    icon: '↘️',
    color: 'text-green-600',
    label: 'Improving'
  },
  stable_trend: {
    icon: '➡️',
    color: 'text-gray-500',
    label: 'Stable'
  },
  'n/a': {
    icon: '❓',
    color: 'text-gray-400',
    label: 'N/A'
  },
};

export default function CategorySection({ category, findings }: CategorySectionProps) {
  const isStabilityReport = findings.length === 1 && findings[0].summary_line === "Stability observed in this area.";

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">{category}</h3>
        {!isStabilityReport && (
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Top {findings.length} Issue{findings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      <div className="space-y-4">
        {findings.map((finding, index) => {
          if (isStabilityReport) {
            return (
              <div key={index} className="p-4 rounded-lg bg-green-50 text-green-800 flex items-center gap-3">
                <span className="text-green-600">✅</span>
                <p className="font-medium">{finding.summary_line}</p>
              </div>
            );
          }
          
          const severity = SEVERITY_MAP[finding.severity];
          const trend = TREND_MAP[finding.trend];
          
          return (
            <div key={index} className="p-4 rounded-lg border bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="flex-1 text-gray-800">{finding.summary_line}</p>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${severity.color}`}>
                  <span>{severity.icon}</span>
                  <span>{severity.label}</span>
                </span>
                <div className={`flex items-center gap-1 ${trend.color}`}>
                  <span>{trend.icon}</span>
                  <span className="text-sm font-medium">{trend.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
