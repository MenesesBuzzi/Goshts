import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { supabase } from "../lib/supabase";
import { C, brl } from "../lib/theme";
import type { Courier, Stats } from "../lib/types";
import { GHOSTS, avatarSource } from "../lib/ghosts";
import { cancelDownload, deletePack, downloadPack, readPack, TILE_COUNT, MIN_Z, MAX_Z, type PackInfo } from "../map/tiles";

type Props = {
  courier: Courier;
  pack: PackInfo;
  onPackChange: (p: PackInfo) => void;
  onClose: () => void;
  onOpenEarnings: () => void;
  onOpenRanking: () => void;
  onSaved: () => void;
  setOnline: (on: boolean) => Promise<string | null>;
  logout: () => void;
};

export function ProfileScreen({ courier, pack, onPackChange, onClose, onOpenEarnings, onOpenRanking, onSaved, setOnline, logout }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(courier.name);
  const [phone, setPhone] = useState(courier.phone);
  const [saving, setSaving] = useState(false);
  const [pix, setPix] = useState(courier.pix_key ?? "");
  const [savingPix, setSavingPix] = useState(false);
  const [pickingGhost, setPickingGhost] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState("");
  const [dl, setDl] = useState<{ done: number; total: number; failed: number } | null>(null);

  const loadStats = useCallback(() => {
    supabase.rpc("courier_my_stats").then(({ data, error }) => {
      if (error) setStatsErr("Não foi possível carregar seus números agora.");
      else { setStatsErr(""); setStats((data?.[0] ?? null) as Stats | null); }
    });
  }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  async function save(avatarUrl?: string) {
    setSaving(true);
    const { error } = await supabase.rpc("courier_update_profile", {
      p_name: name, p_phone: phone, p_avatar_url: avatarUrl ?? courier.avatar_url, p_theme: null, p_theme_mode: null,
    });
    setSaving(false);
    if (error) Alert.alert("Erro ao salvar", error.message);
    else { onSaved(); if (!avatarUrl) Alert.alert("Pronto", "Perfil salvo."); }
  }

  async function chooseGhost(key: string) {
    setPickingGhost(key);
    const { error } = await supabase.rpc("courier_set_ghost_avatar", { p_ghost: key, p_clear_photo: true });
    setPickingGhost(null);
    if (error) Alert.alert("Não deu para trocar", error.message);
    else onSaved();
  }

  async function savePix() {
    setSavingPix(true);
    const { error } = await supabase.rpc("courier_set_pix_key", { p_pix_key: pix });
    setSavingPix(false);
    if (error) Alert.alert("Erro ao salvar o Pix", error.message);
    else { onSaved(); Alert.alert("Pronto", pix.trim() ? "Chave Pix salva. A loja usa ela para pagar seus ganhos." : "Chave Pix apagada."); }
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (r.canceled || !r.assets?.[0]) return;
    setUploading(true);
    try {
      const a = r.assets[0];
      const bytes = await new File(a.uri).arrayBuffer();
      const ext = (a.mimeType?.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${courier.user_id}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, bytes, { contentType: a.mimeType || "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      await save(url);
    } catch (e) {
      Alert.alert("Erro ao enviar a foto", e instanceof Error ? e.message : String(e));
    } finally { setUploading(false); }
  }

  async function toggleOnline(v: boolean) {
    const e = await setOnline(v);
    if (e) Alert.alert("Não foi possível mudar", e);
  }

  async function download() {
    setDl({ done: 0, total: TILE_COUNT, failed: 0 });
    try {
      await downloadPack((done, total, failed) => setDl({ done, total, failed }));
      const p = readPack();
      onPackChange(p);
      if (!p) Alert.alert("Mapa offline", "Não foi possível baixar. Verifique a internet e tente de novo.");
    } catch (e) {
      Alert.alert("Mapa offline", `Erro: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setDl(null); }
  }
  function removePack() {
    Alert.alert("Apagar mapa offline?", "O mapa volta a precisar de internet.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: () => { deletePack(); onPackChange(null); } },
    ]);
  }

  const pct = dl ? Math.round((dl.done / Math.max(1, dl.total)) * 100) : 0;

  return (
    <View style={[s.wrap, { paddingTop: insets.top }]}>
      <View style={s.head}>
        <Pressable onPress={onClose} style={s.back}><Text style={{ color: C.text, fontSize: 20 }}>‹</Text></Pressable>
        <Text style={s.title}>Perfil do Ghost</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={{ alignItems: "center" }}>
          <Pressable onPress={pickPhoto} style={s.avatar}>
            {uploading ? <ActivityIndicator color={C.ghost} />
              : <Image source={avatarSource(courier)} style={courier.avatar_url ? s.avatarImg : s.avatarGhost} />}
          </Pressable>
          <Text style={s.mut}>Toque para enviar uma foto, ou escolha um fantasminha</Text>
          <Text style={s.user}>@{courier.username}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
          {GHOSTS.map((g) => {
            const on = !courier.avatar_url && (courier.ghost_avatar ?? "classic") === g.key;
            return (
              <Pressable key={g.key} onPress={() => chooseGhost(g.key)} style={[s.ghostOpt, on && s.ghostOn]} accessibilityLabel={`Fantasminha ${g.label}`}>
                {pickingGhost === g.key ? <ActivityIndicator color={C.ghost} style={{ height: 64 }} /> : <Image source={g.src} style={{ width: 64, height: 64 }} />}
                <Text style={[s.ghostLbl, on && { color: C.ghost }]}>{g.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable style={[s.bigBtn, { borderColor: C.ok }]} onPress={onOpenEarnings}>
            <Text style={{ fontSize: 22 }}>💸</Text><Text style={s.bigBtnT}>Ganhos</Text>
          </Pressable>
          <Pressable style={[s.bigBtn, { borderColor: "#ffd166" }]} onPress={onOpenRanking}>
            <Text style={{ fontSize: 22 }}>🏆</Text><Text style={s.bigBtnT}>Ranking</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <View style={s.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{courier.online ? "🟢 Online" : "⚪ Offline"}</Text>
              <Text style={s.mut}>{courier.online ? "Recebendo entregas e enviando sua posição para a loja." : "Sem entregas novas e sem enviar posição."}</Text>
            </View>
            <Switch value={courier.online} onValueChange={toggleOnline} trackColor={{ true: C.ok, false: C.line }} thumbColor="#fff" />
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Seus números</Text>
          {statsErr ? <Text style={s.mut}>{statsErr}</Text> : !stats ? <ActivityIndicator color={C.ghost} /> : (
            <>
              <View style={s.grid}>
                <Stat label="Hoje" n={stats.today} b={stats.bonus_today} />
                <Stat label="Semana" n={stats.week} b={stats.bonus_week} />
                <Stat label="Mês" n={stats.month} b={stats.bonus_month} />
                <Stat label="Total" n={stats.total} b={stats.bonus_total} />
              </View>
              <Text style={s.mut}>Bônus por entrega: {brl(Number(stats.bonus_per_delivery))}</Text>
            </>
          )}
          <Pressable onPress={loadStats}><Text style={s.link}>Atualizar</Text></Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Dados</Text>
          <Text style={s.label}>Nome</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholderTextColor={C.mut} />
          <Text style={s.label}>WhatsApp</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="67 99999-0000" placeholderTextColor={C.mut} />
          <Pressable style={[s.btn, saving && { opacity: 0.6 }]} onPress={() => save()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Salvar</Text>}
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>💠 Chave Pix (para receber)</Text>
          <Text style={s.mut}>A loja paga seus ganhos toda semana por Pix nesta chave (CPF, celular, e-mail ou chave aleatória).</Text>
          <TextInput style={[s.input, { marginTop: 8 }]} value={pix} onChangeText={setPix} autoCapitalize="none" autoCorrect={false}
            placeholder="Sua chave Pix" placeholderTextColor={C.mut} />
          <Pressable style={[s.btn, savingPix && { opacity: 0.6 }]} onPress={savePix} disabled={savingPix}>
            {savingPix ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Salvar chave Pix</Text>}
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>🗺️ Mapa offline</Text>
          <Text style={s.mut}>
            Aquidauana + Anastácio, zoom {MIN_Z} a {MAX_Z}: {TILE_COUNT} imagens (cerca de 10 a 20 MB). Baixe uma vez com Wi-Fi; depois o mapa abre sem internet.
          </Text>
          {pack && !dl && (
            <Text style={[s.mut, { marginTop: 6, color: C.ok }]}>
              Baixado: {pack.tiles}/{pack.total} · {(pack.bytes / 1048576).toFixed(1).replace(".", ",")} MB · {new Date(pack.at).toLocaleDateString("pt-BR")}
            </Text>
          )}
          {dl ? (
            <View style={{ marginTop: 10 }}>
              <View style={s.bar}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
              <Text style={s.mut}>{dl.done}/{dl.total} ({pct}%){dl.failed ? ` · ${dl.failed} falharam` : ""}</Text>
              <Pressable onPress={cancelDownload}><Text style={s.link}>Parar</Text></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable style={[s.btn, { flex: 1, marginTop: 0 }]} onPress={download}>
                <Text style={s.btnT}>{pack ? (pack.tiles < pack.total ? "Completar download" : "Baixar de novo") : "Baixar mapa offline"}</Text>
              </Pressable>
              {pack && <Pressable style={[s.btnGhost, { marginTop: 0 }]} onPress={removePack}><Text style={{ color: C.err, fontWeight: "700" }}>Apagar</Text></Pressable>}
            </View>
          )}
          <Text style={[s.mut, { fontSize: 11, marginTop: 8 }]}>Mapa © colaboradores do OpenStreetMap (openstreetmap.org/copyright).</Text>
        </View>

        <Pressable style={s.btnGhost} onPress={() => Alert.alert("Sair", "Sair do Fantasma? Você fica offline.", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: logout }])}>
          <Text style={{ color: C.err, fontWeight: "800" }}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Stat({ label, n, b }: { label: string; n: number; b: number }) {
  return (
    <View style={s.stat}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.mut}>{label}</Text>
      <Text style={{ color: C.ok, fontSize: 12 }}>{brl(Number(b))}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 18, fontWeight: "900" },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: C.panel, borderWidth: 3, borderColor: C.ghost, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 6 },
  avatarImg: { width: 110, height: 110 },
  avatarGhost: { width: 92, height: 92 },
  ghostOpt: { alignItems: "center", backgroundColor: C.panel, borderRadius: 16, padding: 8, borderWidth: 2, borderColor: C.line, width: 86 },
  ghostOn: { borderColor: C.ghost, backgroundColor: C.panel2 },
  ghostLbl: { color: C.mut, fontSize: 12, fontWeight: "700", marginTop: 2 },
  bigBtn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: C.panel, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  bigBtnT: { color: C.text, fontWeight: "900", fontSize: 16 },
  user: { color: C.ghost, fontWeight: "800", marginTop: 4, fontSize: 16 },
  mut: { color: C.mut, fontSize: 13 },
  card: { backgroundColor: C.panel, borderRadius: 16, padding: 14, marginTop: 14, borderWidth: 1, borderColor: C.line },
  cardTitle: { color: C.text, fontWeight: "900", fontSize: 16, marginBottom: 6 },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: 12 },
  grid: { flexDirection: "row", gap: 8, marginVertical: 8 },
  stat: { flex: 1, backgroundColor: C.panel2, borderRadius: 12, padding: 10, alignItems: "center" },
  statN: { color: C.text, fontSize: 22, fontWeight: "900" },
  label: { color: C.mut, fontSize: 13, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: C.panel2, color: C.text, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, borderWidth: 1, borderColor: C.line },
  btn: { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  btnT: { color: "#fff", fontWeight: "800" },
  btnGhost: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", marginTop: 18 },
  link: { color: C.ghost, marginTop: 8, textDecorationLine: "underline" },
  bar: { height: 10, backgroundColor: C.panel2, borderRadius: 5, overflow: "hidden", marginBottom: 6 },
  barFill: { height: 10, backgroundColor: C.accent },
});
