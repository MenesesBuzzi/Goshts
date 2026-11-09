import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { C } from "./src/lib/theme";
import type { Courier } from "./src/lib/types";
import { LoginScreen } from "./src/screens/LoginScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { RankingScreen } from "./src/screens/RankingScreen";
import { EarningsScreen } from "./src/screens/EarningsScreen";
import { GhostLoader } from "./src/components/GhostLoader";
import { ghostSrc } from "./src/lib/ghosts";
import { LocationGate } from "./src/components/LocationGate";
import { readPack, type PackInfo } from "./src/map/tiles";

// Mantém o splash nativo até o primeiro quadro do React (aí entra o fantasminha animado)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => { const t = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 50); return () => clearTimeout(t); }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Root />
    </SafeAreaProvider>
  );
}

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [courier, setCourier] = useState<Courier | null | undefined>(undefined);
  const [overlay, setOverlay] = useState<null | "profile" | "ranking" | "ganhos">(null);
  const [pack, setPack] = useState<PackInfo>(() => readPack());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadCourier = useCallback(async () => {
    if (!session) { setCourier(null); return; }
    const { data } = await supabase.from("couriers")
      .select("id, name, phone, avatar_url, ghost_avatar, pix_key, username, online, active, user_id")
      .eq("user_id", session.user.id).maybeSingle();
    setCourier((data as Courier) ?? null);
  }, [session]);
  useEffect(() => { setCourier(undefined); loadCourier(); }, [loadCourier]);

  const setOnline = useCallback(async (on: boolean) => {
    if (!courier) return "Sem cadastro";
    setCourier({ ...courier, online: on }); // otimista
    const { error } = await supabase.rpc("courier_set_online", { p_online: on });
    if (error) { setCourier({ ...courier }); return error.message; }
    return null;
  }, [courier]);

  const logout = useCallback(async () => {
    try { await supabase.rpc("courier_set_online", { p_online: false }); } catch { /* sem rede: sai assim mesmo */ }
    await supabase.auth.signOut();
    setOverlay(null);
  }, []);

  if (session === undefined || (session && courier === undefined)) {
    return <GhostLoader text={session === undefined ? "Abrindo o Fantasma" : "Carregando seu perfil"} />;
  }
  if (!session) return <LoginScreen />;
  if (!courier || !courier.active) {
    return (
      <View style={s.center}>
        <Image source={ghostSrc("sleepy")} style={{ width: 120, height: 120 }} />
        <Text style={s.title}>{courier && !courier.active ? "Ghost desativado" : "Conta sem acesso de Ghost"}</Text>
        <Text style={s.sub}>Esta conta não está liberada como Ghost. Fale com a loja para liberar o acesso.</Text>
        <Pressable style={s.btn} onPress={loadCourier}><Text style={s.btnT}>Tentar de novo</Text></Pressable>
        <Pressable onPress={logout}><Text style={s.link}>Sair</Text></Pressable>
      </View>
    );
  }

  return (
    <LocationGate>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <HomeScreen courier={courier} hasPack={!!pack} onOpenProfile={() => setOverlay("profile")} onOpenRanking={() => setOverlay("ranking")} setOnline={setOnline} />
        {overlay === "ranking" && <View style={StyleSheet.absoluteFill}><RankingScreen onClose={() => setOverlay(null)} /></View>}
        {overlay === "ganhos" && <View style={StyleSheet.absoluteFill}><EarningsScreen courier={courier} onClose={() => setOverlay("profile")} /></View>}
        {overlay === "profile" && (
          <View style={StyleSheet.absoluteFill}>
            <ProfileScreen
              courier={courier}
              pack={pack}
              onPackChange={setPack}
              onClose={() => setOverlay(null)}
              onOpenEarnings={() => setOverlay("ganhos")}
              onOpenRanking={() => setOverlay("ranking")}
              onSaved={loadCourier}
              setOnline={setOnline}
              logout={logout}
            />
          </View>
        )}
      </View>
    </LocationGate>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 28 },
  title: { color: C.text, fontSize: 20, fontWeight: "800", marginTop: 14, textAlign: "center" },
  sub: { color: C.mut, fontSize: 15, marginTop: 8, textAlign: "center" },
  btn: { marginTop: 22, backgroundColor: C.accent, paddingVertical: 13, paddingHorizontal: 24, borderRadius: 14 },
  btnT: { color: "#fff", fontWeight: "800" },
  link: { color: C.ghost, marginTop: 16, textDecorationLine: "underline" },
});
