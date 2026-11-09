import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { C } from "../lib/theme";
import { ghostSrc } from "../lib/ghosts";

/**
 * Tela de carregamento: fantasminha flutuando (sobe e desce), balançando de leve,
 * com sombra que respira e entrada suave (fade). Só Animated do React Native, sem libs nativas.
 */
export function GhostLoader({ text = "Carregando", ghost, size = 140 }: { text?: string; ghost?: string | null; size?: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const [dots, setDots] = useState(1);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 450);
    return () => { loop.stop(); clearInterval(t); };
  }, [fade, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [6, -14] });
  const rotate = bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-4deg", "0deg", "4deg"] });
  const ghostOpacity = bob.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const shadowScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] });
  const shadowOpacity = bob.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.18] });

  return (
    <Animated.View style={[s.wrap, { opacity: fade }]}>
      <View style={s.glow} />
      <Animated.View style={{ opacity: ghostOpacity, transform: [{ translateY }, { rotate }] }}>
        <Image source={ghostSrc(ghost)} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={[s.shadow, { width: size * 0.55, opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]} />
      <Text style={s.text}>{text}{".".repeat(dots)}<Text style={{ color: "transparent" }}>{".".repeat(3 - dots)}</Text></Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(124,108,255,.10)" },
  shadow: { height: 12, borderRadius: 6, backgroundColor: "#000", marginTop: 10 },
  text: { color: C.ghost, marginTop: 22, fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
});
