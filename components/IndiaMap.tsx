"use client";

import { useEffect, useId, useMemo, useState } from "react";

// Normalize state names so "Andaman & Nicobar Islands" (answers)
// matches "Andaman and Nicobar Islands" (map data).
export function normState(s: string): string {
  return String(s || "")
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

type Ring = number[][];
type Feature = {
  type: "Feature";
  properties: { state: string };
  geometry:
    | { type: "Polygon"; coordinates: Ring[] }
    | { type: "MultiPolygon"; coordinates: Ring[][] };
};
type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };

type StateGeom = {
  name: string;      // original map name
  key: string;       // normalized
  d: string;         // svg path
  bbox: { x: number; y: number; w: number; h: number };
  labelX: number;
  labelY: number;
};

type Highlight = { state: string; kind: "wrong" | "correct" } | null;

const TARGET_H = 920;
const PAD = 20;

function buildGeom(geo: FeatureCollection): { states: StateGeom[]; vbW: number; vbH: number } {
  // midpoint latitude for a simple aspect-correct projection
  let latSum = 0,
    latN = 0,
    minLng = Infinity,
    maxLng = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity;

  const eachRing = (f: Feature, cb: (ring: Ring) => void) => {
    if (f.geometry.type === "Polygon") f.geometry.coordinates.forEach(cb);
    else f.geometry.coordinates.forEach((poly) => poly.forEach(cb));
  };

  geo.features.forEach((f) =>
    eachRing(f, (ring) =>
      ring.forEach(([lng, lat]) => {
        latSum += lat;
        latN++;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      })
    )
  );

  const midLat = (latSum / Math.max(latN, 1)) * (Math.PI / 180);
  const kx = Math.cos(midLat); // horizontal squeeze so shapes aren't stretched

  const projX = (lng: number) => lng * kx;
  const pxMin = projX(minLng);
  const pxMax = projX(maxLng);

  const scale = (TARGET_H - 2 * PAD) / (maxLat - minLat);
  const vbH = TARGET_H;
  const vbW = (pxMax - pxMin) * scale + 2 * PAD;

  const toXY = (lng: number, lat: number): [number, number] => {
    const x = PAD + (projX(lng) - pxMin) * scale;
    const y = PAD + (maxLat - lat) * scale; // flip Y for screen
    return [x, y];
  };

  const states: StateGeom[] = geo.features.map((f) => {
    let d = "";
    let minx = Infinity,
      miny = Infinity,
      maxx = -Infinity,
      maxy = -Infinity;

    // track the largest ring to place the label
    let bestRing: [number, number][] = [];
    let bestLen = -1;

    const addRing = (ring: Ring) => {
      const pts: [number, number][] = ring.map(([lng, lat]) => toXY(lng, lat));
      if (pts.length > bestLen) {
        bestLen = pts.length;
        bestRing = pts;
      }
      pts.forEach(([x, y], i) => {
        d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
      });
      d += "Z ";
    };

    if (f.geometry.type === "Polygon") f.geometry.coordinates.forEach(addRing);
    else f.geometry.coordinates.forEach((poly) => poly.forEach(addRing));

    // label = average of the largest ring's vertices
    let lx = 0,
      ly = 0;
    bestRing.forEach(([x, y]) => {
      lx += x;
      ly += y;
    });
    lx /= Math.max(bestRing.length, 1);
    ly /= Math.max(bestRing.length, 1);

    return {
      name: f.properties.state,
      key: normState(f.properties.state),
      d,
      bbox: { x: minx, y: miny, w: maxx - minx, h: maxy - miny },
      labelX: lx,
      labelY: ly,
    };
  });

  return { states, vbW, vbH };
}

export default function IndiaMap({
  filled,
  highlight,
  className,
}: {
  filled: Record<string, string[]>; // normalized state -> image urls
  highlight: Highlight;
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const [geo, setGeo] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/india-states.json")
      .then((r) => r.json())
      .then((d: FeatureCollection) => {
        if (alive) setGeo(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const model = useMemo(() => (geo ? buildGeom(geo) : null), [geo]);

  if (!model) {
    return (
      <div className={className}>
        <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
          Loading map…
        </div>
      </div>
    );
  }

  const hlKey = highlight ? normState(highlight.state) : null;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${model.vbW.toFixed(0)} ${model.vbH.toFixed(0)}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        {/* clip paths, one per state */}
        <defs>
          {model.states.map((s, i) => (
            <clipPath id={`clip-${uid}-${i}`} key={`c${i}`}>
              <path d={s.d} />
            </clipPath>
          ))}
        </defs>

        {/* base state shapes (these are the drop targets) */}
        {model.states.map((s, i) => {
          const isFilled = (filled[s.key]?.length ?? 0) > 0;
          const isWrong = hlKey === s.key && highlight?.kind === "wrong";
          let fill = "#e9eef5";
          if (isFilled) fill = "#ffffff";
          if (isWrong) fill = "#ef4444";
          return (
            <path
              key={`p${i}`}
              d={s.d}
              data-state={s.name}
              fill={fill}
              fillRule="evenodd"
              stroke="#64748b"
              strokeWidth={0.7}
              style={{ pointerEvents: "all", transition: "fill 0.2s" }}
            />
          );
        })}

        {/* images clipped into each filled state, tiled if more than one */}
        {model.states.map((s, i) => {
          const imgs = filled[s.key] || [];
          if (imgs.length === 0) return null;
          const n = imgs.length;
          const cols = Math.ceil(Math.sqrt(n));
          const rows = Math.ceil(n / cols);
          const cw = s.bbox.w / cols;
          const ch = s.bbox.h / rows;
          return (
            <g
              key={`g${i}`}
              clipPath={`url(#clip-${uid}-${i})`}
              style={{ pointerEvents: "none" }}
            >
              {imgs.map((url, k) => {
                const col = k % cols;
                const row = Math.floor(k / cols);
                return (
                  <image
                    key={k}
                    href={url}
                    x={s.bbox.x + col * cw}
                    y={s.bbox.y + row * ch}
                    width={cw}
                    height={ch}
                    preserveAspectRatio="xMidYMid slice"
                  />
                );
              })}
            </g>
          );
        })}

        {/* green flash overlay when a state is freshly correct */}
        {model.states.map((s, i) => {
          const isCorrect = hlKey === s.key && highlight?.kind === "correct";
          if (!isCorrect) return null;
          return (
            <path
              key={`ok${i}`}
              d={s.d}
              fill="#22c55e"
              fillRule="evenodd"
              style={{ pointerEvents: "none", opacity: 0.55 }}
            />
          );
        })}

        {/* state name labels */}
        {model.states.map((s, i) => {
          const fontSize = Math.max(8, Math.min(15, s.bbox.w / 7));
          return (
            <text
              key={`t${i}`}
              x={s.labelX}
              y={s.labelY}
              fontSize={fontSize}
              textAnchor="middle"
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth={2.4}
              paintOrder="stroke"
              style={{ pointerEvents: "none", fontWeight: 600 }}
            >
              {s.name}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
