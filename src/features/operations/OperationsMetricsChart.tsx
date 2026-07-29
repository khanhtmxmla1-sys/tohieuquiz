import React from 'react';
import type { OperationsComponent } from '../../../shared/operations.contract';

interface OperationsMetricsChartProps {
  components: OperationsComponent[];
}

const statusRank = {
  healthy: 4,
  unknown: 3,
  degraded: 2,
  unavailable: 1,
} as const;

const OperationsMetricsChart: React.FC<OperationsMetricsChartProps> = ({ components }) => {
  const maxLatency = Math.max(1, ...components.map((component) => component.latencyMs));
  const counts = components.reduce<Record<string, number>>((accumulator, component) => {
    accumulator[component.status] = (accumulator[component.status] || 0) + 1;
    return accumulator;
  }, {});

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Biểu đồ vận hành">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Phân bố trạng thái</h3>
        <div className="mt-4 space-y-3">
          {(['healthy', 'unknown', 'degraded', 'unavailable'] as const).map((status) => {
            const count = counts[status] || 0;
            const width = components.length > 0 ? Math.max(4, (count / components.length) * 100) : 0;
            return (
              <div key={status}>
                <div className="mb-1 flex justify-between text-sm"><span>{status}</span><strong>{count}</strong></div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-slate-500" style={{ width: `${width}%`, opacity: statusRank[status] / 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="font-bold text-slate-900">Độ trễ probe</h3>
        <div className="mt-4 max-h-64 space-y-3 overflow-auto pr-1">
          {components.map((component) => (
            <div key={component.id}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="truncate">{component.label}</span><strong>{component.latencyMs} ms</strong>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-500" style={{ width: `${Math.max(2, component.latencyMs / maxLatency * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OperationsMetricsChart;
