import React, { useState, useMemo } from 'react';
import {
  Activity,
  Upload,
  Download,
  Sliders,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { segmentMicrocirculationSignal, COMPASS_POINTS } from '../utils/excelParser';
import { mean, std } from '../utils/statistics';
import { downloadMicrocirculationTemplate } from '../utils/templateGenerator';

export default function SbfStandaloneView({ microData, onUploadMicro }) {
  const subjectList = useMemo(() => (microData ? Object.keys(microData) : []), [microData]);

  const [selectedSubjectKey, setSelectedSubjectKey] = useState('ALL');
  const [selectedFreq, setSelectedFreq] = useState('30Hz');
  const [samplingRateHz, setSamplingRateHz] = useState(40.0);
  const [dwellDurationSec, setDwellDurationSec] = useState(7.41);
  const [dwellEstimator, setDwellEstimator] = useState('p25');

  // Compute 9-dwell kinetic analysis for standalone SBF
  const sbfAnalysis = useMemo(() => {
    if (!microData || subjectList.length === 0) return null;

    const isGroup = selectedSubjectKey === 'ALL';

    if (isGroup) {
      const allBeDwells = [];
      const allAfDwells = [];

      subjectList.forEach((sName) => {
        const s = microData[sName];
        if (s && s.frequencies[selectedFreq]) {
          const be = s.frequencies[selectedFreq].before || [];
          const af = s.frequencies[selectedFreq].after || [];
          allBeDwells.push(segmentMicrocirculationSignal(be, samplingRateHz, dwellDurationSec, dwellEstimator));
          allAfDwells.push(segmentMicrocirculationSignal(af, samplingRateHz, dwellDurationSec, dwellEstimator));
        }
      });

      if (allBeDwells.length === 0) return null;

      const groupDwells = [];
      for (let i = 0; i < 9; i++) {
        const cp = COMPASS_POINTS[i];
        const beVals = allBeDwells.map((d) => (d[i] ? d[i].value : 0)).filter((v) => v > 0);
        const afVals = allAfDwells.map((d) => (d[i] ? d[i].value : 0)).filter((v) => v > 0);

        const mBe = beVals.length > 0 ? Number(mean(beVals).toFixed(2)) : 0;
        const mAf = afVals.length > 0 ? Number(mean(afVals).toFixed(2)) : 0;
        const dVal = Number((mAf - mBe).toFixed(2));
        const pct = mBe > 0 ? Number(((dVal / mBe) * 100).toFixed(1)) : 0;

        groupDwells.push({
          id: i + 1,
          name: cp.name,
          code: cp.code,
          row: cp.row,
          col: cp.col,
          startTimeSec: Number((i * dwellDurationSec).toFixed(2)),
          endTimeSec: Number(((i + 1) * dwellDurationSec).toFixed(2)),
          sampleCount: Math.round(dwellDurationSec * samplingRateHz),
          before: mBe,
          after: mAf,
          delta: dVal,
          pct
        });
      }

      const allBe = groupDwells.map((d) => d.before);
      const allAf = groupDwells.map((d) => d.after);
      const allD = groupDwells.map((d) => d.delta);

      return {
        subjectTitle: `All Subjects Combined (N = ${subjectList.length})`,
        isGroup: true,
        dwells: groupDwells,
        meanBefore: Number(mean(allBe).toFixed(2)),
        meanAfter: Number(mean(allAf).toFixed(2)),
        meanDelta: Number(mean(allD).toFixed(2)),
        overallPct: mean(allBe) > 0 ? Number(((mean(allD) / mean(allBe)) * 100).toFixed(1)) : 0
      };
    } else {
      const s = microData[selectedSubjectKey];
      if (!s || !s.frequencies[selectedFreq]) return null;

      const be = s.frequencies[selectedFreq].before || [];
      const af = s.frequencies[selectedFreq].after || [];

      const dwellsBe = segmentMicrocirculationSignal(be, samplingRateHz, dwellDurationSec, dwellEstimator);
      const dwellsAf = segmentMicrocirculationSignal(af, samplingRateHz, dwellDurationSec, dwellEstimator);

      const dwells = dwellsBe.map((d, i) => {
        const cp = COMPASS_POINTS[i];
        const beVal = d.value;
        const afVal = dwellsAf[i] ? dwellsAf[i].value : 0;
        const delta = Number((afVal - beVal).toFixed(2));
        const pct = beVal > 0 ? Number(((delta / beVal) * 100).toFixed(1)) : 0;

        return {
          id: i + 1,
          name: cp.name,
          code: cp.code,
          row: cp.row,
          col: cp.col,
          startTimeSec: d.startTimeSec,
          endTimeSec: d.endTimeSec,
          sampleCount: d.sampleCount,
          before: beVal,
          after: afVal,
          delta,
          pct
        };
      });

      const allBe = dwells.map((d) => d.before);
      const allAf = dwells.map((d) => d.after);
      const allD = dwells.map((d) => d.delta);

      return {
        subjectTitle: `Subject: ${selectedSubjectKey}`,
        isGroup: false,
        dwells,
        meanBefore: Number(mean(allBe).toFixed(2)),
        meanAfter: Number(mean(allAf).toFixed(2)),
        meanDelta: Number(mean(allD).toFixed(2)),
        overallPct: mean(allBe) > 0 ? Number(((mean(allD) / mean(allBe)) * 100).toFixed(1)) : 0
      };
    }
  }, [microData, subjectList, selectedSubjectKey, selectedFreq, samplingRateHz, dwellDurationSec, dwellEstimator]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Upload Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Laser-Doppler Skin Blood Flow (SBF) Standalone Analysis
              </h2>
              <p className="text-xs text-gray-500">
                Analyze microvascular perfusion dynamics, dwell kinetics, and vasodilation response independently
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Upload Button */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload SBF File (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={onUploadMicro}
                className="hidden"
              />
            </label>

            {/* Template Download */}
            <button
              onClick={downloadMicrocirculationTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download SBF Template</span>
            </button>
          </div>
        </div>

        {/* Control Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Subject</label>
            <select
              value={selectedSubjectKey}
              onChange={(e) => setSelectedSubjectKey(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium"
            >
              {subjectList.length > 1 && (
                <option value="ALL">🌐 All Subjects Combined (N = {subjectList.length})</option>
              )}
              {subjectList.map((sName) => (
                <option key={sName} value={sName}>
                  {sName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Stimulation Frequency</label>
            <select
              value={selectedFreq}
              onChange={(e) => setSelectedFreq(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium"
            >
              <option value="30Hz">30 Hz (1_30)</option>
              <option value="50Hz">50 Hz (1_50)</option>
              <option value="100Hz">100 Hz (1_100)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">
              Sampling Rate (Hz)
              <span className="text-gray-400 font-normal ml-1">({(1000 / samplingRateHz).toFixed(1)} ms)</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="1000"
              value={samplingRateHz}
              onChange={(e) => setSamplingRateHz(Math.max(1, parseFloat(e.target.value) || 40))}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Dwell Window (s)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="60"
              value={dwellDurationSec}
              onChange={(e) => setDwellDurationSec(Math.max(0.5, parseFloat(e.target.value) || 7.41))}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-1">Plateau Estimator</label>
            <select
              value={dwellEstimator}
              onChange={(e) => setDwellEstimator(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium"
            >
              <option value="p25">P25 (Spike-Resistant)</option>
              <option value="median">Median (P50)</option>
              <option value="mean">Mean (Average)</option>
            </select>
          </div>
        </div>
      </div>

      {!microData ? (
        <div className="p-8 bg-white rounded-xl border border-dashed border-gray-300 text-center space-y-3">
          <Activity className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-sm font-bold text-gray-700">No Microcirculation Data Loaded</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Please upload an SBF Excel workbook (.xlsx) using the button above or download the standard template.
          </p>
        </div>
      ) : sbfAnalysis ? (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Baseline Perfusion (Before)</span>
              <div className="text-2xl font-black text-gray-900 mt-2">{sbfAnalysis.meanBefore} <span className="text-xs text-gray-500 font-normal">PU</span></div>
              <p className="text-[10px] text-gray-400 mt-1">Pre-stimulation resting flux</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Stimulated Perfusion (After)</span>
              <div className="text-2xl font-black text-indigo-600 mt-2">{sbfAnalysis.meanAfter} <span className="text-xs text-gray-500 font-normal">PU</span></div>
              <p className="text-[10px] text-gray-400 mt-1">Post-stimulation hyperemic flux</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Mean Δ Flux</span>
              <div className="text-2xl font-black text-rose-600 mt-2">
                {sbfAnalysis.meanDelta >= 0 ? `+${sbfAnalysis.meanDelta}` : sbfAnalysis.meanDelta} <span className="text-xs text-gray-500 font-normal">PU</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Net perfusion difference</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Vasodilation Change</span>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                {sbfAnalysis.overallPct >= 0 ? `+${sbfAnalysis.overallPct}%` : `${sbfAnalysis.overallPct}%`}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Relative percentage alteration</p>
            </div>
          </div>

          {/* Dwell Sequence Table */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  9 Sequential SBF Dwell Intervals ({selectedFreq})
                </h3>
                <p className="text-xs text-gray-500">
                  {sbfAnalysis.subjectTitle} • Sampling Rate: {samplingRateHz} Hz • Window: {dwellDurationSec}s per dwell
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-4">Dwell #</th>
                    <th className="py-2.5 px-4">Site Landmark</th>
                    <th className="py-2.5 px-4">Time Window</th>
                    <th className="py-2.5 px-4">Samples</th>
                    <th className="py-2.5 px-4 text-right">Before (PU)</th>
                    <th className="py-2.5 px-4 text-right">After (PU)</th>
                    <th className="py-2.5 px-4 text-right font-bold">Δ Flux (PU)</th>
                    <th className="py-2.5 px-4 text-right font-bold">% Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sbfAnalysis.dwells.map((d) => (
                    <tr key={d.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-4 font-bold text-gray-900">#{d.id}</td>
                      <td className="py-2 px-4 font-medium text-gray-800">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-semibold mr-1.5">
                          {d.code}
                        </span>
                        {d.name}
                      </td>
                      <td className="py-2 px-4 font-mono text-gray-600">
                        {d.startTimeSec}s - {d.endTimeSec}s
                      </td>
                      <td className="py-2 px-4 font-mono text-gray-600">{d.sampleCount}</td>
                      <td className="py-2 px-4 text-right font-mono text-gray-700">{d.before}</td>
                      <td className="py-2 px-4 text-right font-mono text-gray-700">{d.after}</td>
                      <td className="py-2 px-4 text-right font-bold text-rose-600">
                        {d.delta >= 0 ? `+${d.delta}` : d.delta}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-emerald-600">
                        {d.pct >= 0 ? `+${d.pct}%` : `${d.pct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
