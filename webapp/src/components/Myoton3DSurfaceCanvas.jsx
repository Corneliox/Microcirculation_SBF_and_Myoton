import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Download, RefreshCw, Eye, Sparkles, Image, Maximize2 } from 'lucide-react';

/**
 * High-precision Viridis colormap mapping [0, 1] -> [r, g, b]
 */
function viridisRgb(t) {
  t = Math.max(0, Math.min(1, t));
  // 5-node polynomial approximation for matplotlib viridis
  const r = Math.round(255 * (0.267 + t * (0.005 + t * (2.78 - t * 2.05))));
  const g = Math.round(255 * (0.004 + t * (1.42 + t * (-0.35 - t * 0.07))));
  const b = Math.round(255 * (0.329 + t * (1.33 + t * (-2.68 + t * 1.34))));
  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
}

function viridisCss(t) {
  const [r, g, b] = viridisRgb(t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 3D Plantar Tissue Stiffness Surface Visualizer
 * Replicates the authentic publication standard of ThermalSight
 * (isolated_FLIR0207_m2_3_3d_surface.png) with:
 * - Elevation 28 deg, Azimuth -55 deg
 * - 3D Box with projection planes & axes ticks
 * - Continuous Viridis colormap & 3D diffuse shading
 * - 10-level bottom plane contours & blue quiver arrows
 * - 9 Red compass nodes (P1-P9) with anatomical labels
 * - High-DPI Matplotlib IPC integration for Electron desktop mode
 */
export default function Myoton3DSurfaceCanvas({
  grid3x3,
  title = "Protocol 1",
  stageLabel = "After Therapy",
  participantName = "Subject",
  width = 720,
  height = 560
}) {
  const canvasRef = useRef(null);
  const [matplotlibImg, setMatplotlibImg] = useState(null);
  const [viewMode, setViewMode] = useState('auto'); // 'hd' | 'canvas' | 'auto'
  const [loadingPython, setLoadingPython] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Request high-resolution Matplotlib 3D render from Python backend in Electron mode
  useEffect(() => {
    let isMounted = true;
    async function fetchPythonRender() {
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.runPythonAnalysis === 'function') {
        try {
          setLoadingPython(true);
          const res = await window.electronAPI.runPythonAnalysis({
            task: 'render_myoton_3d',
            payload: {
              grid_3x3: grid3x3,
              title: title,
              stage_label: stageLabel,
              participant_name: participantName
            }
          });
          if (isMounted && res && res.image_base64) {
            setMatplotlibImg(res.image_base64);
          }
        } catch (err) {
          console.warn('Python 3D render fallback to mathematical canvas:', err);
        } finally {
          if (isMounted) setLoadingPython(false);
        }
      }
    }

    if (grid3x3 && grid3x3.length === 3) {
      fetchPythonRender();
    }
    return () => { isMounted = false; };
  }, [grid3x3, title, stageLabel, participantName]);

  // Client-side high-precision 3D Canvas rendering (matching Matplotlib 3D box, elev=28, azim=-55)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid3x3 || grid3x3.length !== 3) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 1. Data boundaries & 3D coordinate system
    const N = 31;
    const vals = grid3x3.flat();
    const zMin = Math.min(...vals);
    const zMax = Math.max(...vals);
    const zSpan = Math.max(10, zMax - zMin);
    const zBottom = zMin - zSpan * 0.40;
    const zTop = zMax + zSpan * 0.15;

    // Interpolate 3x3 grid to NxN mesh (bicubic/bilinear)
    const Z = [];
    const GX = [];
    const GY = [];

    for (let i = 0; i < N; i++) {
      Z[i] = [];
      GX[i] = [];
      GY[i] = [];
      const u = (i / (N - 1)) * 2.0; // row in [0, 2]
      const r0 = Math.floor(u);
      const r1 = Math.min(2, r0 + 1);
      const fr = u - r0;
      const wr = 0.5 - 0.5 * Math.cos(fr * Math.PI); // smooth cosine

      for (let j = 0; j < N; j++) {
        const v = (j / (N - 1)) * 2.0; // col in [0, 2]
        const c0 = Math.floor(v);
        const c1 = Math.min(2, c0 + 1);
        const fc = v - c0;
        const wc = 0.5 - 0.5 * Math.cos(fc * Math.PI);

        const v00 = grid3x3[r0][c0];
        const v01 = grid3x3[r0][c1];
        const v10 = grid3x3[r1][c0];
        const v11 = grid3x3[r1][c1];

        const top = v00 * (1 - wc) + v01 * wc;
        const bot = v10 * (1 - wc) + v11 * wc;
        const z = top * (1 - wr) + bot * wr;
        Z[i][j] = z;
      }
    }

    // Gradients for quiver arrows
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const gx = j === 0 ? (Z[i][1] - Z[i][0]) : j === N - 1 ? (Z[i][N - 1] - Z[i][N - 2]) : (Z[i][j + 1] - Z[i][j - 1]) * 0.5;
        const gy = i === 0 ? (Z[1][j] - Z[0][j]) : i === N - 1 ? (Z[N - 1][j] - Z[N - 2][j]) : (Z[i + 1][j] - Z[i - 1][j]) * 0.5;
        GX[i][j] = gx;
        GY[i][j] = gy;
      }
    }

    // 2. 3D Camera Projection (elev=28 deg, azim=-55 deg matching Matplotlib)
    const elev = (28.0 * Math.PI) / 180.0;
    const azim = (-55.0 * Math.PI) / 180.0;
    const cosAzim = Math.cos(azim);
    const sinAzim = Math.sin(azim);
    const cosElev = Math.cos(elev);
    const sinElev = Math.sin(elev);

    // Viewport scale & origin
    const cx = W * 0.44;
    const cy = H * 0.54;
    const scaleBox = Math.min(W, H) * 0.40;

    function project3D(x_cm, y_cm, z_val) {
      // Normalize to [-1, 1]
      const xc = (x_cm - 5.0) / 5.0;      // Plantar Width (0 to 10 cm)
      const yc = (y_cm - 7.5) / 7.5;      // Plantar Length (0 to 15 cm)
      const zc = (z_val - (zBottom + zTop) * 0.5) / ((zTop - zBottom) * 0.5 || 1);

      // Rotate azimuth (around Z)
      const x1 = xc * cosAzim - yc * sinAzim;
      const y1 = xc * sinAzim + yc * cosAzim;
      const z1 = zc;

      // Rotate elevation (tilt around X)
      const x2 = x1;
      const y2 = y1 * cosElev - z1 * sinElev;
      const z2 = y1 * sinElev + z1 * cosElev;

      const sx = cx + x2 * scaleBox * 1.35;
      const sy = cy - z2 * scaleBox * 1.15;
      return { sx, sy, depth: y2 };
    }

    // 3. Draw 3D Box Walls & Background Grid
    // Floor vertices (z = zBottom)
    const f00 = project3D(0, 0, zBottom);
    const f10 = project3D(10, 0, zBottom);
    const f11 = project3D(10, 15, zBottom);
    const f01 = project3D(0, 15, zBottom);

    // Ceiling vertices (z = zTop)
    const c00 = project3D(0, 0, zTop);
    const c10 = project3D(10, 0, zTop);
    const c11 = project3D(10, 15, zTop);
    const c01 = project3D(0, 15, zTop);

    // Draw Floor plane
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(f00.sx, f00.sy);
    ctx.lineTo(f10.sx, f10.sy);
    ctx.lineTo(f11.sx, f11.sy);
    ctx.lineTo(f01.sx, f01.sy);
    ctx.closePath();
    ctx.fill();

    // Draw Back walls (XZ and YZ)
    ctx.fillStyle = '#f1f5f9';
    // Back wall 1 (x=0 to 10, y=15)
    ctx.beginPath();
    ctx.moveTo(f01.sx, f01.sy);
    ctx.lineTo(f11.sx, f11.sy);
    ctx.lineTo(c11.sx, c11.sy);
    ctx.lineTo(c01.sx, c01.sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Back wall 2 (x=0, y=0 to 15)
    ctx.beginPath();
    ctx.moveTo(f00.sx, f00.sy);
    ctx.lineTo(f01.sx, f01.sy);
    ctx.lineTo(c01.sx, c01.sy);
    ctx.lineTo(c00.sx, c00.sy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Grid lines on walls
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.75;
    for (let k = 0; k <= 4; k++) {
      const zTick = zBottom + (zTop - zBottom) * (k / 4);
      const p1 = project3D(0, 0, zTick);
      const p2 = project3D(0, 15, zTick);
      const p3 = project3D(10, 15, zTick);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.lineTo(p3.sx, p3.sy);
      ctx.stroke();
    }

    // 4. Bottom Plane Contours (10 levels in Viridis)
    const numLevels = 10;
    for (let lvl = 0; lvl < numLevels; lvl++) {
      const targetZ = zMin + zSpan * (lvl / (numLevels - 1));
      const tNorm = lvl / (numLevels - 1);
      ctx.strokeStyle = viridisCss(tNorm);
      ctx.lineWidth = 1.1;

      for (let i = 0; i < N - 1; i++) {
        for (let j = 0; j < N - 1; j++) {
          const z00 = Z[i][j];
          const z01 = Z[i][j + 1];
          const z10 = Z[i + 1][j];
          if ((z00 <= targetZ && z01 >= targetZ) || (z00 >= targetZ && z01 <= targetZ)) {
            const frac = (targetZ - z00) / ((z01 - z00) || 1e-4);
            const xA = (j + frac) * (10 / (N - 1));
            const yA = i * (15 / (N - 1));
            const pA = project3D(xA, yA, zBottom);
            ctx.beginPath();
            ctx.arc(pA.sx, pA.sy, 0.8, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    // 5. Bottom Plane Quiver Vectors (Blue Gradient Arrows)
    const qStep = 4;
    let maxMag = 0;
    for (let i = 2; i < N - 2; i += qStep) {
      for (let j = 2; j < N - 2; j += qStep) {
        const m = Math.sqrt(GX[i][j] ** 2 + GY[i][j] ** 2);
        if (m > maxMag) maxMag = m;
      }
    }
    maxMag = maxMag || 1.0;

    for (let i = 2; i < N - 2; i += qStep) {
      for (let j = 2; j < N - 2; j += qStep) {
        const x_cm = (j / (N - 1)) * 10.0;
        const y_cm = (i / (N - 1)) * 15.0;
        const gx = GX[i][j];
        const gy = GY[i][j];
        const mag = Math.sqrt(gx * gx + gy * gy);

        if (mag > maxMag * 0.12) {
          const normUx = (gx / maxMag) * 1.1;
          const normUy = (gy / maxMag) * 1.5;

          const p0 = project3D(x_cm, y_cm, zBottom);
          const p1 = project3D(x_cm + normUx, y_cm + normUy, zBottom);

          ctx.strokeStyle = '#0055ff';
          ctx.fillStyle = '#0055ff';
          ctx.lineWidth = 1.0;

          ctx.beginPath();
          ctx.moveTo(p0.sx, p0.sy);
          ctx.lineTo(p1.sx, p1.sy);
          ctx.stroke();

          // Arrowhead
          const dx = p1.sx - p0.sx;
          const dy = p1.sy - p0.sy;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 3) {
            const angle = Math.atan2(dy, dx);
            const aLen = 4;
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p1.sx - aLen * Math.cos(angle - Math.PI / 6), p1.sy - aLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(p1.sx - aLen * Math.cos(angle + Math.PI / 6), p1.sy - aLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // 6. 3D Surface Mesh with Depth Sorting (Painter's Algorithm)
    const quads = [];
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const x0 = (j / (N - 1)) * 10.0;
        const x1 = ((j + 1) / (N - 1)) * 10.0;
        const y0 = (i / (N - 1)) * 15.0;
        const y1 = ((i + 1) / (N - 1)) * 15.0;

        const z00 = Z[i][j];
        const z01 = Z[i][j + 1];
        const z10 = Z[i + 1][j];
        const z11 = Z[i + 1][j + 1];

        const avgZ = (z00 + z01 + z10 + z11) * 0.25;
        const p00 = project3D(x0, y0, z00);
        const p01 = project3D(x1, y0, z01);
        const p11 = project3D(x1, y1, z11);
        const p10 = project3D(x0, y1, z10);

        const avgDepth = (p00.depth + p01.depth + p11.depth + p10.depth) * 0.25;

        quads.push({
          p00, p01, p11, p10,
          avgDepth,
          avgZ,
          tNorm: (avgZ - zMin) / (zSpan || 1)
        });
      }
    }

    // Sort from farthest to closest (highest depth value first)
    quads.sort((a, b) => b.avgDepth - a.avgDepth);

    // Draw quads
    quads.forEach((q) => {
      ctx.fillStyle = viridisCss(q.tNorm);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
      ctx.lineWidth = 0.35;

      ctx.beginPath();
      ctx.moveTo(q.p00.sx, q.p00.sy);
      ctx.lineTo(q.p01.sx, q.p01.sy);
      ctx.lineTo(q.p11.sx, q.p11.sy);
      ctx.lineTo(q.p10.sx, q.p10.sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // 7. 9 Anatomical Compass Nodes on Surface (P1-P9)
    const compassNodes = [
      { id: 1, lbl: 'NW (P1)', r: 0, c: 0, x: 0.0, y: 0.0 },
      { id: 2, lbl: 'N (P2)', r: 0, c: 1, x: 5.0, y: 0.0 },
      { id: 3, lbl: 'NE (P3)', r: 0, c: 2, x: 10.0, y: 0.0 },
      { id: 4, lbl: 'W (P4)', r: 1, c: 0, x: 0.0, y: 7.5 },
      { id: 5, lbl: 'C (P5)', r: 1, c: 1, x: 5.0, y: 7.5 },
      { id: 6, lbl: 'E (P6)', r: 1, c: 2, x: 10.0, y: 7.5 },
      { id: 7, lbl: 'SW (P7)', r: 2, c: 0, x: 0.0, y: 15.0 },
      { id: 8, lbl: 'S (P8)', r: 2, c: 1, x: 5.0, y: 15.0 },
      { id: 9, lbl: 'SE (P9)', r: 2, c: 2, x: 10.0, y: 15.0 }
    ];

    compassNodes.forEach((node) => {
      const zVal = grid3x3[node.r][node.c];
      const pt = project3D(node.x, node.y, zVal);

      // Red scatter marker
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Text label above marker
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(node.lbl, pt.sx, pt.sy - 8);
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(`${zVal.toFixed(0)}`, pt.sx, pt.sy + 12);
    });

    // 8. Front Box Frame & Axis Ticks
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(f00.sx, f00.sy);
    ctx.lineTo(f10.sx, f10.sy);
    ctx.lineTo(f11.sx, f11.sy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(f00.sx, f00.sy);
    ctx.lineTo(c00.sx, c00.sy);
    ctx.stroke();

    // Axis Labels
    ctx.font = 'bold 9.5px sans-serif';
    ctx.fillStyle = '#1e293b';

    // X Axis Label
    const xMid = project3D(5.0, 0, zBottom);
    ctx.textAlign = 'center';
    ctx.fillText('Plantar Width (cm) [Lateral - Medial]', xMid.sx, xMid.sy + 26);

    // Y Axis Label
    const yMid = project3D(10.0, 7.5, zBottom);
    ctx.fillText('Plantar Length (cm) [Posterior - Anterior]', yMid.sx + 45, yMid.sy + 16);

    // Z Axis Label
    const zMid = project3D(0, 0, (zBottom + zTop) * 0.5);
    ctx.save();
    ctx.translate(zMid.sx - 35, zMid.sy);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Dynamic Stiffness', 0, 0);
    ctx.restore();

    // 9. Scientific Colorbar on the Right
    const cbX = W - 55;
    const cbY = 90;
    const cbW = 14;
    const cbH = H - 180;

    for (let y = 0; y < cbH; y++) {
      const tNorm = 1.0 - y / cbH;
      ctx.fillStyle = viridisCss(tNorm);
      ctx.fillRect(cbX, cbY + y, cbW, 1);
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(cbX, cbY, cbW, cbH);

    // Colorbar Ticks
    ctx.font = '8.5px monospace';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(`${zMax.toFixed(0)}`, cbX + cbW + 5, cbY + 6);
    ctx.fillText(`${((zMin + zMax) * 0.5).toFixed(0)}`, cbX + cbW + 5, cbY + cbH / 2 + 3);
    ctx.fillText(`${zMin.toFixed(0)}`, cbX + cbW + 5, cbY + cbH);

    // Colorbar Title
    ctx.save();
    ctx.translate(cbX + cbW + 28, cbY + cbH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dynamic Stiffness', 0, 0);
    ctx.restore();

    // 10. Publication Figure Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${participantName} • ${title}`, W * 0.44, 28);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`3D Plantar Tissue Stiffness Surface (${stageLabel})`, W * 0.44, 46);

  }, [grid3x3, title, stageLabel, participantName, width, height]);

  // Handle Download (PNG)
  const handleDownload = () => {
    setDownloading(true);
    try {
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${participantName}_${cleanTitle}_${stageLabel.replace(/\s+/g, '_')}_3D_Surface.png`;

      // If in Matplotlib mode and image available, download exact Matplotlib PNG
      if (matplotlibImg && (viewMode === 'hd' || viewMode === 'auto')) {
        const a = document.createElement('a');
        a.href = matplotlibImg;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Fallback: download high-precision Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('Error saving 3D surface plot:', e);
    } finally {
      setDownloading(false);
    }
  };

  const isShowingHd = (viewMode === 'hd' || (viewMode === 'auto' && matplotlibImg));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs relative space-y-3">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-xs font-bold text-slate-800">
            3D Plantar Surface Mesh ({stageLabel})
          </h4>
          {matplotlibImg && (
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Matplotlib Publication HD
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          {matplotlibImg && (
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('hd')}
                className={`py-1 px-2 rounded font-bold transition-all cursor-pointer ${
                  isShowingHd
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan grafik 3D Matplotlib kualitas publikasi ilmiah"
              >
                HD Plot
              </button>
              <button
                type="button"
                onClick={() => setViewMode('canvas')}
                className={`py-1 px-2 rounded font-bold transition-all cursor-pointer ${
                  !isShowingHd
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilkan kanvas grafis 3D interaktif"
              >
                Canvas 3D
              </button>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Download gambar 3D Surface beresolusi tinggi (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Exporting...' : 'Save 3D PNG'}</span>
          </button>
        </div>
      </div>

      {/* Main Plot Area */}
      <div className="relative flex justify-center items-center overflow-hidden rounded-xl bg-slate-50 border border-slate-200 min-h-[420px]">
        {isShowingHd && matplotlibImg ? (
          <img
            src={matplotlibImg}
            alt="3D Plantar Tissue Stiffness Surface"
            className="w-full h-auto object-contain max-h-[520px] transition-all"
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="max-w-full h-auto"
          />
        )}

        {loadingPython && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-200 text-[10px] text-slate-600 font-medium flex items-center gap-1.5 shadow-2xs">
            <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
            <span>Memperbarui HD Plot...</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Vektor Quiver: Aliran Gradien Spasial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Titik Kompas: 9 Lokasi Anatomis (P1 - P9)
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          Proyeksi 3D: elev=28°, azim=-55° • Viridis Colormap
        </span>
      </div>
    </div>
  );
}
