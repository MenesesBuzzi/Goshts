import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

/**
 * Mesmo projeto Supabase do site (Açaí Mania). Configure no arquivo .env:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=...   (chave "anon"/"publishable", NUNCA a service_role)
 * Sem .env, usa os mesmos valores públicos padrão do app web do motoboy (motoboy-app/src/supabase.ts).
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://kvajcnetaedsfptrwsut.supabase.co";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_q14uUSbWkdqyVZY8X9rTXA_f-prZXsi";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "fantasma-auth" },
});

// Renova o token só com o app aberto (recomendação do Supabase para React Native)
AppState.addEventListener("change", (s) => {
  if (s === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** Domínio dos e-mails sintéticos dos Ghosts. Tem que ser igual ao do site (app/api/ghosts/route.ts). */
export const GHOST_EMAIL_DOMAIN = "fantasma.app";

/** "João.Silva " -> "joao.silva" */
export function normalizeUsername(raw: string) {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
export const usernameToEmail = (u: string) => `${normalizeUsername(u)}@${GHOST_EMAIL_DOMAIN}`;
