import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { normalizeUsername, supabase, usernameToEmail } from "../lib/supabase";
import { C } from "../lib/theme";
import { ghostSrc } from "../lib/ghosts";

/** Login só com usuário e senha criados pelo admin no site (não há cadastro pelo app). */
export function LoginScreen() {
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function login() {
    const u = normalizeUsername(user);
    if (!/^[a-z0-9._-]{3,30}$/.test(u)) return setErr("Usuário inválido. Use o usuário que a loja criou para você.");
    if (!pw) return setErr("Digite a senha.");
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(u), password: pw });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      setErr(/banned/i.test(m) ? "Sua conta foi desativada. Fale com a loja."
        : /invalid login|credentials/i.test(m) ? "Usuário ou senha incorretos."
        : /network|fetch/i.test(m) ? "Sem internet. Conecte-se para entrar."
        : `Não foi possível entrar: ${m}`);
    }
  }

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.card}>
        <Image source={ghostSrc("classic")} style={{ width: 110, height: 110, alignSelf: "center" }} />
        <Text style={s.title}>Fantasma</Text>
        <Text style={s.sub}>Entrada dos Ghosts</Text>

        <Text style={s.label}>Usuário</Text>
        <TextInput style={s.input} value={user} onChangeText={setUser} autoCapitalize="none" autoCorrect={false}
          autoComplete="username" placeholder="seu.usuario" placeholderTextColor={C.mut} returnKeyType="next" />

        <Text style={s.label}>Senha</Text>
        <View style={s.pwRow}>
          <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={pw} onChangeText={setPw} secureTextEntry={!show}
            autoCapitalize="none" autoComplete="password" placeholder="••••••" placeholderTextColor={C.mut} onSubmitEditing={login} returnKeyType="go" />
          <Pressable onPress={() => setShow(!show)} style={s.eye}><Text style={{ color: C.ghost }}>{show ? "Ocultar" : "Ver"}</Text></Pressable>
        </View>

        {!!err && <Text style={s.err}>{err}</Text>}
        <Pressable style={[s.btn, busy && { opacity: 0.6 }]} onPress={login} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Entrar</Text>}
        </Pressable>
        <Text style={s.hint}>Não tem acesso? Peça para a loja criar seu usuário de Ghost.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 22 },
  card: { backgroundColor: C.panel, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: C.line },
  logo: { fontSize: 64, textAlign: "center" },
  title: { color: C.text, fontSize: 30, fontWeight: "900", textAlign: "center", letterSpacing: 1 },
  sub: { color: C.mut, textAlign: "center", marginBottom: 18 },
  label: { color: C.mut, fontSize: 13, marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: C.panel2, color: C.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: C.line, marginBottom: 6 },
  pwRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eye: { paddingHorizontal: 10, paddingVertical: 12 },
  err: { color: C.err, marginTop: 10 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 18 },
  btnT: { color: "#fff", fontWeight: "800", fontSize: 17 },
  hint: { color: C.mut, fontSize: 12, textAlign: "center", marginTop: 14 },
});
