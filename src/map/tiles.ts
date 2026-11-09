import { Directory, File, Paths } from "expo-file-system";
import { BBOX } from "../lib/geo";

/**
 * Mapa offline: baixa UMA VEZ os tiles do OpenStreetMap da caixa Aquidauana + Anastácio
 * (zoom 12 a 16) para o armazenamento do app. O mapa (Leaflet dentro do WebView) lê os
 * arquivos locais e, se faltar algum, cai para o tile online.
 *
 * Política de uso dos tiles do OSM (https://operations.osmfoundation.org/policies/tiles/):
 * User-Agent identificando o app, no máximo 2 conexões, sem baixar zoom 17+ em massa,
 * e atribuição "© OpenStreetMap" visível no mapa.
 */
export const MIN_Z = 12;
export const MAX_Z = 16;
export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const USER_AGENT = "Fantasma/1.0 (app de entregas Acai Mania, Aquidauana-MS; +https://acai-mania-iota.vercel.app)";
const WORKERS = 2;          // conexões simultâneas (limite da política do OSM)
const PAUSE_MS = 120;       // pausa entre downloads de cada conexão

/** Pasta raiz do mapa: <documentos>/fantasma-map  (map.html + tiles/z/x/y.png + pack.json) */
export const mapRoot = () => new Directory(Paths.document, "fantasma-map");
const tilesRoot = () => new Directory(mapRoot(), "tiles");
const packFile = () => new File(mapRoot(), "pack.json");

function lng2x(lng: number, z: number) { return Math.floor(((lng + 180) / 360) * 2 ** z); }
function lat2y(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

export type Tile = { z: number; x: number; y: number };
export function listTiles(): Tile[] {
  const out: Tile[] = [];
  for (let z = MIN_Z; z <= MAX_Z; z++) {
    const x0 = lng2x(BBOX.west, z), x1 = lng2x(BBOX.east, z);
    const y0 = lat2y(BBOX.north, z), y1 = lat2y(BBOX.south, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ z, x, y });
  }
  return out;
}
/** Total de tiles do pacote (871 com a caixa e zooms atuais) */
export const TILE_COUNT = listTiles().length;

export type PackInfo = { tiles: number; total: number; bytes: number; at: string } | null;

export function readPack(): PackInfo {
  try {
    const f = packFile();
    if (!f.exists) return null;
    return JSON.parse(f.textSync());
  } catch { return null; }
}

function ensureDir(d: Directory) { if (!d.exists) d.create({ intermediates: true, idempotent: true }); }

let cancelFlag = false;
export function cancelDownload() { cancelFlag = true; }

/**
 * Baixa os tiles que ainda não existem. onProgress(feitos, total). Retorna o resumo.
 * Pode ser interrompido e retomado: tiles já salvos são pulados.
 */
export async function downloadPack(onProgress: (done: number, total: number, failed: number) => void): Promise<PackInfo> {
  cancelFlag = false;
  ensureDir(mapRoot()); ensureDir(tilesRoot());
  const tiles = listTiles();
  let i = 0, done = 0, failed = 0, bytes = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function worker() {
    while (!cancelFlag) {
      const t = tiles[i++];
      if (!t) return;
      const dir = new Directory(tilesRoot(), String(t.z), String(t.x));
      const file = new File(dir, `${t.y}.png`);
      try {
        if (file.exists && (file.size ?? 0) > 0) { bytes += file.size ?? 0; }
        else {
          ensureDir(dir);
          const url = TILE_URL.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y));
          const got = await File.downloadFileAsync(url, file, { headers: { "User-Agent": USER_AGENT }, idempotent: true });
          bytes += got.size ?? 0;
          await sleep(PAUSE_MS);
        }
      } catch {
        failed++;
        try { if (file.exists) file.delete(); } catch { /* ignora */ }
        await sleep(1000); // servidor recusou/sem rede: espera antes de seguir
      }
      done++;
      onProgress(done, tiles.length, failed);
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  const info = { tiles: done - failed, total: tiles.length, bytes, at: new Date().toISOString() };
  if (done - failed > 0) { const f = packFile(); if (!f.exists) f.create(); f.writeSync(JSON.stringify(info)); }
  return info;
}

export function deletePack() {
  const d = tilesRoot();
  if (d.exists) d.delete();
  const f = packFile();
  if (f.exists) f.delete();
}
