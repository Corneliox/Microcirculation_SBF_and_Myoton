import React from 'react';
import { Compass, Zap, Activity } from 'lucide-react';

/**
 * Helper to interpolate color between cool blue, neutral, and warm red
 */
function getHeatColor(val, minVal, maxVal, isStiffness = false) {
  if (isNaN(val) || val === 0) return '#f3f4f6';
  const range = Math.max(Math.abs(minVal), Math.abs(maxVal), 1e-6);
  const normalized = Math.max(-1, Math.min(1, val / range)); // -1 to 1

  if (!isStiffness) {
    // For Flux: positive is warm/vasodilation (orange/red), negative is cool (blue)
    if (normalized > 0) {
      const alpha = Math.min(1, 0.2 + 0.8 * normalized);
      return `rgba(239, 68, 68, ${alpha.toFixed(2)})`; // Red
    } else {
      const alpha = Math.min(1, 0.2 + 0.8 * Math.abs(normalized));
      return `rgba(59, 130, 246, ${alpha.toFixed(2)})`; // Blue
    }
  } else {
    // For Stiffness: softening is green/blue, stiffening is amber/red
    if (normalized > 0) {
      const alpha = Math.min(1, 0.2 + 0.8 * normalized);
      return `rgba(245, 158, 11, ${alpha.toFixed(2)})`; // Amber
    } else {
      const alpha = Math.min(1, 0.2 + 0.8 * Math.abs(normalized));
      return `rgba(16, 185, 129, ${alpha.toFixed(2)})`; // Emerald
    }
  }
}

export default function CompassHeatmap({ title, subtitle, metricName, unit, dataCells, isStiffness = false }) {
  if (!dataCells || dataCells.length === 0) {
    return <div className="p-8 text-center text-gray-500">No spatial grid data available</div>;
  }

  const values = dataCells.map(c => (isStiffness ? c.stiffDelta : c.fluxDelta));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  // Group cells into 3x3 grid
  const grid3x3 = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ];

  dataCells.forEach(cell => {
    if (cell.row >= 0 && cell.row < 3 && cell.col >= 0 && cell.col < 3) {
      grid3x3[cell.row][cell.col] = cell;
    }
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-600" />
            {title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full border">
          {unit}
        </span>
      </div>

      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-3 my-auto p-2 bg-gray-50 rounded-lg border border-gray-200">
        {grid3x3.map((rowCells, rIdx) =>
          rowCells.map((cell, cIdx) => {
            if (!cell) return <div key={`${rIdx}-${cIdx}`} className="h-24 bg-gray-100 rounded-lg" />;
            const val = isStiffness ? cell.stiffDelta : cell.fluxDelta;
            const beforeVal = isStiffness ? cell.stiffBefore : cell.fluxBefore;
            const afterVal = isStiffness ? cell.stiffAfter : cell.fluxAfter;
            const pct = isStiffness ? cell.stiffChangePct : cell.fluxChangePct;
            const bg = getHeatColor(val, minVal, maxVal, isStiffness);
            const isCenter = cell.id === 5;

            return (
              <div
                key={cell.id}
                className={`relative flex flex-col justify-between p-2.5 rounded-lg border transition-all hover:shadow-md ${
                  isCenter ? 'ring-2 ring-indigo-500 ring-offset-1' : 'border-gray-200'
                }`}
                style={{ backgroundColor: bg }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-800 bg-white/80 px-1.5 py-0.5 rounded shadow-xs">
                    #{cell.id} {cell.code}
                  </span>
                  <span className="text-[10px] font-medium text-gray-600 truncate max-w-[90px]">
                    {cell.name.split(' ')[0]}
                  </span>
                </div>

                <div className="my-1.5 text-center">
                  <div className="text-lg font-black tracking-tight text-gray-900 drop-shadow-xs">
                    {val > 0 ? `+${val}` : `${val}`}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-700">
                    {pct > 0 ? `+${pct}%` : `${pct}%`}
                  </div>
                </div>

                <div className="flex justify-between text-[9px] text-gray-600 bg-white/70 px-1.5 py-0.5 rounded">
                  <span>B: {beforeVal}</span>
                  <span>A: {afterVal}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-between mt-4 text-[11px] text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
          <span>Decrease ({minVal.toFixed(1)})</span>
        </div>
        <span className="text-gray-400">•</span>
        <span className="font-medium text-gray-600">3x3 Compass Matrix</span>
        <span className="text-gray-400">•</span>
        <div className="flex items-center gap-1.5">
          <span>Increase (+{maxVal.toFixed(1)})</span>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
        </div>
      </div>
    </div>
  );
}
