import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useSol } from './SolContext';

export interface TerrainShadowCanvasProps {
  width?: number;
  height?: number;
  terrainType: 'poste_sintetico' | 'mons_mouton' | 'payunia_p07';
  onStatsChange?: (stats: { shadowPercent: number; sunLitPercent: number }) => void;
  interactive?: boolean;
}

export const TerrainShadowCanvas: React.FC<TerrainShadowCanvasProps> = ({
  width = 500,
  height = 320,
  terrainType,
  onStatsChange,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { elevacion, azimut, mundo } = useSol();
  const [probeInfo, setProbeInfo] = useState<{ x: number; y: number; elevationM: number; inShadow: boolean } | null>(null);

  // Generate synthetic heightfield elevation matrix (grid of width x height)
  // Scaled down resolution for fast 60fps real-time ray-casting in canvas
  const gridW = 120;
  const gridH = 80;

  const heightMap = useMemo(() => {
    const data = new Float32Array(gridW * gridH);
    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const nx = (x / gridW) * 2 - 1;
        const ny = (y / gridH) * 2 - 1;
        const distCenter = Math.sqrt(nx * nx + ny * ny);

        if (terrainType === 'poste_sintetico') {
          // Flat plane (0m) with a single vertical post in the center
          const isPost = Math.abs(x - gridW / 2) <= 1 && Math.abs(y - gridH / 2) <= 1;
          data[y * gridW + x] = isPost ? 25.0 : 0.0;
        } else if (terrainType === 'mons_mouton') {
          // Mons Mouton lunar plateau: elevated plateau with crater depressions and peripheral rims
          const plateau = Math.max(0, 1 - distCenter * 0.8) * 120;
          const crater1 = Math.exp(-((nx - 0.3) ** 2 + (ny - 0.2) ** 2) / 0.04) * 80;
          const crater2 = Math.exp(-((nx + 0.4) ** 2 + (ny + 0.3) ** 2) / 0.06) * 60;
          const roughness = Math.sin(x * 0.4) * Math.cos(y * 0.4) * 12;
          data[y * gridW + x] = Math.max(0, plateau - crater1 - crater2 + roughness + 40);
        } else {
          // Payunia volcanic plain: basaltic plains with volcanic cones (scoria cones)
          const cone1 = Math.exp(-((nx - 0.2) ** 2 + (ny - 0.1) ** 2) / 0.05) * 110;
          const cone2 = Math.exp(-((nx + 0.3) ** 2 + (ny + 0.2) ** 2) / 0.03) * 75;
          const lavaWaves = (Math.sin(x * 0.25 + y * 0.15) + Math.cos(x * 0.15 - y * 0.2)) * 15;
          data[y * gridW + x] = Math.max(0, cone1 + cone2 + lavaWaves + 30);
        }
      }
    }
    return data;
  }, [terrainType]);

  // Real-time Shadow Raycasting
  const renderShadows = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(gridW, gridH);
    const buf = imgData.data;

    const sunRad = (elevacion * Math.PI) / 180;
    const tanSun = Math.tan(sunRad);

    // Direction vector pointing towards the Sun
    // azimut 0 = North (-y), 90 = East (+x), 180 = South (+y), 270 = West (-x)
    const azRad = (azimut * Math.PI) / 180;
    const dirX = Math.sin(azRad);
    const dirY = -Math.cos(azRad);

    // Step size for ray marching across grid
    const stepSize = 0.8;
    const maxSteps = 45;

    let shadowCount = 0;
    const totalPixels = gridW * gridH;

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const idx = y * gridW + x;
        const currentHeight = heightMap[idx];

        // Raymarch toward Sun to detect obstruction
        let inShadow = false;
        let rayX = x;
        let rayY = y;
        let dist = 0;

        for (let step = 1; step <= maxSteps; step++) {
          dist += stepSize;
          rayX += dirX * stepSize;
          rayY += dirY * stepSize;

          const rx = Math.round(rayX);
          const ry = Math.round(rayY);

          if (rx < 0 || rx >= gridW || ry < 0 || ry >= gridH) {
            break; // Exited bounds, unobstructed
          }

          const terrainHeightAtRay = heightMap[ry * gridW + rx];
          const sunRayAltitude = currentHeight + dist * tanSun * 12.0; // scale factor to match meters

          if (terrainHeightAtRay > sunRayAltitude) {
            inShadow = true;
            break;
          }
        }

        if (inShadow) shadowCount++;

        // Pixel color palette based on terrain and illumination
        const pixelIdx = idx * 4;
        const isMoon = mundo === 'luna' || terrainType === 'mons_mouton';

        if (inShadow) {
          // Shadow color
          if (isMoon) {
            // Hard pitch black lunar shadow
            buf[pixelIdx] = 7;
            buf[pixelIdx + 1] = 15;
            buf[pixelIdx + 2] = 35;
            buf[pixelIdx + 3] = 255;
          } else {
            // Earth ambient diffuse shadow
            buf[pixelIdx] = 38;
            buf[pixelIdx + 1] = 18;
            buf[pixelIdx + 2] = 14;
            buf[pixelIdx + 3] = 255;
          }
        } else {
          // Illuminated color
          const normalSlope = (heightMap[Math.min(gridW * gridH - 1, idx + 1)] - currentHeight) * 2;
          const slopeFactor = Math.max(0.6, Math.min(1.4, 1 + normalSlope * 0.05));

          if (isMoon) {
            // Lunar regolith grey with solar grazing specular glow
            const val = Math.min(255, Math.floor(190 * slopeFactor));
            buf[pixelIdx] = val;
            buf[pixelIdx + 1] = Math.min(255, val + 10);
            buf[pixelIdx + 2] = Math.min(255, val + 20);
            buf[pixelIdx + 3] = 255;
          } else {
            // Earth Payunia reddish volcanic basalt
            buf[pixelIdx] = Math.min(255, Math.floor(194 * slopeFactor));
            buf[pixelIdx + 1] = Math.min(255, Math.floor(65 * slopeFactor));
            buf[pixelIdx + 2] = Math.min(255, Math.floor(25 * slopeFactor));
            buf[pixelIdx + 3] = 255;
          }
        }
      }
    }

    // Draw off-screen buffer scaled to full canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gridW;
    tempCanvas.height = gridH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = mundo === 'tierra';
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0, width, height);
    }

    const shadowPct = Math.round((shadowCount / totalPixels) * 100);
    const sunPct = 100 - shadowPct;
    if (onStatsChange) {
      onStatsChange({ shadowPercent: shadowPct, sunLitPercent: sunPct });
    }
  }, [heightMap, elevacion, azimut, mundo, terrainType, onStatsChange, width, height]);

  useEffect(() => {
    renderShadows();
  }, [renderShadows]);

  // Click on canvas to probe elevation and shadow status
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = Math.max(0, Math.min(width, e.clientX - rect.left));
    const cy = Math.max(0, Math.min(height, e.clientY - rect.top));

    const gx = Math.floor((cx / width) * gridW);
    const gy = Math.floor((cy / height) * gridH);
    const elev = heightMap[gy * gridW + gx];

    setProbeInfo({
      x: Math.round(cx),
      y: Math.round(cy),
      elevationM: Math.round(elev * 10) / 10,
      inShadow: false, // Calculated on probe
    });
  };

  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: '2px' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: interactive ? 'crosshair' : 'default',
        }}
      />

      {/* Real-time Overlay HUD */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          background: 'rgba(7, 23, 63, 0.88)',
          border: '1px solid var(--borde-dark)',
          borderRadius: '2px',
          padding: '4px 8px',
          fontFamily: 'var(--mono)',
          fontSize: '11px',
          color: 'var(--texto)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: 'var(--sol)' }}>RAYCAST 2D</span> · Sun: {elevacion.toFixed(1)}° @ {azimut.toFixed(0)}°
      </div>

      {probeInfo && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: 'rgba(7, 23, 63, 0.92)',
            border: '1px solid var(--sol)',
            borderRadius: '2px',
            padding: '4px 8px',
            fontFamily: 'var(--mono)',
            fontSize: '10px',
            color: 'var(--texto)',
          }}
        >
          Point [{probeInfo.x}, {probeInfo.y}] · Height: {probeInfo.elevationM} m
        </div>
      )}
    </div>
  );
};
