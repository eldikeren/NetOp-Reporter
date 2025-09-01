import React from 'react';

interface ReportVisualsProps {
  analysis_result: any;
}

const COLORS = {
  major_issue: '#ef4444', // red-500
  recurring_issue: '#f97316', // orange-500
  notable: '#3b82f6', // blue-500
};

const CustomTooltip = ({ active, payload, label, yAxisLabel = "Occurrences" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 backdrop-blur-sm p-2 border border-gray-200 rounded-md shadow-lg">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-blue-600">{`${yAxisLabel}: ${payload[0].value.toLocaleString()}`}</p>
      </div>
    );
  }
  return null;
};

export default function ReportVisuals({ analysis_result }: ReportVisualsProps) {
  // Add fallback data in case analysis_result is undefined or missing properties
  const fallbackData = {
    categories: []
  };
  
  const { categories } = analysis_result || fallbackData;

  const occurrencesByCategory = (categories || [])
    .map((cat: any) => ({
      name: cat.category_name.replace(/ Events| Issues| \/ WLAN| \/ Port Errors/g, '').replace('Device Availability / Unreachability', 'Unreachable'),
      occurrences: (cat.findings || []).reduce((sum: number, f: any) => sum + (f.total_occurrences || 0), 0)
    }))
    .filter((cat: any) => cat.occurrences > 0);

  const severityDistribution = (categories || [])
    .flatMap((c: any) => c.findings || [])
    .filter((f: any) => f.total_occurrences > 0)
    .reduce((acc: any, finding: any) => {
      acc[finding.severity] = (acc[finding.severity] || 0) + finding.total_occurrences;
      return acc;
    }, {});

  const severityData = Object.entries(severityDistribution)
    .map(([name, value]) => ({ name, value }))
    .filter((item: any) => COLORS[item.name as keyof typeof COLORS] && item.value > 0);

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Dashboard</h3>
      <div className="space-y-8">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">Total Event Occurrences by Category</h4>
          {occurrencesByCategory.length > 0 ? (
            <div className="space-y-3">
              {occurrencesByCategory.map((cat: any, index: number) => {
                const maxOccurrences = Math.max(...occurrencesByCategory.map((c: any) => c.occurrences));
                const percentage = (cat.occurrences / maxOccurrences) * 100;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-700">{cat.name}</span>
                      <span className="font-semibold text-gray-900">{cat.occurrences.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center py-8">No event occurrences to visualize.</p>
          )}
        </div>
        
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">Event Occurrences by Severity</h4>
          {severityData.length > 0 ? (
            <div className="space-y-3">
              {severityData.map((item: any, index: number) => {
                const total = severityData.reduce((sum: number, i: any) => sum + i.value, 0);
                const percentage = (item.value / total) * 100;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: COLORS[item.name as keyof typeof COLORS] }}
                    ></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="capitalize text-gray-700">{item.name.replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-gray-900">
                          {item.value.toLocaleString()} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: COLORS[item.name as keyof typeof COLORS]
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500 text-center py-8">No severe events to visualize.</p>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">Trend Analysis</h4>
          <div className="grid grid-cols-3 gap-4">
            {['worsening_trend', 'stable_trend', 'improving_trend'].map((trend) => {
              const count = categories
                .flatMap((c: any) => c.findings)
                .filter((f: any) => f.trend === trend && f.total_occurrences > 0)
                .length;
              
              const icons = {
                worsening_trend: '↗️',
                stable_trend: '➡️',
                improving_trend: '↘️'
              };
              
              const colors = {
                worsening_trend: 'text-red-600',
                stable_trend: 'text-gray-600',
                improving_trend: 'text-green-600'
              };
              
              return (
                <div key={trend} className="text-center p-3 border border-gray-200 rounded-lg">
                  <div className={`text-2xl mb-1 ${colors[trend as keyof typeof colors]}`}>
                    {icons[trend as keyof typeof icons]}
                  </div>
                  <div className={`font-semibold text-lg ${colors[trend as keyof typeof colors]}`}>
                    {count}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {trend.replace(/_/g, ' ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
