import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { C, brl } from "../lib/theme";
import type { Courier, Earnings } from "../lib/types";

const dt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "");

/** Ganhos do Ghost: frete inteiro + bônus (padrão + evento). A loja paga toda semana por Pix. */
export function EarningsScreen({ courier, onClose }: { courier: Courier; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Earnings | null>(null);
  const [err, setErr] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: j, error } = await supabase.rpc("courier_my_earnings", { p_limit: 80 });
    if (error || !j) { setErr("Não foi possível carregar seus ganhos agora."); return; }
    setErr(""); setData(j as Earnings);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onClose} style={s.back}><Text style={{ color: C.text, fontSize: 20 }}>‹</Text></Pressable>
        <Text style={s.title}>💸 Ganhos</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.ghost} colors={[C.accent]} />}>
        {err ? <Text style={s.mut}>{err}</Text> : !data ? <ActivityIndicator color={C.ghost} style={{ marginTop: 30 }} /> : (
          <>
            <View style={s.balance}>
              <Text style={s.balLabel}>A receber</Text>
              <Text style={s.balValue}>{brl(Number(data.unpaid.total))}</Text>
              <Text style={s.mut}>{data.unpaid.n} entrega{Number(data.unpaid.n) === 1 ? "" : "s"} ainda não paga{Number(data.unpaid.n) === 1 ? "" : "s"} · pagamento semanal por Pix</Text>
              <Text style={[s.mut, { marginTop: 6, color: courier.pix_key ? C.ok : C.warn }]}>
                {courier.pix_key ? `Chave Pix: ${courier.pix_key}` : "⚠️ Cadastre sua chave Pix no perfil para receber."}
              </Text>
            </View>

            <View style={s.grid}>
              <Box label="Hoje" n={data.today.n} v={data.today.total} />
              <Box label="Esta semana" n={data.week.n} v={data.week.total} />
            </View>
            <Text style={s.mutSm}>Cada entrega rende o frete inteiro pago pelo cliente + bônus por entrega + extra de evento (quando a entrega é dentro da área do evento).</Text>

            <Text style={s.section}>Últimos pagamentos</Text>
            {data.payouts.length === 0 ? <Text style={s.mut}>Nenhum pagamento registrado ainda.</Text> : data.payouts.map((p) => (
              <View key={p.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowT}>Pago em {d(p.paid_at)}</Text>
                  <Text style={s.mut}>{p.period_start ? `Semana ${d(p.period_start)} a ${d(new Date(new Date(p.period_end ?? p.paid_at).getTime() - 1).toISOString())}` : "Entregas em aberto"} · {p.deliveries} entrega{p.deliveries === 1 ? "" : "s"}</Text>
                  {!!p.note && <Text style={s.mutSm}>{p.note}</Text>}
                </View>
                <Text style={[s.value, { color: C.ok }]}>{brl(Number(p.amount))}</Text>
              </View>
            ))}

            <Text style={s.section}>Entregas</Text>
            {data.deliveries.length === 0 ? <Text style={s.mut}>Nenhuma entrega concluída ainda.</Text> : data.deliveries.map((x) => (
              <View key={x.id} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowT}>#{String(x.code).toUpperCase()} · {dt(x.delivered_at)}</Text>
                  <Text style={s.mut}>
                    Frete {brl(Number(x.delivery_fee))} + bônus {brl(Number(x.base_bonus))}
                    {Number(x.event_bonus) > 0 ? ` + evento ${brl(Number(x.event_bonus))}` : ""}
                  </Text>
                  {!!x.event_title && <Text style={[s.mutSm, { color: "#ffd166" }]}>🎉 {x.event_title}</Text>}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.value}>{brl(Number(x.earning))}</Text>
                  <Text style={[s.mutSm, { color: x.paid ? C.ok : C.warn }]}>{x.paid ? "pago" : "a receber"}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Box({ label, n, v }: { label: string; n: number; v: number }) {
  return (
    <View style={s.box}>
      <Text style={s.boxV}>{brl(Number(v))}</Text>
      <Text style={s.mut}>{label}</Text>
      <Text style={s.mutSm}>{n} entrega{Number(n) === 1 ? "" : "s"}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 18, fontWeight: "900" },
  balance: { backgroundColor: "#16302a", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.ok },
  balLabel: { color: C.ok, fontWeight: "900", fontSize: 13 },
  balValue: { color: C.text, fontWeight: "900", fontSize: 34, marginVertical: 2 },
  grid: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 8 },
  box: { flex: 1, backgroundColor: C.panel, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  boxV: { color: C.text, fontWeight: "900", fontSize: 20 },
  section: { color: C.text, fontWeight: "900", fontSize: 17, marginTop: 20, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.panel, borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: C.line },
  rowT: { color: C.text, fontWeight: "800", fontSize: 14 },
  value: { color: C.text, fontWeight: "900", fontSize: 16 },
  mut: { color: C.mut, fontSize: 13 },
  mutSm: { color: C.mut, fontSize: 11, marginTop: 2 },
});
