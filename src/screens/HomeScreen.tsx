import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { C, brl } from "../lib/theme";
import { AQUIDAUANA, haversineKm, km, nearestNeighbor, type LatLng } from "../lib/geo";
import { useAppSettings, useEvents, useHotZones, useNow, usePosition, useOrders, useStore } from "../lib/hooks";
import { googleMapsUrl, waUrl, wazeUrl } from "../lib/route";
import { useRouteLine } from "../lib/useRouteLine";
import type { Courier, DeliveryEvent, Order } from "../lib/types";
import { avatarSource } from "../lib/ghosts";
import { GHOST_THUMBS } from "../map/ghostThumbs";
import { MapWebView, type MapData, type MapEvent, type MapHandle, type MapHeat, type MapPin } from "../map/MapWebView";

type Props = {
  courier: Courier;
  hasPack: boolean;
  onOpenProfile: () => void;
  onOpenRanking: () => void;
  setOnline: (on: boolean) => Promise<string | null>;
};

const STATUS: Record<string, string> = { recebido: "Recebido", preparo: "Em preparo", saiu: "A caminho" };
const code = (c: string) => `#${String(c || "").toUpperCase()}`;
const cityAddr = (o: Order) => [o.address, o.neighborhood, "Aquidauana - MS"].filter(Boolean).join(", ");
const geo = (o: Order): LatLng | null => (o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const sameDay = (iso: string, now: number) => new Date(iso).toDateString() === new Date(now).toDateString();
/** Minutos que o pedido está esperando (desde a criação) */
const waitMin = (o: Order, now: number) => Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 60000));
/** 0 = normal; 1, 2, 3 = esperando 1x, 2x, 3x o limite (pulso mais forte) */
const pulseLevel = (wait: number, stale: number) => (wait < stale ? 0 : Math.min(3, Math.floor(wait / stale)));
const HEAT_KEY = "fantasma-heat-on";

export function HomeScreen({ courier, hasPack, onOpenProfile, onOpenRanking, setOnline }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelW = Math.min(360, Math.round(width * 0.86));
  const { pos, gpsErr, pingMsg } = usePosition(courier.online);
  const { orders, err, load } = useOrders(courier);
  const store = useStore();
  const { cfg } = useAppSettings();
  const events = useEvents();
  const now = useNow(30000);
  const [heatOn, setHeatOn] = useState(true);
  useEffect(() => { AsyncStorage.getItem(HEAT_KEY).then((v) => { if (v === "0") setHeatOn(false); }); }, []);
  const toggleHeat = () => setHeatOn((h) => { AsyncStorage.setItem(HEAT_KEY, h ? "0" : "1"); return !h; });
  const zones = useHotZones(heatOn);
  const liveEvents = useMemo(() => events.filter((e) => new Date(e.starts_at).getTime() <= now && new Date(e.ends_at).getTime() > now), [events, now]);
  const nextEvents = useMemo(() => events.filter((e) => new Date(e.starts_at).getTime() > now), [events, now]);
  const map = useRef<MapHandle>(null);
  const [open, setOpen] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => { Animated.timing(slide, { toValue: open ? 1 : 0, duration: 220, useNativeDriver: true }).start(); }, [open, slide]);

  const mine = useMemo(() => orders.filter((o) => o.courier_id === courier.id), [orders, courier.id]);
  const avail = useMemo(() => (courier.online ? orders.filter((o) => o.courier_id == null) : []), [orders, courier.online, courier.id]);

  // Âncora da rota: só muda se andou > 100 m ou passaram 30 s (evita recalcular a cada passo)
  const [anchor, setAnchor] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!pos) return;
    setAnchor((a) => {
      if (!a) return { lat: pos.lat, lng: pos.lng };
      return haversineKm(a, pos) > 0.1 ? { lat: pos.lat, lng: pos.lng } : a;
    });
  }, [pos]);
  const posRef = useRef(pos);
  posRef.current = pos;
  useEffect(() => {
    const t = setInterval(() => { const p = posRef.current; if (p) setAnchor({ lat: p.lat, lng: p.lng }); }, 30000);
    return () => clearInterval(t);
  }, []);

  const start: LatLng = anchor ?? store ?? AQUIDAUANA;
  const route = useMemo(() => nearestNeighbor(start, mine, geo), [start.lat, start.lng, mine]); // eslint-disable-line react-hooks/exhaustive-deps
  const availSorted = useMemo(() => avail
    .map((o) => { const wait = waitMin(o, now); return { o, d: geo(o) ? haversineKm(start, geo(o)!) : null, wait, pulse: pulseLevel(wait, cfg.stale_minutes) }; })
    .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)), [avail, start.lat, start.lng, now, cfg.stale_minutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rota travada até a entrega: posição atual -> (loja, se ainda falta coletar) -> paradas na ordem.
  // Atualiza conforme o Ghost anda (useRouteLine); a atualização de 20 s dos pedidos não apaga a linha.
  const needsPickup = mine.some((o) => !o.status_times?.coletado);
  const routeStops = useMemo<LatLng[]>(() => {
    const pts = route.stops.map((s) => geo(s.item)).filter(Boolean) as LatLng[];
    return pts.length && needsPickup && store ? [store, ...pts] : pts;
  }, [route, needsPickup, store]);
  const routeLine = useRouteLine(pos ? { lat: pos.lat, lng: pos.lng } : null, start, routeStops);
  const [follow, setFollow] = useState(false);

  const mapData = useMemo<MapData>(() => {
    const pins: MapPin[] = [];
    if (store) pins.push({ id: "store", lat: store.lat, lng: store.lng, n: "", label: "Loja", kind: "store" });
    route.stops.forEach((s, i) => { const g = geo(s.item); if (g) pins.push({ id: s.item.id, ...g, n: String(i + 1), label: `${i + 1}. ${s.item.customer_name}`, kind: "stop" }); });
    availSorted.forEach(({ o, wait, pulse }) => {
      const g = geo(o);
      if (g) pins.push({ id: o.id, ...g, n: "+", kind: "avail", pulse, wait,
        label: `Disponível · ${o.neighborhood ?? o.customer_name}${pulse ? ` · esperando há ${wait} min` : ""}` });
    });
    const evs: MapEvent[] = liveEvents.map((e) => ({ id: e.id, lat: e.center_lat, lng: e.center_lng, r: e.radius_m, title: e.title, extra: `+${brl(e.extra_bonus)}` }));
    const maxScore = Math.max(1, ...zones.map((z) => z.recent + z.typical));
    const heat: MapHeat[] = zones.map((z) => ({ lat: z.lat, lng: z.lng, w: (z.recent + z.typical) / maxScore }));
    return { me: pos ? { lat: pos.lat, lng: pos.lng } : null, pins, route: routeLine.line, routeStraight: routeLine.straight, events: evs, heat, follow };
  }, [pos?.lat, pos?.lng, route, availSorted, store, routeLine, liveEvents, zones, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  const meImg = courier.avatar_url || GHOST_THUMBS[courier.ghost_avatar ?? "classic"] || GHOST_THUMBS.classic;
  const meFallback = GHOST_THUMBS[courier.ghost_avatar ?? "classic"] || GHOST_THUMBS.classic;
  const showEvent = (e: DeliveryEvent) => {
    map.current?.focus(e.center_lat, e.center_lng, e.radius_m);
    const live = new Date(e.starts_at).getTime() <= Date.now();
    Alert.alert(`🎉 ${e.title}`, [
      `+${brl(e.extra_bonus)} por entrega dentro da área destacada (raio de ${km(e.radius_m / 1000)}).`,
      live ? `Vale até ${hhmm(e.ends_at)}${sameDay(e.ends_at, Date.now()) ? "" : ` de ${new Date(e.ends_at).toLocaleDateString("pt-BR")}`}.` : `Começa às ${hhmm(e.starts_at)} e vai até ${hhmm(e.ends_at)}.`,
      e.description,
    ].filter(Boolean).join("\n\n"));
  };

  async function step(o: Order, s: "coletado" | "entregue") {
    setBusyId(o.id);
    const { data, error } = await supabase.rpc("courier_app_step", { order_id: o.id, p_step: s });
    setBusyId(null);
    if (error || data !== "ok") Alert.alert("Não deu certo", error?.message ?? String(data));
    load();
  }
  async function claim(o: Order) {
    setBusyId(o.id);
    const { data, error } = await supabase.rpc("courier_claim", { order_id: o.id });
    setBusyId(null);
    if (error || data !== "ok") Alert.alert("Não deu para pegar", error?.message ?? String(data));
    load();
  }
  const confirmDelivered = (o: Order) => Alert.alert("Confirmar entrega", `Entregou o pedido ${code(o.code)} para ${o.customer_name}?`, [
    { text: "Cancelar", style: "cancel" }, { text: "Entregue", onPress: () => step(o, "entregue") },
  ]);
  async function toggleOnline() {
    const e = await setOnline(!courier.online);
    if (e) Alert.alert("Não foi possível mudar", e);
  }

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [panelW, 0] });
  const count = mine.length + avail.length;

  return (
    <View style={{ flex: 1 }}>
      <MapWebView ref={map} data={mapData} hasPack={hasPack} meImg={meImg} meFallback={meFallback}
        onTap={(id) => { if (id !== "store") { setFocus(id); setOpen(true); } }}
        onFollowChange={setFollow}
        onEventTap={(id) => { const e = events.find((x) => x.id === id); if (e) showEvent(e); }} />

      {/* Topo: bonequinho (perfil) à esquerda, status no meio */}
      <View style={[st.top, { top: insets.top + 10 }]} pointerEvents="box-none">
        <Pressable onPress={onOpenProfile} style={st.avatarBtn} accessibilityLabel="Abrir perfil">
          <Image source={avatarSource(courier)} style={st.avatarImg} />
          <View style={[st.dot, { backgroundColor: courier.online ? C.ok : C.mut }]} />
        </Pressable>
        <Pressable onPress={toggleOnline} style={[st.chip, { borderColor: courier.online ? C.ok : C.line }]}>
          <Text style={{ color: courier.online ? C.ok : C.mut, fontWeight: "800" }}>{courier.online ? "● Online" : "○ Offline"}</Text>
        </Pressable>
        <Pressable onPress={onOpenRanking} style={st.rankBtn} accessibilityLabel="Abrir ranking">
          <Text style={{ fontSize: 24 }}>🏆</Text>
        </Pressable>
      </View>

      {/* Avisos */}
      <View style={[st.notes, { top: insets.top + 70 }]} pointerEvents="box-none">
        {!pos && !gpsErr && <Text style={st.note}>Procurando GPS...</Text>}
        {!!gpsErr && <Text style={[st.note, { color: C.warn }]}>GPS: {gpsErr}</Text>}
        {!!err && <Text style={[st.note, { color: C.warn }]}>{err}</Text>}
        {!!pingMsg && courier.online && <Text style={[st.note, { color: C.warn }]}>{pingMsg}</Text>}
        {!courier.online && <Text style={st.note}>Você está offline: não recebe entregas novas e sua posição não é enviada.</Text>}
        {!hasPack && <Pressable onPress={onOpenProfile}><Text style={[st.note, { color: C.ghost }]}>🗺️ Baixe o mapa offline no seu perfil</Text></Pressable>}
      </View>

      {/* Eventos com bônus (rolando agora e os próximos) */}
      {(liveEvents.length > 0 || nextEvents.length > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[st.evBar, { bottom: insets.bottom + 20 }]} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {liveEvents.map((e) => (
            <Pressable key={e.id} style={[st.evChip, st.evLive]} onPress={() => showEvent(e)}>
              <Text style={st.evTitle} numberOfLines={1}>🎉 {e.title}</Text>
              <Text style={st.evExtra}>+{brl(e.extra_bonus)} por entrega · até {hhmm(e.ends_at)}</Text>
            </Pressable>
          ))}
          {nextEvents.map((e) => (
            <Pressable key={e.id} style={st.evChip} onPress={() => showEvent(e)}>
              <Text style={st.evTitle} numberOfLines={1}>⏳ {e.title}</Text>
              <Text style={[st.evExtra, { color: C.mut }]}>+{brl(e.extra_bonus)} · {sameDay(e.starts_at, now) ? "começa" : "amanhã"} às {hhmm(e.starts_at)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Botões no canto */}
      <View style={[st.fabCol, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <Pressable style={[st.fab, heatOn && { borderColor: C.warn }]} onPress={toggleHeat} accessibilityLabel="Áreas de mais saída">
          <Text style={[st.fabT, { fontSize: 20, opacity: heatOn ? 1 : 0.45 }]}>🔥</Text>
        </Pressable>
        <Pressable style={st.fab} onPress={() => { setFollow(false); map.current?.fit(); }}><Text style={st.fabT}>⤢</Text></Pressable>
        <Pressable style={[st.fab, follow && { backgroundColor: C.accent, borderColor: C.accent }]} accessibilityLabel="Seguir minha posição"
          onPress={() => { const on = !follow; setFollow(on); if (on) map.current?.center(); }}>
          <Text style={[st.fabT, follow && { color: "#fff" }]}>{follow ? "➤" : "◎"}</Text>
        </Pressable>
      </View>

      {/* Alça do painel de entregas (direita) */}
      {!open && (
        <Pressable style={[st.handle, { top: insets.top + 130 }]} onPress={() => setOpen(true)}>
          <Text style={st.handleN}>{count}</Text>
          <Text style={st.handleT}>entregas</Text>
          <Text style={st.handleT}>‹</Text>
        </Pressable>
      )}

      <Animated.View style={[st.panel, { width: panelW, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10, transform: [{ translateX }] }]} pointerEvents={open ? "auto" : "none"}>
        <View style={st.panelHead}>
          <Text style={st.panelTitle}>Rota</Text>
          <Pressable onPress={() => { setOpen(false); setFocus(null); }} style={st.close}><Text style={{ color: C.text, fontSize: 18 }}>›</Text></Pressable>
        </View>
        <Text style={st.mut}>
          {mine.length ? `${mine.length} entrega(s) · ${km(route.total)} em linha reta · ordem pela mais próxima` : "Nenhuma entrega com você agora."}
        </Text>
        <ScrollView style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ paddingBottom: 30 }}>
          {route.stops.map((s, i) => (
            <OrderCard key={s.item.id} o={s.item} n={String(i + 1)} leg={s.leg} focused={focus === s.item.id} busy={busyId === s.item.id}
              actions={
                s.item.status === "saiu"
                  ? <>
                      {!s.item.status_times?.coletado && <Btn label="Coletado" color={C.accent} onPress={() => step(s.item, "coletado")} />}
                      <Btn label="Entregue" color={C.ok} onPress={() => confirmDelivered(s.item)} />
                    </>
                  : s.item.status === "preparo"
                    ? <Btn label="Coletado" color={C.accent} onPress={() => step(s.item, "coletado")} />
                    : <Text style={st.wait}>Aguardando a loja começar o preparo</Text>
              } />
          ))}

          <Text style={[st.panelTitle, { fontSize: 16, marginTop: 14 }]}>Disponíveis</Text>
          {!courier.online
            ? <Text style={st.mut}>Fique Online para ver e pegar entregas disponíveis.</Text>
            : availSorted.length === 0
              ? <Text style={st.mut}>Nenhuma entrega disponível agora.</Text>
              : availSorted.map(({ o, d }) => (
                <OrderCard key={o.id} o={o} n="+" leg={d} focused={focus === o.id} busy={busyId === o.id} avail waitInfo={{ wait: waitMin(o, now), pulse: pulseLevel(waitMin(o, now), cfg.stale_minutes) }}
                  actions={<Btn label="Pegar" color={C.avail} onPress={() => claim(o)} />} />
              ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Btn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[st.btn, { backgroundColor: color }]}><Text style={st.btnT}>{label}</Text></Pressable>;
}

function OrderCard({ o, n, leg, actions, busy, focused, avail, waitInfo }: { o: Order; n: string; leg: number | null; actions: React.ReactNode; busy: boolean; focused: boolean; avail?: boolean; waitInfo?: { wait: number; pulse: number } }) {
  const paid = o.payment === "pix";
  return (
    <View style={[st.card, focused && { borderColor: C.ghost }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={[st.seq, { backgroundColor: avail ? C.avail : C.pin }]}><Text style={st.seqT}>{n}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={st.name} numberOfLines={1}>{o.customer_name}</Text>
          <Text style={st.mut}>{code(o.code)} · {STATUS[o.status] ?? o.status}{o.status_times?.coletado ? " · coletado" : ""}</Text>
        </View>
        <Text style={st.value}>{brl(Number(o.total))}</Text>
      </View>
      <Text style={st.addr}>{o.neighborhood ? `${o.neighborhood} · ` : ""}{o.address || "Sem endereço"}</Text>
      {!!waitInfo?.pulse && (
        <Text style={[st.waitTag, { color: waitInfo.pulse >= 3 ? C.err : C.warn }]}>⏱ Esperando há {waitInfo.wait} min{waitInfo.pulse >= 2 ? " · pega logo!" : ""}</Text>
      )}
      <Text style={[st.mut, { marginTop: 2 }]}>
        {paid ? "PAGO (Pix)" : `COBRAR ${brl(Number(o.total))} (${o.payment === "cartao" ? "cartão" : "dinheiro"})`}
        {leg != null ? ` · ${km(leg)}` : " · sem GPS do cliente"}
      </Text>
      <View style={st.row}>
        {busy ? <ActivityIndicator color={C.ghost} /> : actions}
      </View>
      <View style={st.row}>
        <Small label="Google Maps" onPress={() => Linking.openURL(googleMapsUrl(o.lat, o.lng, cityAddr(o)))} />
        <Small label="Waze" onPress={() => Linking.openURL(wazeUrl(o.lat, o.lng, cityAddr(o)))} />
        {!avail && !!o.customer_phone && <Small label="WhatsApp" onPress={() => Linking.openURL(waUrl(o.customer_phone))} />}
      </View>
    </View>
  );
}
function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={st.small}><Text style={{ color: C.ghost, fontWeight: "700", fontSize: 13 }}>{label}</Text></Pressable>;
}

const st = StyleSheet.create({
  top: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.panel, borderWidth: 2, borderColor: C.ghost, alignItems: "center", justifyContent: "center", elevation: 6 },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  dot: { position: "absolute", right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: C.panel },
  chip: { backgroundColor: C.panel, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, elevation: 6 },
  notes: { position: "absolute", left: 12, right: 80, gap: 6 },
  note: { backgroundColor: "rgba(20,20,37,.92)", color: C.text, padding: 9, borderRadius: 10, fontSize: 13, overflow: "hidden" },
  rankBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.panel, borderWidth: 2, borderColor: "#ffd166", alignItems: "center", justifyContent: "center", elevation: 6 },
  evBar: { position: "absolute", left: 12, right: 76, maxHeight: 70 },
  evChip: { backgroundColor: "rgba(20,20,37,.95)", borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 260, elevation: 6 },
  evLive: { borderColor: "#ffd166" },
  evTitle: { color: C.text, fontWeight: "900", fontSize: 14 },
  evExtra: { color: "#ffd166", fontWeight: "700", fontSize: 12, marginTop: 2 },
  waitTag: { fontWeight: "800", fontSize: 13, marginTop: 4 },
  fabCol: { position: "absolute", right: 14, gap: 10 },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", elevation: 6 },
  fabT: { color: C.ghost, fontSize: 22 },
  handle: { position: "absolute", right: 0, backgroundColor: C.accent, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, paddingVertical: 12, paddingHorizontal: 8, alignItems: "center", elevation: 8 },
  handleN: { color: "#fff", fontSize: 22, fontWeight: "900" },
  handleT: { color: "#fff", fontSize: 11 },
  panel: { position: "absolute", top: 0, bottom: 0, right: 0, backgroundColor: C.bg, borderLeftWidth: 1, borderColor: C.line, paddingHorizontal: 12, elevation: 12 },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { color: C.text, fontSize: 20, fontWeight: "900" },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" },
  mut: { color: C.mut, fontSize: 13 },
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 12, marginTop: 10, borderWidth: 1, borderColor: C.line },
  seq: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  seqT: { color: "#fff", fontWeight: "900" },
  name: { color: C.text, fontWeight: "800", fontSize: 15 },
  value: { color: C.text, fontWeight: "800" },
  addr: { color: C.text, marginTop: 8, fontSize: 14 },
  row: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  btnT: { color: "#fff", fontWeight: "900" },
  wait: { color: C.warn, fontSize: 13 },
  small: { borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
});
