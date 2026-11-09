import { useEffect, useMemo, useRef, useState } from "react";
import { haversineKm, type LatLng } from "./geo";
import { osrmRoute } from "./route";

type Line = [number, number][];

/** Distância (m) de um ponto até a polilinha e o índice do vértice do segmento mais próximo (projeção plana, ok para a cidade) */
export function nearestOnLine(p: LatLng, line: Line): { dist: number; idx: number } {
  if (line.length === 0) return { dist: Infinity, idx: 0 };
  const kx = 111320 * Math.cos((p.lat * Math.PI) / 180), ky = 110540;
  let best = Infinity, bi = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][1] - p.lng) * kx, ay = (line[i][0] - p.lat) * ky;
    const bx = (line[i + 1][1] - p.lng) * kx, by = (line[i + 1][0] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) { best = d; bi = i; }
  }
  if (line.length === 1) best = haversineKm(p, { lat: line[0][0], lng: line[0][1] }) * 1000;
  return { dist: best, idx: bi };
}

const OFF_ROUTE_M = 70;      // saiu da rota: recalcula
const REFRESH_MS = 30000;    // recalcula a cada 30 s...
const REFRESH_MOVE_M = 100;  // ...se andou mais de 100 m
const MIN_GAP_MS = 8000;     // nunca mais de 1 pedido a cada 8 s
const RETRY_MS = 15000;      // OSRM falhou: tenta de novo depois de 15 s (mantém a última rota)

/**
 * Rota travada até a entrega: posição atual (ou a loja) -> paradas.
 * - Pede o traçado pelas ruas (OSRM) quando as paradas mudam, quando o Ghost sai da rota,
 *   ou a cada ~30 s / 100 m andados. Nada disso é cancelado por re-render ou pela atualização de 20 s dos pedidos.
 * - Se o OSRM falhar, mantém a última rota boa das mesmas paradas; sem nenhuma, desenha linha reta.
 * - A linha mostrada começa sempre na posição atual e "consome" o trecho já percorrido.
 */
export function useRouteLine(pos: LatLng | null, origin: LatLng, stops: LatLng[]) {
  const stopsKey = stops.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
  const [road, setRoad] = useState<{ key: string; line: Line } | null>(null);
  const roadRef = useRef(road);
  roadRef.current = road;
  const inflight = useRef(false);
  const last = useRef<{ at: number; from: LatLng; key: string; ok: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const from = pos ?? origin;
  const fromRef = useRef(from);
  fromRef.current = from;
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  // Reavalia sozinho a cada 10 s (mesmo parado), além de a cada posição nova
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 10000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!stopsKey || inflight.current) return;
    const now = Date.now(), l = last.current, f = fromRef.current, r = roadRef.current;
    const have = r?.key === stopsKey;
    let need: boolean;
    if (!l || l.key !== stopsKey) need = true;                       // paradas novas
    else if (now - l.at < MIN_GAP_MS) need = false;
    else if (!have) need = now - l.at >= RETRY_MS;                    // ainda sem traçado: tenta de novo
    else {
      const off = nearestOnLine(f, r!.line).dist;
      const moved = haversineKm(l.from, f) * 1000;
      need = off > OFF_ROUTE_M || (now - l.at >= REFRESH_MS && moved > REFRESH_MOVE_M) || (!l.ok && now - l.at >= RETRY_MS);
    }
    if (!need) return;
    inflight.current = true;
    const key = stopsKey;
    last.current = { at: now, from: { lat: f.lat, lng: f.lng }, key, ok: false };
    osrmRoute([f, ...stopsRef.current])
      .then((line) => {
        if (last.current?.key === key) last.current.ok = !!line;
        if (line) setRoad({ key, line });    // só troca se veio rota; se falhou, fica a anterior
      })
      .finally(() => { inflight.current = false; });
  }, [from.lat, from.lng, stopsKey, tick]);

  return useMemo(() => {
    if (!stops.length) return { line: [] as Line, straight: true };
    if (road && road.key === stopsKey && road.line.length > 1) {
      const { dist, idx } = nearestOnLine(from, road.line);
      // Na rota: corta o trecho já percorrido. Fora dela: liga a posição ao ponto mais próximo da rota.
      const rest = road.line.slice(dist <= OFF_ROUTE_M ? idx + 1 : idx);
      return { line: [[from.lat, from.lng] as [number, number], ...rest], straight: false };
    }
    return { line: [[from.lat, from.lng] as [number, number], ...stops.map((p) => [p.lat, p.lng] as [number, number])], straight: true };
  }, [road, stopsKey, from.lat, from.lng]); // eslint-disable-line react-hooks/exhaustive-deps
}
