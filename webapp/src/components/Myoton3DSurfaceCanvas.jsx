import React, { useRef, useEffect, useState } from 'react';
import { Download, RefreshCw, Eye, Maximize2 } from 'lucide-react';

/**
 * Viridis colormap approximation for scientific visualization
 */
function viridisColor(t) {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));
  // High quality 5-point Viridis polynomial approximation
  const r = Math.round(255 * (0.267 + t * (0.005 + t * (2.78 - t * 2.05))));
  const g = Math.round(255 * (0.004 + t * (1.42 + t * (-0.35 - t * 0.07))));
  const b = Math.round(255 * (0.329 + t * (1.33 + t * (-2.68 + t * 1.34))));
  return `rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`;
}

/**
 * Myoton 3D Plantar Tissue Stiffness Surface Mesh Canvas
 * Features:
 * - 3D Surface mesh with Viridis colormap and wireframe edges
 * - Bottom plane contour projections
 * - Gradient vector quiver field (blue arrows indicating gradient direction)
 * - 9 Anatomical compass markers (NW, N, NE, W, C, E, SW, S, SE)
 * - 1-Click PNG Download
 */
export default function Myoton3DSurfaceCanvas({
  grid3x3,
  title = "Protocol 1",
  stageLabel = "After Therapy",
  participantName = "Subject",
  width = 680,
  height = 520
}) {
  const canvasRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid3x3 || grid3x3.length !== 3) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Clear background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 1. Bilinear / Bicubic interpolation of 3x3 to 31x31 dense grid
    const N = 31;
    const Z = [];
    let zMin = Infinity;
    let zMax = -Infinity;

    for (let i = 0; i < N; i++) {
      Z[i] = [];
      const u = (i / (N - 1)) * 2.0; // 0.0 to 2.0 (row in 3x3)
      const r0 = Math.floor(u);
      const r1 = Math.min(2, r0 + 1);
      const fr = u - r0;
      // Smooth Hermite blend
      const hr = fr * fr * (3 - 2 * fr);

      for (let j = 0; j < N; j++) {
        const v = (j / (N - 1)) * 2.0; // 0.0 to 2.0 (col in 3x3)
        const c0 = Math.floor(v);
        const c1 = Math.min(2, c0 + 1);
        const fc = v - c0;
        const hc = fc * fc * (3 - 2 * fc);

        // Bilinear blend of 4 nearest 3x3 nodes
        const v00 = grid3x3[r0][c0] || 0;
        const v01 = grid3x3[r0][c1] || 0;
        const v10 = grid3x3[r1][c0] || 0;
        const v11 = grid3x3[r1][c1] || 0;

        const val = (v00 * (1 - hc) + v01 * hc) * (1 - hr) + (v10 * (1 - hc) + v11 * hc) * hr;
        Z[i][j] = val;
        if (val < zMin) zMin = val;
        if (val > zMax) zMax = val;
      }
    }

    const zSpan = Math.max(1.0, zMax - zMin);
    const zBottom = zMin - zSpan * 0.45;

    // 2. 3D Isometric Projection setup
    // Center of projection
    const cx = W * 0.50;
    const cy = H * 0.54;
    const scaleX = W * 0.013;
    const scaleY = H * 0.0075;
    const scaleZ = (H * 0.38) / zSpan;

    // Rotation angle (~ -55 deg azim, 28 deg elev)
    const cosA = Math.cos(Math.PI / 6.0); // 30 deg
    const sinA = Math.sin(Math.PI / 6.0);

    function project3D(x, y, z) {
      // Map x, y from [0, N-1] centered to [-15, +15]
      const nx = (x - (N - 1) / 2.0) * 1.0;
      const ny = (y - (N - 1) / 2.0) * 1.3;
      const nz = z - zMin;

      // Isometric transformation
      const px = cx + (nx - ny) * cosA * scaleX * 1.7;
      const py = cy + (nx + ny) * sinA * scaleY * 2.1 - nz * scaleZ;
      return [px, py];
    }

    // 3. Render Bottom Plane (Bounding box & Contours)
    const pB00 = project3D(0, 0, zBottom);
    const pB01 = project3D(N - 1, 0, zBottom);
    const pB11 = project3D(N - 1, N - 1, zBottom);
    const pB10 = project3D(0, N - 1, zBottom);

    // Bottom plane base fill
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(pB00[0], pB00[1]);
    ctx.lineTo(pB01[0], pB01[1]);
    ctx.lineTo(pB11[0], pB11[1]);
    ctx.lineTo(pB10[0], pB10[1]);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Bottom contour rings
    const numLevels = 8;
    for (let lev = 1; lev <= numLevels; lev++) {
      const cZ = zMin + (lev / (numLevels + 1)) * zSpan;
      const color = viridisColor(lev / numLevels);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.85;

      // Simple marching squares line segments approximation on bottom plane
      for (let i = 0; i < N - 1; i += 2) {
        for (let j = 0; j < N - 1; j += 2) {
          const v0 = Z[i][j];
          const v1 = Z[i + 1][j + 1];
          if ((v0 <= cZ && v1 >= cZ) || (v0 >= cZ && v1 <= cZ)) {
            const p1 = project3D(j, i, zBottom);
            const p2 = project3D(j + 1, i + 1, zBottom);
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.stroke();
          }
        }
      }
    }

    // 4. Render Bottom Plane Quiver Vectors (Blue Gradient Arrows)
    ctx.strokeStyle = '#0284c7';
    ctx.fillStyle = '#0284c7';
    ctx.lineWidth = 1.0;

    const qStep = 4;
    for (let i = qStep; i < N - qStep; i += qStep) {
      for (let j = qStep; j < N - qStep; j += qStep) {
        // Gradient calculation: central difference
        const gx = (Z[i][j + 1] - Z[i][j - 1]) * 0.5;
        const gy = (Z[i + 1][j] - Z[i - 1][j]) * 0.5;
        const mag = Math.sqrt(gx * gx + gy * gy);

        if (mag > 0.05) {
          const normGx = (gx / mag) * 1.5;
          const normGy = (gy / mag) * 1.5;

          const [x0, y0] = project3D(j, i, zBottom);
          const [x1, y1] = project3D(j + normGx, i + normGy, zBottom);

          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();

          // Arrow head
          const angle = Math.atan2(y1 - y0, x1 - x0);
          const arrowLen = 3.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 - arrowLen * Math.cos(angle - Math.PI / 6), y1 - arrowLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x1 - arrowLen * Math.cos(angle + Math.PI / 6), y1 - arrowLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // 5. Render 3D Surface Polygons (Back to Front painter's order)
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const z00 = Z[i][j];
        const z01 = Z[i][j + 1];
        const z11 = Z[i + 1][j + 1];
        const z10 = Z[i + 1][j];

        const avgZ = (z00 + z01 + z11 + z10) / 4.0;
        const tColor = (avgZ - zMin) / zSpan;

        const p00 = project3D(j, i, z00);
        const p01 = project3D(j + 1, i, z01);
        const p11 = project3D(j + 1, i + 1, z11);
        const p10 = project3D(j, i + 1, z10);

        ctx.fillStyle = viridisColor(tColor);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
        ctx.lineWidth = 0.4;

        ctx.beginPath();
        ctx.moveTo(p00[0], p00[1]);
        ctx.lineTo(p01[0], p01[1]);
        ctx.lineTo(p11[0], p11[1]);
        ctx.lineTo(p10[0], p10[1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 6. Draw 9 Compass Measurement Nodes
    const compassNodes = [
      { id: 1, name: "NW", r: 0, c: 0 },
      { id: 2, name: "N",  r: 0, c: 1 },
      { id: 3, name: "NE", r: 0, c: 2 },
      { id: 4, name: "W",  r: 1, c: 0 },
      { id: 5, name: "C",  r: 1, c: 1 },
      { id: 6, name: "E",  r: 1, c: 2 },
      { id: 7, name: "SW", r: 2, c: 0 },
      { id: 8, name: "S",  r: 2, c: 1 },
      { id: 9, name: "SE", r: 2, c: 2 },
    ];

    compassNodes.forEach(node => {
      // Map 3x3 coords to dense grid coords
      const dj = node.c === 0 ? 0 : node.c === 1 ? Math.floor((N - 1) / 2) : N - 1;
      const di = node.r === 0 ? 0 : node.r === 1 ? Math.floor((N - 1) / 2) : N - 1;
      const val = grid3x3[node.r][node.c] || 0;

      const [px, py] = project3D(dj, di, val);

      // Marker shadow / drop line to bottom plane
      const [bx, by] = project3D(dj, di, zBottom);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.setLineDash([]);

      // Red node circle
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Node label
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(`${node.name}: ${Math.round(val)}`, px, py - 7);
    });

    // 7. Headers & Axis Labels
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.fillText(`${participantName} • ${title}`, 20, 24);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`3D Plantar Tissue Stiffness Surface (${stageLabel}) • Quiver Gradient Direction`, 20, 40);

    // Colorbar on right
    const cbX = W - 35;
    const cbY = 60;
    const cbW = 12;
    const cbH = 140;

    for (let h = 0; h < cbH; h++) {
      const t = 1.0 - h / cbH;
      ctx.fillStyle = viridisColor(t);
      ctx.fillRect(cbX, cbY + h, cbW, 1);
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(cbX, cbY, cbW, cbH);

    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(zMax)}`, cbX - 4, cbY + 8);
    ctx.fillText(`${Math.round(zMin)}`, cbX - 4, cbY + cbH);

    ctx.save();
    ctx.translate(cbX + 22, cbY + cbH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dynamic Stiffness', 0, 0);
    ctx.restore();

  }, [grid3x3, title, stageLabel, participantName, width, height]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${participantName}_${cleanTitle}_${stageLabel.replace(/\s+/g, '_')}_3D_Surface.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Error saving canvas:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs relative">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800">
            3D Plantar Surface Mesh ({stageLabel})
          </span>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
          title="Download high-resolution 3D surface plot (PNG)"
        >
          <Download className="w-3.5 h-3.5 text-slate-600" />
          <span>{downloading ? 'Exporting...' : 'Save 3D PNG'}</span>
        </button>
      </div>

      <div className="flex justify-center overflow-hidden rounded-lg bg-slate-50 border border-slate-200">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="max-w-full h-auto"
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>Mesh: Viridis Colormap • Bottom Quiver: Gradient Flow</span>
        <span>Anatomical Nodes: Red Dots P1-P9</span>
      </div>
    </div>
  );
}
