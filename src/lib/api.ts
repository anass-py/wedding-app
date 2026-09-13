import { createDemoApi } from "./demoApi";
import { createSupabaseApi } from "./supabaseApi";
import type { Api } from "./types";

export function createApi(): Api {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key && !url.includes("xxxx")) return createSupabaseApi(url, key);
  console.warn("[wedding] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — running in demo mode");
  return createDemoApi();
}
