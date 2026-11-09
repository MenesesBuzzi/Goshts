import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { C } from "../lib/theme";
import { ghostSrc } from "../lib/ghosts";
import { GhostLoader } from "./GhostLoader";

type Gate = "checking" | "ok" | "denied" | "blocked" | "off";

/**
 * Trava o app até a localização estar PERMITIDA (primeiro plano) e o GPS do aparelho LIGADO.
 * Rechecagem: ao voltar para o app (AppState) e a cada 5 s.
 */
export function LocationGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>("checking");
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") { setGate(perm.canAskAgain ? "denied" : "blocked"); return; }
      const on = await Location.hasServicesEnabledAsync();
      setGate(on ? "ok" : "off");
    } catch { setGate("off"); }
    finally { busy.current = false; }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") check(); });
    const t = setInterval(check, 5000);
    return () => { sub.remove(); clearInterval(t); };
  }, [check]);

  async function unlock() {
    if (gate === "denied" || gate === "checking") {
      const r = await Location.requestForegroundPermissionsAsync();
      if (r.status !== "granted" && !r.canAskAgain) await Linking.openSettings();
    } else if (gate === "blocked") {
      await Linking.openSettings();
    } else if (gate === "off") {
      if (Platform.OS === "android") {
        // Mostra a janelinha do Android "Ativar localização"; se não der, abre as configurações de localização
        try { await Location.enableNetworkProviderAsync(); }
        catch { try { await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS"); } catch { await Linking.openSettings(); } }
      } else {
        await Linking.openSettings();
      }
    }
    check();
  }

  if (gate === "ok") return <>{children}</>;
  if (gate === "checking") return <GhostLoader text="Verificando a localização" />;
  const sub =
    gate === "off" ? "O GPS do celular está desligado. Ligue a localização para ver o mapa e receber entregas." :
    gate === "blocked" ? "A permissão de localização foi negada. Abra as configurações e permita a localização para o Fantasma." :
    "O Fantasma precisa da sua localização enquanto o app está aberto para montar a rota e mostrar você para a loja.";
  return (
    <View style={s.wrap}>
      <Image source={ghostSrc("helmet")} style={s.ghost} />
      <Text style={s.lock}>🔒</Text>
      <Text style={s.title}>Ative a localização para destravar</Text>
      <Text style={s.sub}>{sub}</Text>
      <Pressable style={s.btn} onPress={unlock}>
        <Text style={s.btnT}>{gate === "off" ? "Ligar localização" : gate === "blocked" ? "Abrir configurações" : "Permitir localização"}</Text>
      </Pressable>
      <Pressable onPress={check}><Text style={s.link}>Já ativei, verificar de novo</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 28 },
  ghost: { width: 120, height: 120, opacity: 0.6 },
  lock: { fontSize: 34, marginTop: -34, marginLeft: 80 },
  title: { color: C.text, fontSize: 22, fontWeight: "800", textAlign: "center", marginTop: 18 },
  sub: { color: C.mut, fontSize: 15, textAlign: "center", marginTop: 10, lineHeight: 21 },
  btn: { marginTop: 26, backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 14 },
  btnT: { color: "#fff", fontWeight: "800", fontSize: 16 },
  link: { color: C.ghost, marginTop: 16, textDecorationLine: "underline" },
});
