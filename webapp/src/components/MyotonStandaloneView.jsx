import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Layers,
  Compass,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Info,
  Calendar,
  Footprints,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Sparkles,
  RefreshCw,
  Eye,
  FolderUp,
  Edit3,
  Check,
  TrendingDown,
  TrendingUp,
  FileDown,
  ExternalLink,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CompassHeatmap from './CompassHeatmap';
import Myoton3DSurfaceCanvas from './Myoton3DSurfaceCanvas';
import { COMPASS_POINTS, validateOctWorkbook, parseKyleProtocolRecord, parseMyotonWorkbook } from '../utils/excelParser';
import { mean, median, std } from '../utils/statistics';
import { downloadMyotonTemplate, exportFormatOutputWorkbook, computeJsProtocolStats } from '../utils/templateGenerator';

/**
 * Status Badge Component with Click-to-Inspect Validation Modal
 */
function FormatStatusBadge({ validation, onClick }) {
  if (!validation) return null;

  let bgClass = 'bg-slate-50 text-slate-700 border-slate-200';
  let Icon = HelpCircle;
  let text = '⚪ Masalah Tidak Diketahui';

  if (validation.status === 'VALID') {
    bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100';
    Icon = CheckCircle2;
    text = '🟢 Format Sesuai';
  } else if (validation.status === 'WARNING') {
    bgClass = 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100';
    Icon = AlertTriangle;
    text = '🟡 Peringatan Format';
  } else if (validation.status === 'ERROR') {
    bgClass = 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100';
    Icon = XCircle;
    text = '🔴 Format Tidak Sesuai';
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(validation);
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${bgClass}`}
      title="Klik untuk melihat rincian validasi format & rekomendasi"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
    </button>
  );
}

/**
 * Validation Details Modal
 */
function ValidationDetailsModal({ validation, participantName, onClose }) {
  if (!validation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            {validation.status === 'VALID' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : validation.status === 'WARNING' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : validation.status === 'ERROR' ? (
              <XCircle className="w-5 h-5 text-rose-600" />
            ) : (
              <HelpCircle className="w-5 h-5 text-slate-500" />
            )}
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Laporan Validasi Format: {participantName}
              </h3>
              <p className="text-[11px] text-slate-500">
                Kode Status: <code className="font-mono font-semibold text-slate-700">{validation.code}</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {/* Status Alert Banner */}
          <div
            className={`p-3.5 rounded-xl border ${
              validation.status === 'VALID'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : validation.status === 'WARNING'
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : validation.status === 'ERROR'
                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <h4 className="font-bold text-xs mb-1">{validation.title}</h4>
            <p className="text-[11px] leading-relaxed">
              {validation.status === 'VALID'
                ? 'Struktur berkas Myoton OCT sesuai dengan spesifikasi klinis 6 protokol bilateral dan 9 titik kompas triplikat.'
                : 'Ditemukan beberapa ketidaksesuaian format yang memerlukan peninjauan.'}
            </p>
          </div>

          {/* Issues List */}
          {validation.issues && validation.issues.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Masalah yang Terdeteksi ({validation.issues.length}):</span>
              </h4>
              <ul className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-700 font-mono">
                {validation.issues.map((iss, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{iss}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actionable Recommendation */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5">
            <h4 className="font-bold text-indigo-900 mb-1 flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Rekomendasi Tindakan:</span>
            </h4>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              {validation.recommendation}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={downloadMyotonTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Template NewFormat.xlsx</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyotonStandaloneView({ myotonData, onUploadMyoton }) {
  // Master Participants list (Multi-Subject Session)
  const [participants, setParticipants] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [activeValidationModal, setActiveValidationModal] = useState(null);

  // Per-participant interactive states
  const [selectedProtocols, setSelectedProtocols] = useState({}); // { [participantId]: protocolNum }
  const [aggregationMethods, setAggregationMethods] = useState({}); // { [participantId]: 'mean' | 'median' }
  const [surfaceStages, setSurfaceStages] = useState({}); // { [participantId]: 'after' | 'before' }
  const [showTriplicates, setShowTriplicates] = useState(false);

  // Rename editing state
  const [editingId, setEditingId] = useState(null);
  const [editNameText, setEditNameText] = useState('');

  // Hidden file inputs
  const singleInputRef = useRef(null);
  const bulkInputRef = useRef(null);

  // Initialize participants from myotonData prop
  useEffect(() => {
    if (!myotonData) return;
    const keys = Object.keys(myotonData).filter((k) => isNaN(k) && k !== 'ALL');
    if (keys.length === 0) return;

    setParticipants((prev) => {
      // If already initialized with items, keep user modifications
      if (prev.length > 0) return prev;

      const items = keys.map((k, idx) => {
        const s = myotonData[k];
        return {
          id: `subj_${Date.now()}_${idx}`,
          name: s.name || k,
          fileName: s.fileName || `${k}.xlsx`,
          protocols: s.protocols || [],
          points: s.points || {},
          validation: s.validation || {
            status: s.protocols && s.protocols.length === 6 ? 'VALID' : 'WARNING',
            badge: s.protocols && s.protocols.length === 6 ? 'Format Sesuai' : 'Peringatan Format',
            color: s.protocols && s.protocols.length === 6 ? 'emerald' : 'amber',
            code: s.protocols && s.protocols.length === 6 ? 'PERFECT_MATCH' : 'INCOMPLETE_DATA',
            title: s.protocols && s.protocols.length === 6 ? 'Format OCT Terverifikasi Sempurna' : 'Format Parsial',
            issues: s.protocols && s.protocols.length === 6 ? [] : ['Protokol tidak lengkap (kurang dari 6 protokol).'],
            recommendation: 'Gunakan template NewFormat.xlsx untuk protokol standar.',
            protocolCount: s.protocols ? s.protocols.length : 0
          },
          date: s.protocols?.[0]?.date || 'Current Session'
        };
      });

      if (items.length > 0) {
        setExpandedId(items[0].id);
      }
      return items;
    });
  }, [myotonData]);

  // Read single file helper
  const processExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const raw = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          const validation = validateOctWorkbook(raw);
          const parsed = parseKyleProtocolRecord(raw, file.name);
          const targetObj = Object.values(parsed)[0];

          resolve({
            id: `subj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: targetObj.name || file.name.replace(/\.[^/.]+$/, ''),
            fileName: file.name,
            protocols: targetObj.protocols || [],
            points: targetObj.points || {},
            validation: validation,
            date: targetObj.protocols?.[0]?.date || new Date().toISOString().split('T')[0]
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Add Single Participant
  const handleAddParticipant = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const newSubj = await processExcelFile(file);
      setParticipants((prev) => [...prev, newSubj]);
      setExpandedId(newSubj.id);
    } catch (err) {
      alert('Gagal membaca file: ' + err.message);
    }
    e.target.value = '';
  };

  // Bulk Upload Multiple Participants
  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      const newItems = await Promise.all(files.map((f) => processExcelFile(f)));
      setParticipants((prev) => [...prev, ...newItems]);
      if (newItems.length > 0) {
        setExpandedId(newItems[0].id);
      }
    } catch (err) {
      alert('Gagal membaca beberapa file: ' + err.message);
    }
    e.target.value = '';
  };

  // Delete Participant
  const handleDeleteParticipant = (id, e) => {
    e.stopPropagation();
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  // Export Single Participant FormatOutput
  const handleExportSingle = (p, e) => {
    e.stopPropagation();
    exportFormatOutputWorkbook([p], `FormatOutput_${p.name}.xlsx`);
  };

  // Export All Participants FormatOutput
  const handleExportAll = () => {
    if (participants.length === 0) {
      alert('Belum ada data subjek untuk diekspor.');
      return;
    }
    exportFormatOutputWorkbook(participants, 'FormatOutput_All_Subjects.xlsx');
  };

  // Drag and Drop support
  const handleDrop = async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (files.length === 0) return;
    try {
      const newItems = await Promise.all(files.map((f) => processExcelFile(f)));
      setParticipants((prev) => [...prev, ...newItems]);
      if (newItems.length > 0) {
        setExpandedId(newItems[0].id);
      }
    } catch (err) {
      alert('Gagal memproses file yang di-drop: ' + err.message);
    }
  };

  // Rename commit
  const handleCommitRename = (id) => {
    if (editNameText.trim()) {
      setParticipants((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: editNameText.trim() } : p))
      );
    }
    setEditingId(null);
  };

  // Compute protocol metrics for expanded participant
  const getProtocolAnalysis = (participant) => {
    if (!participant || !participant.protocols || participant.protocols.length === 0) {
      return null;
    }

    const currentProtoNum = selectedProtocols[participant.id] || 1;
    const proto =
      participant.protocols.find((p) => p.protocolNum === currentProtoNum) ||
      participant.protocols[0];
    const method = aggregationMethods[participant.id] || 'mean';
    const stage = surfaceStages[participant.id] || 'after';

    const cells = [];
    const beforeList = [];
    const afterList = [];
    const deltaList = [];
    const grid3x3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

    for (let pIdx = 1; pIdx <= 9; pIdx++) {
      const cp = COMPASS_POINTS[pIdx - 1];
      const pt = proto.points[pIdx] || {};

      let sb = pt.meanBefore ?? pt.before ?? 0;
      let sa = pt.meanAfter ?? pt.after ?? 0;
      let ds = pt.meanDelta ?? pt.delta ?? 0;

      if (method === 'median') {
        sb = pt.medianBefore ?? sb;
        sa = pt.medianAfter ?? sa;
        ds = pt.medianDelta ?? ds;
      }

      const pct = sb > 0 ? Number(((ds / sb) * 100).toFixed(1)) : 0;

      beforeList.push(sb);
      afterList.push(sa);
      deltaList.push(ds);

      // Populate 3x3 grid for surface rendering
      const activeSurfaceVal = stage === 'before' ? sb : sa;
      if (cp) {
        grid3x3[cp.row][cp.col] = activeSurfaceVal;
      }

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
        beforeStd: pt.beforeStd || 0,
        afterStd: pt.afterStd || 0,
        meanBefore: pt.meanBefore,
        meanAfter: pt.meanAfter,
        medianBefore: pt.medianBefore,
        medianAfter: pt.medianAfter,
        triplicatesBefore: pt.triplicatesBefore || null,
        triplicatesAfter: pt.triplicatesAfter || null,
        sortedTriplicatesBefore: pt.sortedTriplicatesBefore || null,
        sortedTriplicatesAfter: pt.sortedTriplicatesAfter || null
      });
    }

    const overallBe =
      method === 'median' ? Number(median(beforeList).toFixed(1)) : Number(mean(beforeList).toFixed(1));
    const overallAf =
      method === 'median' ? Number(median(afterList).toFixed(1)) : Number(mean(afterList).toFixed(1));
    const overallD =
      method === 'median' ? Number(median(deltaList).toFixed(1)) : Number(mean(deltaList).toFixed(1));
    const overallPct = overallBe > 0 ? Number(((overallD / overallBe) * 100).toFixed(1)) : 0;

    return {
      proto,
      method,
      stage,
      cells,
      grid3x3,
      overallBe,
      overallAf,
      overallD,
      overallPct
    };
  };

  // Stats summary for header
  const statusCounts = useMemo(() => {
    let valid = 0, warning = 0, error = 0;
    participants.forEach((p) => {
      if (p.validation?.status === 'VALID') valid++;
      else if (p.validation?.status === 'WARNING') warning++;
      else error++;
    });
    return { valid, warning, error, total: participants.length };
  }, [participants]);

  return (
    <div className="space-y-6" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      {/* Top iLovePDF Style Control Bar */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl shadow-xs">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900">
                  Myoton Biomechanics Studio v3.0
                </h2>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold">
                  Multi-Subject & Accordion Mode
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pemeriksaan komparatif kekakuan jaringan 9-titik, estimasi Mean & Median, serta proyeksi gradien 3D
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden inputs */}
            <input
              type="file"
              ref={singleInputRef}
              accept=".xlsx, .xls"
              onChange={handleAddParticipant}
              className="hidden"
            />
            <input
              type="file"
              ref={bulkInputRef}
              multiple
              accept=".xlsx, .xls"
              onChange={handleBulkUpload}
              className="hidden"
            />

            {/* [+ Add Participant] */}
            <button
              onClick={() => singleInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Tambah satu subjek / file Excel baru ke sesi"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Participant</span>
            </button>

            {/* [Bulk Upload (.xlsx)] */}
            <button
              onClick={() => bulkInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 active:bg-black text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Unggah banyak file Excel sekaligus (.xlsx)"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Bulk Upload</span>
            </button>

            {/* [Export All FormatOutput.xlsx] */}
            <button
              onClick={handleExportAll}
              disabled={participants.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                participants.length > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
              title="Ekspor seluruh subjek ke format standar FormatOutput.xlsx (Stiffness & Gradient Max, Min, Mean, Median & Direction)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export All (FormatOutput.xlsx)</span>
            </button>

            {/* [Download Template] */}
            <button
              onClick={downloadMyotonTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Unduh template Excel resmi NewFormat.xlsx"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Template (NewFormat.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Status Counter Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-800">
              Total Subjek:{' '}
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-900 font-bold">
                {statusCounts.total}
              </span>
            </span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {statusCounts.valid} Sesuai
            </span>
            {statusCounts.warning > 0 && (
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {statusCounts.warning} Peringatan
              </span>
            )}
            {statusCounts.error > 0 && (
              <span className="flex items-center gap-1 text-rose-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {statusCounts.error} Format Rusak
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-400 italic hidden md:inline">
            Tarik & lepas (drag and drop) file Excel (.xlsx) langsung ke area ini
          </span>
        </div>
      </div>

      {/* Main Card List / Accordion (iLovePDF Style) */}
      {participants.length === 0 ? (
        <div
          onClick={() => singleInputRef.current?.click()}
          className="p-12 bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 transition-colors text-center cursor-pointer group space-y-3"
        >
          <div className="w-12 h-12 rounded-full bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center transition-colors">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Belum Ada Subjek Myoton yang Dimuat</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Klik di sini untuk mengunggah file <code>KYLE OCT.xlsx</code> / <code>NewFormat.xlsx</code>, atau gunakan tombol Bulk Upload di atas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {participants.map((p, sIdx) => {
            const isExpanded = expandedId === p.id;
            const analysis = isExpanded ? getProtocolAnalysis(p) : null;
            const currentMethod = aggregationMethods[p.id] || 'mean';
            const currentStage = surfaceStages[p.id] || 'after';

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? 'border-indigo-300 shadow-md ring-1 ring-indigo-200/50'
                    : 'border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Accordion Card Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none bg-white hover:bg-slate-50/60 transition-colors"
                >
                  {/* Left: Index badge & Name */}
                  <div className="flex items-center gap-3.5 min-w-[240px]">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-100 shrink-0">
                      #{sIdx + 1}
                    </div>

                    <div>
                      {editingId === p.id ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editNameText}
                            onChange={(e) => setEditNameText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitRename(p.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="px-2 py-0.5 text-sm font-bold text-slate-900 border border-indigo-400 rounded focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleCommitRename(p.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/title">
                          <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(p.id);
                              setEditNameText(p.name);
                            }}
                            className="opacity-0 group-hover/title:opacity-100 p-0.5 text-slate-400 hover:text-slate-700 rounded transition-opacity"
                            title="Ubah nama subjek"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                        <span>{p.fileName}</span>
                        <span>•</span>
                        <span>{p.protocols?.length || 0} Protokol</span>
                        {p.date && (
                          <>
                            <span>•</span>
                            <span>{p.date}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Validation Badge, Quick Actions & Chevron */}
                  <div className="flex items-center gap-3 ml-auto">
                    {/* Validation Badge */}
                    <FormatStatusBadge
                      validation={p.validation}
                      onClick={(v) => setActiveValidationModal({ validation: v, name: p.name })}
                    />

                    {/* Single Subject Export */}
                    <button
                      onClick={(e) => handleExportSingle(p, e)}
                      className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      title="Ekspor FormatOutput untuk subjek ini"
                    >
                      <FileDown className="w-3.5 h-3.5 text-slate-600" />
                      <span>Excel</span>
                    </button>

                    {/* Delete Subject Button */}
                    <button
                      onClick={(e) => handleDeleteParticipant(p.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus subjek dari sesi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Chevron Expand Indicator */}
                    <div className="p-1 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Accordion Body */}
                {isExpanded && analysis && (
                  <div className="p-5 pt-0 border-t border-slate-100 space-y-5 animate-in slide-in-from-top-2 duration-200">
                    {/* Control Sub-bar: Protocol selector & Estimator switch */}
                    <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
                      {/* Protocol Selection Tabs */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.protocols.map((proto) => {
                          const isActive =
                            (selectedProtocols[p.id] || 1) === proto.protocolNum;
                          return (
                            <button
                              key={proto.protocolNum}
                              onClick={() =>
                                setSelectedProtocols((prev) => ({
                                  ...prev,
                                  [p.id]: proto.protocolNum
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              P{proto.protocolNum}: {proto.frequency} {proto.intensity} ({proto.foot.toUpperCase().includes('LEFT') ? 'L' : 'R'})
                            </button>
                          );
                        })}
                      </div>

                      {/* Triplicate Estimator Switch */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">Estimator:</span>
                        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setAggregationMethods((prev) => ({ ...prev, [p.id]: 'mean' }))
                            }
                            className={`py-1 px-2.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              currentMethod === 'mean'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Arithmetic average: (E1 + E2 + E3) / 3"
                          >
                            Mean (Average)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAggregationMethods((prev) => ({ ...prev, [p.id]: 'median' }))
                            }
                            className={`py-1 px-2.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              currentMethod === 'median'
                                ? 'bg-white text-indigo-700 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                            title="Nilai tengah triplikat: n > min & n < max"
                          >
                            Median (Nilai Tengah)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Active Protocol Pill Summary */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1.5 ${
                            analysis.proto.foot.toUpperCase().includes('LEFT')
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <Footprints className="w-3.5 h-3.5" />
                          {analysis.proto.foot}
                        </span>
                        <span className="font-semibold text-slate-800">
                          Frekuensi:{' '}
                          <span className="font-mono text-indigo-700">
                            {analysis.proto.frequency}
                          </span>
                        </span>
                        <span className="font-semibold text-slate-800">
                          Intensitas:{' '}
                          <span className="font-mono text-amber-700">
                            {analysis.proto.intensity}
                          </span>
                        </span>
                        <span className="font-semibold text-slate-800">
                          Metode:{' '}
                          <span className="font-mono text-emerald-700 font-bold">
                            {currentMethod === 'median'
                              ? 'Median (n > min & n < max)'
                              : 'Mean (Average)'}
                          </span>
                        </span>
                      </div>

                      <button
                        onClick={() => setShowTriplicates(!showTriplicates)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer shadow-2xs"
                      >
                        {showTriplicates ? 'Sembunyikan Triplikat (E1-E3)' : 'Tampilkan Triplikat (E1, E2, E3)'}
                      </button>
                    </div>

                    {/* 4 Metric Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Baseline Stiffness ({currentMethod === 'median' ? 'Median' : 'Mean'})
                        </span>
                        <div className="text-2xl font-black text-slate-900 mt-1">
                          {analysis.overallBe}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Pre-stimulus resting tone</p>
                      </div>

                      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Post-Stimulus ({currentMethod === 'median' ? 'Median' : 'Mean'})
                        </span>
                        <div className="text-2xl font-black text-indigo-600 mt-1">
                          {analysis.overallAf}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Post-stimulation stiffness</p>
                      </div>

                      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {currentMethod === 'median' ? 'Median Δ Stiffness' : 'Mean Δ Stiffness'}
                        </span>
                        <div className="text-2xl font-black text-amber-600 mt-1">
                          {analysis.overallD >= 0 ? `+${analysis.overallD}` : analysis.overallD}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Net dynamic stiffness delta</p>
                      </div>

                      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Tissue Compliance Change
                        </span>
                        <div className="text-2xl font-black text-emerald-600 mt-1">
                          {analysis.overallPct >= 0
                            ? `+${analysis.overallPct}%`
                            : `${analysis.overallPct}%`}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {analysis.overallPct < 0 ? 'Pelemasan jaringan' : 'Pengerasan jaringan'}
                        </p>
                      </div>
                    </div>

                    {/* Side-by-Side Visualizations: 3x3 Heatmap (Left) & 3D Surface Canvas (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                      {/* Left: 3x3 Spatial Heatmap */}
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                        <CompassHeatmap
                          title={`Δ Dynamic Stiffness (${analysis.proto.frequency}) • [${
                            currentMethod === 'median' ? 'Median' : 'Mean'
                          }]`}
                          subtitle={`Spatial 3×3 matrix mapping sites 1 to 9 (${
                            currentMethod === 'median'
                              ? 'Triplicate Middle Value: n>min & n<max'
                              : 'Arithmetic Mean'
                          })`}
                          metricName="Stiffness"
                          unit=""
                          dataCells={analysis.cells}
                          isStiffness={true}
                        />
                      </div>

                      {/* Right: 3D Surface Mesh & Quiver Canvas */}
                      <div className="space-y-2">
                        {/* Stage Selector (Before vs After) */}
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-semibold text-slate-700">
                            3D Surface Projection:
                          </span>
                          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                            <button
                              type="button"
                              onClick={() =>
                                setSurfaceStages((prev) => ({ ...prev, [p.id]: 'before' }))
                              }
                              className={`py-1 px-2.5 rounded font-bold transition-all cursor-pointer ${
                                currentStage === 'before'
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Before Therapy
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setSurfaceStages((prev) => ({ ...prev, [p.id]: 'after' }))
                              }
                              className={`py-1 px-2.5 rounded font-bold transition-all cursor-pointer ${
                                currentStage === 'after'
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              After Therapy
                            </button>
                          </div>
                        </div>

                        {/* Interactive 3D Surface Canvas */}
                        <Myoton3DSurfaceCanvas
                          grid3x3={analysis.grid3x3}
                          title={analysis.proto.name}
                          stageLabel={currentStage === 'after' ? 'After Therapy' : 'Before Therapy'}
                          participantName={p.name}
                          width={640}
                          height={480}
                        />
                      </div>
                    </div>

                    {/* 9-Point Detailed Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs">
                            Data Koordinat 9-Titik Kompas ({analysis.proto.name})
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Estimator aktif: {currentMethod === 'median' ? 'Median (Nilai Tengah: n > min & n < max)' : 'Mean (Average)'}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Titik (#)</th>
                              <th className="py-2.5 px-3">Arah Kompas</th>
                              <th className="py-2.5 px-3">Posisi Grid</th>
                              <th className="py-2.5 px-3 text-right">
                                {currentMethod === 'median' ? 'Stiff Before [Median]' : 'Stiff Before'}
                              </th>
                              <th className="py-2.5 px-3 text-right">
                                {currentMethod === 'median' ? 'Stiff After [Median]' : 'Stiff After'}
                              </th>
                              <th className="py-2.5 px-3 text-right font-bold">
                                {currentMethod === 'median' ? 'Median Δ Stiff' : 'Mean Δ Stiff'}
                              </th>
                              <th className="py-2.5 px-3 text-right font-bold">% Perubahan</th>
                              {showTriplicates && (
                                <>
                                  <th className="py-2.5 px-3 text-right">Triplikat Sebelum [E1, E2, E3]</th>
                                  <th className="py-2.5 px-3 text-right">Triplikat Sesudah [E1, E2, E3]</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {analysis.cells.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2 px-3 font-bold text-slate-900">#{c.id}</td>
                                <td className="py-2 px-3 font-medium text-slate-800 font-sans">
                                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-semibold mr-1 font-mono">
                                    {c.code}
                                  </span>
                                  {c.name}
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  [{c.row + 1}, {c.col + 1}]
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                  {c.stiffBefore}
                                </td>
                                <td className="py-2 px-3 text-right text-indigo-700 font-semibold">
                                  {c.stiffAfter}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-amber-600">
                                  {c.stiffDelta >= 0 ? `+${c.stiffDelta}` : c.stiffDelta}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-emerald-600">
                                  {c.stiffChangePct >= 0 ? `+${c.stiffChangePct}%` : `${c.stiffChangePct}%`}
                                </td>
                                {showTriplicates && (
                                  <>
                                    <td className="py-2 px-3 text-right text-[10px] text-slate-600">
                                      {c.triplicatesBefore ? (
                                        <span>
                                          [{c.triplicatesBefore.join(', ')}]
                                          {currentMethod === 'median' && c.medianBefore !== undefined && (
                                            <span className="ml-1 text-emerald-600 font-bold">
                                              (Mid: {c.medianBefore})
                                            </span>
                                          )}
                                        </span>
                                      ) : '-'}
                                    </td>
                                    <td className="py-2 px-3 text-right text-[10px] text-indigo-600">
                                      {c.triplicatesAfter ? (
                                        <span>
                                          [{c.triplicatesAfter.join(', ')}]
                                          {currentMethod === 'median' && c.medianAfter !== undefined && (
                                            <span className="ml-1 text-emerald-600 font-bold">
                                              (Mid: {c.medianAfter})
                                            </span>
                                          )}
                                        </span>
                                      ) : '-'}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Validation Detail Popover / Modal */}
      {activeValidationModal && (
        <ValidationDetailsModal
          validation={activeValidationModal.validation}
          participantName={activeValidationModal.name}
          onClose={() => setActiveValidationModal(null)}
        />
      )}
    </div>
  );
}
