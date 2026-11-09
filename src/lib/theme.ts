export const C = {
  bg: "#0b0b14",
  panel: "#141425",
  panel2: "#1c1c33",
  line: "#2a2a48",
  text: "#ecebff",
  mut: "#9a98c4",
  ghost: "#b8b5ff",   // lilás fantasma
  accent: "#7c6cff",
  ok: "#3ddc97",
  warn: "#ffb74d",
  err: "#ff6b81",
  pin: "#ff4fa3",     // entregas
  avail: "#4fc3f7",   // disponíveis
};
export const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
