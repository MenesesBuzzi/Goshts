import type { ImageSourcePropType } from "react-native";

/** Fantasminhas que o Ghost pode escolher como avatar (assets/ghosts). A chave fica em couriers.ghost_avatar. */
export const GHOSTS = [
  { key: "classic", label: "Clássico", src: require("../../assets/ghosts/classic.png") },
  { key: "acai", label: "Açaí", src: require("../../assets/ghosts/acai.png") },
  { key: "helmet", label: "Capacete", src: require("../../assets/ghosts/helmet.png") },
  { key: "cap", label: "Boné", src: require("../../assets/ghosts/cap.png") },
  { key: "pink", label: "Rosinha", src: require("../../assets/ghosts/pink.png") },
  { key: "sleepy", label: "Soneca", src: require("../../assets/ghosts/sleepy.png") },
] as const satisfies readonly { key: string; label: string; src: ImageSourcePropType }[];

export type GhostKey = (typeof GHOSTS)[number]["key"];
export const DEFAULT_GHOST: GhostKey = "classic";

export function ghostSrc(key: string | null | undefined): ImageSourcePropType {
  return (GHOSTS.find((g) => g.key === key) ?? GHOSTS[0]).src;
}

/** Foto enviada (se houver) ou o fantasminha escolhido (padrão: clássico) */
export function avatarSource(p: { avatar_url?: string | null; ghost_avatar?: string | null }): ImageSourcePropType {
  return p.avatar_url ? { uri: p.avatar_url } : ghostSrc(p.ghost_avatar);
}
export const hasPhoto = (p: { avatar_url?: string | null }) => !!p.avatar_url;
