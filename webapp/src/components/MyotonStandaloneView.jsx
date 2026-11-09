import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Compass,
  Upload,
  Download,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  Zap,
  Footprints
} from 'lucide-react';
import CompassHeatmap from './CompassHeatmap';
import { COMPASS_POINTS } from '../utils/excelParser';
import { mean } from '../utils/statistics';
import { downloadMyotonTemplate } from '../utils/templateGenerator';

export default function MyotonStandaloneView({ myotonData, onUploadMyoton }) {
  const subjectList = useMemo(() => {
    if (!myotonData) return [];
    return Object.keys(myotonData).filter((k) => isNaN(k) && k !== 'ALL');
  }, [myotonData]);

  const [selectedSubjectKey, setSelectedSubjectKey] = useState('ALL');
  const [selectedFreq, setSelectedFreq] = useState('30Hz');
  const [showTriplicates, setShowTriplicates] = useState(false);

  // Active target subject object
  const targetSubj = useMemo(() => {
    if (!myotonData) return null;
    if (selectedSubjectKey === 'ALL' || subjectList.length <= 1) {
      return myotonData['ALL'] || myotonData[1] || Object.values(myotonData)[0];
    }
    return myotonData[selectedSubjectKey] || myotonData[1] || Object.values(myotonData)[0];
  }, [myotonData, selectedSubjectKey, subjectList]);

  // Synchronize selectedFreq / protocol when subject changes or protocol format is detected
  useEffect(() => {
    if (!targetSubj) return;
    if (targetSubj.isProtocolFormat && targetSubj.availableProtocols && targetSubj.availableProtocols.length > 0) {
      if (!targetSubj.availableProtocols.includes(selectedFreq)) {
        setSelectedFreq(targetSubj.availableProtocols[0]);
      }
    } else if (!targetSubj.isProtocolFormat) {
      if (!['30Hz', '50Hz', '100Hz'].includes(selectedFreq)) {
        setSelectedFreq('30Hz');
      }
    }
  }, [targetSubj, selectedFreq]);

  // Active protocol metadata if in protocol format
  const activeProtocol = useMemo(() => {
    if (!targetSubj?.protocols) return null;
    return targetSubj.protocols.find((p) => p.name === selectedFreq) || targetSubj.protocols[0] || null;
  }, [targetSubj, selectedFreq]);

  // Compute Myoton standalone metrics
  const myotonAnalysis = useMemo(() => {
    if (!targetSubj || !targetSubj.points) return null;

    const isGroup = selectedSubjectKey === 'ALL' && subjectList.length > 1;
    const cells = [];
    const beforeList = [];
    const afterList = [];
    const deltaList = [];

    for (let pIdx = 1; pIdx <= 9; pIdx++) {
      const cp = COMPASS_POINTS[pIdx - 1];
      const pt = targetSubj.points[pIdx];
      const freqObj = pt?.frequencies?.[selectedFreq] || Object.values(pt?.frequencies || {})[0] || { before: 0, after: 0, delta: 0 };

      const sb = freqObj.before || 0;
      const sa = freqObj.after || 0;
      const ds = Number((sa - sb).toFixed(1));
      const pct = sb > 0 ? Number(((ds / sb) * 100).toFixed(1)) : 0;

      beforeList.push(sb);
      afterList.push(sa);
      deltaList.push(ds);

      cells.push({
        id: pIdx,
        name: cp.name,
        code: cp.code,
        row: cp.row,
        col: cp.col,
        stiffBefore: sb,
        stiffAfter: sa,
        stiffDelta: ds,
        stiffChangePct: pct,
        beforeStd: freqObj.beforeStd || 0,
        afterStd: freqObj.afterStd || 0,
        triplicatesBefore: freqObj.triplicatesBefore || null,
        triplicatesAfter: freqObj.triplicatesAfter || null,
        t1Before: targetSubj.t1?.[pIdx]?.before || 0,
        t1After: targetSubj.t1?.[pIdx]?.after || 0,
        m1Before: targetSubj.m1?.[pIdx]?.before || 0,
        m1After: targetSubj.m1?.[pIdx]?.after || 0
      });
    }

    const meanBe = Number(mean(beforeList).toFixed(1));
    const meanAf = Number(mean(afterList).toFixed(1));
    const meanD = Number(mean(deltaList).toFixed(1));
    const overallPct = meanBe > 0 ? Number(((meanD / meanBe) * 100).toFixed(1)) : 0;

    return {
      title: isGroup ? `All Subjects Group Average (N = ${subjectList.length || 3})` : `Subject: ${targetSubj.name}`,
      isGroup,
      cells,
      meanBefore: meanBe,
      meanAfter: meanAf,
      meanDelta: meanD,
      overallPct
    };
  }, [targetSubj, selectedSubjectKey, selectedFreq, subjectList]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Upload Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">
                  Myotonometer Plantar Biomechanics Standalone Analysis
                </h2>
                {targetSubj?.isProtocolFormat && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                    Multi-Protocol & Triplicates Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Spatial assessment of 9-point dynamic tissue stiffness (N/m), oscillation frequency, and decrement
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Upload Button */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Myoton File (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={onUploadMyoton}
                className="hidden"
              />
            </label>

            {/* Template Download */}
            <button
              onClick={downloadMyotonTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Download standard blank NewFormat.xlsx template for Myoton 9-point data collection"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download Template (NewFormat.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Control Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
          <div>
            <label className="block text-gray-700 font-semibold mb-1">Subject / Participant</label>
            <select
              value={selectedSubjectKey}
              onChange={(e) => setSelectedSubjectKey(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium"
            >
              {subjectList.length > 1 && !targetSubj?.isProtocolFormat && (
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
            <label className="block text-gray-700 font-semibold mb-1">
              {targetSubj?.isProtocolFormat ? 'Experimental Protocol, Frequency & Intensity' : 'Stimulation Frequency'}
            </label>
            <select
              value={selectedFreq}
              onChange={(e) => setSelectedFreq(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2 font-medium"
            >
              {targetSubj?.isProtocolFormat && targetSubj.availableProtocols ? (
                targetSubj.availableProtocols.map((pName) => (
                  <option key={pName} value={pName}>
                    {pName}
                  </option>
                ))
              ) : (
                <>
                  <option value="30Hz">30 Hz (1_30)</option>
                  <option value="50Hz">50 Hz (1_50)</option>
                  <option value="100Hz">100 Hz (1_100)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Active Protocol Context Card (If in Protocol Format) */}
        {activeProtocol && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1.5 ${
                activeProtocol.foot.toUpperCase().includes('LEFT')
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                <Footprints className="w-3.5 h-3.5" />
                {activeProtocol.foot}
              </span>
              <span className="font-semibold text-slate-800">
                Frequency: <span className="font-mono text-indigo-700">{activeProtocol.frequency}</span>
              </span>
              <span className="font-semibold text-slate-800">
                Intensity: <span className="font-mono text-amber-700">{activeProtocol.intensity}</span>
              </span>
              {activeProtocol.date && (
                <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 text-[11px]">
                  <Calendar className="w-3 h-3" />
                  {activeProtocol.date}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowTriplicates(!showTriplicates)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer shadow-2xs"
            >
              {showTriplicates ? 'Hide Triplicates (E1-E3)' : 'Show Triplicates (E1, E2, E3)'}
            </button>
          </div>
        )}
      </div>

      {!myotonData ? (
        <div className="p-8 bg-white rounded-xl border border-dashed border-gray-300 text-center space-y-3">
          <Layers className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-sm font-bold text-gray-700">No Myotonometer Data Loaded</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Please upload a Myoton 9-point Excel workbook (.xlsx) using the button above or download the standard template.
          </p>
        </div>
      ) : myotonAnalysis ? (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Baseline Stiffness (Before)</span>
              <div className="text-2xl font-black text-gray-900 mt-2">
                {myotonAnalysis.meanBefore} <span className="text-xs text-gray-500 font-normal">N/m</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Pre-stimulation resting stiffness</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Post-Stimulus Stiffness (After)</span>
              <div className="text-2xl font-black text-indigo-600 mt-2">
                {myotonAnalysis.meanAfter} <span className="text-xs text-gray-500 font-normal">N/m</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Post-stimulation tissue tone</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Mean Δ Stiffness</span>
              <div className="text-2xl font-black text-amber-600 mt-2">
                {myotonAnalysis.meanDelta >= 0 ? `+${myotonAnalysis.meanDelta}` : myotonAnalysis.meanDelta} <span className="text-xs text-gray-500 font-normal">N/m</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Net mechanical stiffness change</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <span className="text-[11px] font-semibold uppercase text-gray-500">Tissue Compliance Change</span>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                {myotonAnalysis.overallPct >= 0 ? `+${myotonAnalysis.overallPct}%` : `${myotonAnalysis.overallPct}%`}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Negative indicates softening</p>
            </div>
          </div>

          {/* 3x3 Spatial Heatmap */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
            <CompassHeatmap
              title={`Δ Myoton Tissue Stiffness (${selectedFreq})`}
              subtitle={`Spatial 3×3 matrix mapping sites 1 to 9 (Snake sequence)`}
              metricName="Stiffness"
              unit="N/m"
              dataCells={myotonAnalysis.cells}
              isStiffness={true}
            />
          </div>

          {/* 9-Point Measurements Table */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  9-Point Plantar Compass Coordinates ({selectedFreq})
                </h3>
                <p className="text-xs text-gray-500">
                  {myotonAnalysis.title} • Units: Dynamic Stiffness (N/m)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-4">Point (#)</th>
                    <th className="py-2.5 px-4">Compass Direction</th>
                    <th className="py-2.5 px-4">Grid Pos</th>
                    <th className="py-2.5 px-4 text-right">
                      {showTriplicates ? 'Stiff Before [Mean ± SD]' : 'Stiff Before (N/m)'}
                    </th>
                    <th className="py-2.5 px-4 text-right">
                      {showTriplicates ? 'Stiff After [Mean ± SD]' : 'Stiff After (N/m)'}
                    </th>
                    <th className="py-2.5 px-4 text-right font-bold">Δ Stiff (N/m)</th>
                    <th className="py-2.5 px-4 text-right font-bold">% Change</th>
                    {showTriplicates ? (
                      <>
                        <th className="py-2.5 px-4 text-right">Triplicates Before [E1, E2, E3]</th>
                        <th className="py-2.5 px-4 text-right">Triplicates After [E1, E2, E3]</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-4 text-right">T1 Before / After</th>
                        <th className="py-2.5 px-4 text-right">M1 Before / After</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myotonAnalysis.cells.map((c) => (
                    <tr key={c.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="py-2 px-4 font-bold text-gray-900">#{c.id}</td>
                      <td className="py-2 px-4 font-medium text-gray-800">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-semibold mr-1.5">
                          {c.code}
                        </span>
                        {c.name}
                      </td>
                      <td className="py-2 px-4 text-gray-500 font-mono text-[11px]">
                        Row {c.row + 1}, Col {c.col + 1}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-gray-700">
                        {showTriplicates && c.beforeStd > 0 ? (
                          <span>
                            <span className="font-bold">{c.stiffBefore}</span>
                            <span className="text-[10px] text-gray-400 ml-1">±{c.beforeStd}</span>
                          </span>
                        ) : (
                          c.stiffBefore
                        )}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-gray-700">
                        {showTriplicates && c.afterStd > 0 ? (
                          <span>
                            <span className="font-bold text-indigo-700">{c.stiffAfter}</span>
                            <span className="text-[10px] text-gray-400 ml-1">±{c.afterStd}</span>
                          </span>
                        ) : (
                          c.stiffAfter
                        )}
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-amber-600">
                        {c.stiffDelta >= 0 ? `+${c.stiffDelta}` : c.stiffDelta}
                      </td>
                      <td className="py-2 px-4 text-right font-semibold text-emerald-600">
                        {c.stiffChangePct >= 0 ? `+${c.stiffChangePct}%` : `${c.stiffChangePct}%`}
                      </td>
                      {showTriplicates ? (
                        <>
                          <td className="py-2 px-4 text-right font-mono text-gray-600 text-[10px]">
                            {c.triplicatesBefore ? `[${c.triplicatesBefore.join(', ')}]` : '-'}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-indigo-600 text-[10px]">
                            {c.triplicatesAfter ? `[${c.triplicatesAfter.join(', ')}]` : '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-4 text-right font-mono text-gray-600 text-[11px]">
                            {c.t1Before} / {c.t1After}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-gray-600 text-[11px]">
                            {c.m1Before} / {c.m1After}
                          </td>
                        </>
                      )}
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
