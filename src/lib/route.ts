import type { LatLng } from "./geo";

/**
 * Traçado pelas ruas usando o servidor público do OSRM (só com internet; servidor de demonstração,
 * sem garantia). Se falhar, quem chama desenha linhas retas entre as paradas.
 */
export async function osrmRoute(points: LatLng[], signal?: AbortSignal): Promise<[number, number][] | null> {
  if (points.length < 2 || points.length > 25) return null;
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
      signal: ctrl.signal, headers: { "User-Agent": "Fantasma/1.0 (entregas Aquidauana-MS)" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const line: [number, number][] | undefined = j?.routes?.[0]?.geometry?.coordinates;
    return line?.length ? line.map(([lng, lat]) => [lat, lng]) : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

export function googleMapsUrl(lat: number | null, lng: number | null, address: string) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}
export function wazeUrl(lat: number | null, lng: number | null, address: string) {
  return lat != null && lng != null ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}
export function waUrl(phone: string) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d && !d.startsWith("55")) d = `55${d}`;
  return `https://wa.me/${d}`;
}
