import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";
import { avatarSource } from "../lib/ghosts";
import { useAppSettings } from "../lib/hooks";
import type { LeaderRow } from "../lib/types";

type Period = "semana" | "mes";
const MEDAL = ["🥇", "🥈", "🥉"];

/** Ranking dos Ghosts (semana e mês) + prêmio definido pela loja. Sem telefone nem valores dos outros. */
export function RankingScreen({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { cfg, reload } = useAppSettings();
  const [period, setPeriod] = useState<Period>("semana");
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: Period) => {
    const { data, error } = await supabase.rpc("courier_leaderboard", { p_period: p });
    if (error) { setErr("Não foi possível carregar o ranking agora."); return; }
    setErr("");
    setRows(((data ?? []) as LeaderRow[]).map((r) => ({ ...r, pos: Number(r.pos), deliveries: Number(r.deliveries) })));
  }, []);
  useEffect(() => { setRows(null); load(period); }, [period, load]);

  async function refresh() {
    setRefreshing(true);
    await Promise.all([load(period), reload()]);
    setRefreshing(false);
  }

  const me = rows?.find((r) => r.is_me);

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onClose} style={s.back}><Text style={{ color: C.text, fontSize: 20 }}>‹</Text></Pressable>
        <Text style={s.title}>🏆 Ranking dos Ghosts</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.tabs}>
        {([["semana", "Semana"], ["mes", "Mês"]] as [Period, string][]).map(([k, l]) => (
          <Pressable key={k} onPress={() => setPeriod(k)} style={[s.tab, period === k && s.tabOn]}>
            <Text style={[s.tabT, period === k && { color: "#fff" }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ghost} colors={[C.accent]} />}>
        <View style={s.prize}>
          <Text style={s.prizeLabel}>🎁 Prêmio</Text>
          <Text style={s.prizeText}>{cfg.ranking_prize.trim() || "A loja ainda não definiu o prêmio. Continue entregando!"}</Text>
        </View>

        {me && (
          <View style={s.mine}>
            <Text style={s.mineT}>Você está em {me.pos}º lugar {period === "semana" ? "nesta semana" : "neste mês"}</Text>
            <Text style={s.mut}>{me.deliveries} entrega{me.deliveries === 1 ? "" : "s"}</Text>
          </View>
        )}

        {err ? <Text style={[s.mut, { marginTop: 16 }]}>{err}</Text>
          : !rows ? <ActivityIndicator color={C.ghost} style={{ marginTop: 24 }} />
          : rows.length === 0 ? <Text style={[s.mut, { marginTop: 16 }]}>Nenhum Ghost no ranking ainda.</Text>
          : rows.map((r, i) => (
            <View key={`${r.pos}-${r.name}-${i}`} style={[s.row, r.is_me && s.rowMe, i < 3 && r.deliveries > 0 && s.rowTop]}>
              <Text style={s.pos}>{r.deliveries > 0 && r.pos <= 3 ? MEDAL[r.pos - 1] : `${r.pos}º`}</Text>
              <Image source={avatarSource(r)} style={s.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[s.name, r.is_me && { color: C.ghost }]} numberOfLines={1}>{r.name}{r.is_me ? " (você)" : ""}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.count}>{r.deliveries}</Text>
                <Text style={s.mutSm}>entrega{r.deliveries === 1 ? "" : "s"}</Text>
              </View>
            </View>
          ))}
        <Text style={[s.mutSm, { marginTop: 14, textAlign: "center" }]}>
          A semana começa na segunda-feira. Conta só entregas concluídas. Puxe para baixo para atualizar.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 18, fontWeight: "900" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  tabOn: { backgroundColor: C.accent, borderColor: C.accent },
  tabT: { color: C.mut, fontWeight: "800" },
  prize: { backgroundColor: "#2a2140", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#ffd166" },
  prizeLabel: { color: "#ffd166", fontWeight: "900", fontSize: 13 },
  prizeText: { color: C.text, fontWeight: "800", fontSize: 16, marginTop: 4 },
  mine: { backgroundColor: C.panel, borderRadius: 14, padding: 12, marginTop: 12, borderWidth: 1, borderColor: C.ghost },
  mineT: { color: C.text, fontWeight: "900", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.panel, borderRadius: 14, padding: 10, marginTop: 10, borderWidth: 1, borderColor: C.line },
  rowTop: { backgroundColor: C.panel2 },
  rowMe: { borderColor: C.ghost, borderWidth: 2 },
  pos: { width: 34, textAlign: "center", color: C.text, fontWeight: "900", fontSize: 18 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.panel2 },
  name: { color: C.text, fontWeight: "800", fontSize: 16 },
  count: { color: C.text, fontWeight: "900", fontSize: 20 },
  mut: { color: C.mut, fontSize: 13 },
  mutSm: { color: C.mut, fontSize: 11 },
});
