import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { supabase } from "./supabase";
import { haversineKm, type LatLng } from "./geo";
import { ORDER_FIELDS, type AppSettings, type Courier, type DeliveryEvent, type HotZone, type Order } from "./types";

export type Pos = LatLng & { acc: number | null; heading: number | null; speed: number | null; at: number };

/**
 * GPS em primeiro plano (watchPositionAsync) enquanto o app está aberto.
 * Envia courier_ping só quando o Ghost está ONLINE: no máximo a cada 15 s,
 * ou antes (mínimo 5 s) se andou mais de 40 m.
 */
export function usePosition(online: boolean) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [gpsErr, setGpsErr] = useState("");
  const [pingMsg, setPingMsg] = useState("");
  const lastPing = useRef<{ at: number; p: LatLng } | null>(null);
  const onlineRef = useRef(online);
  onlineRef.current = online;

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last && alive) setPos(toPos(last));
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (l) => { setPos(toPos(l)); setGpsErr(""); },
          (e) => setGpsErr(String(e)),
        );
        if (!alive) sub.remove();
      } catch (e) { setGpsErr(String(e)); }
    })();
    return () => { alive = false; sub?.remove(); };
  }, []);

  useEffect(() => {
    if (!pos || !online) return;
    const now = Date.now(), lp = lastPing.current;
    const moved = lp ? haversineKm(lp.p, pos) * 1000 : Infinity;
    if (lp && !(now - lp.at >= 15000 || (moved > 40 && now - lp.at >= 5000))) return;
    lastPing.current = { at: now, p: { lat: pos.lat, lng: pos.lng } };
    supabase.rpc("courier_ping", { p_lat: pos.lat, p_lng: pos.lng, p_accuracy: pos.acc, p_heading: pos.heading, p_speed: pos.speed })
      .then(({ data, error }) => setPingMsg(error ? `Falha ao enviar posição: ${error.message}` : data === "ok" ? "" : String(data)));
  }, [pos, online]);

  // Voltou a ficar online: manda a posição na hora
  useEffect(() => { if (online) lastPing.current = null; }, [online]);

  return { pos, gpsErr, pingMsg };
}

function toPos(l: Location.LocationObject): Pos {
  return { lat: l.coords.latitude, lng: l.coords.longitude, acc: l.coords.accuracy, heading: l.coords.heading, speed: l.coords.speed, at: l.timestamp };
}

/** Entregas do Ghost (as dele + disponíveis, conforme o RLS). Tempo real + atualização a cada 20 s. */
export function useOrders(courier: Courier) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [err, setErr] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select(ORDER_FIELDS)
      .eq("mode", "entrega").in("status", ["recebido", "preparo", "saiu"]).order("created_at");
    if (error) { setErr("Sem conexão: mostrando a última lista."); return; }
    setErr(""); setOrders((data ?? []) as Order[]); setLoadedAt(Date.now());
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel(`fantasma-orders-${courier.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    const t = setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [courier.id, load]);

  useEffect(() => { load(); }, [courier.online, load]);

  return { orders, err, load, loadedAt };
}

/** Posição da loja (settings) */
export function useStore() {
  const [store, setStore] = useState<LatLng | null>(null);
  useEffect(() => {
    supabase.from("settings").select("store_lat, store_lng").eq("id", 1).maybeSingle()
      .then(({ data }) => data && setStore({ lat: data.store_lat, lng: data.store_lng }));
  }, []);
  return store;
}

/** Configurações da loja que o app usa (prêmio do ranking, minutos para o pedido "pulsar"). Atualiza a cada 2 min. */
export function useAppSettings() {
  const [cfg, setCfg] = useState<AppSettings>({ ranking_prize: "", stale_minutes: 8, bonus_per_delivery: 0.25 });
  const load = useCallback(async () => {
    const { data } = await supabase.from("settings").select("ranking_prize, stale_minutes, bonus_per_delivery").eq("id", 1).maybeSingle();
    if (data) setCfg({
      ranking_prize: String(data.ranking_prize ?? ""),
      stale_minutes: Number(data.stale_minutes) > 0 ? Number(data.stale_minutes) : 8,
      bonus_per_delivery: Number(data.bonus_per_delivery ?? 0.25),
    });
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 120000); return () => clearInterval(t); }, [load]);
  return { cfg, reload: load };
}

/** Eventos ativos (rolando agora ou começando nas próximas 24 h, conforme o RLS). Atualiza a cada 60 s. */
export function useEvents() {
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("delivery_events")
      .select("id, title, description, center_lat, center_lng, radius_m, extra_bonus, starts_at, ends_at, active")
      .eq("active", true).order("starts_at");
    if (!error) setEvents((data ?? []).map((e) => ({ ...e, extra_bonus: Number(e.extra_bonus) })) as DeliveryEvent[]);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel("fantasma-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_events" }, () => load())
      .subscribe();
    const t = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [load]);
  return events;
}

/** Áreas de mais saída (grade de ~500 m, sem dados de cliente). Só busca quando ligado; atualiza a cada 3 min. */
export function useHotZones(enabled: boolean) {
  const [zones, setZones] = useState<HotZone[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("courier_hot_zones");
    if (!error) setZones(((data ?? []) as HotZone[]).map((z) => ({ lat: Number(z.lat), lng: Number(z.lng), recent: Number(z.recent), typical: Number(z.typical) })));
  }, []);
  useEffect(() => {
    if (!enabled) return;
    load();
    const t = setInterval(load, 180000);
    return () => clearInterval(t);
  }, [enabled, load]);
  return enabled ? zones : [];
}

/** Relógio que anda a cada `ms` (para contar os minutos de espera dos pedidos) */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
