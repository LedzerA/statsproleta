/* =====================================================================
   CONFIGURAÇÃO
   ---------------------------------------------------------------------
   SUPABASE_URL / SUPABASE_ANON_KEY:
     Supabase -> seu projeto -> Project Settings -> API.
     A anon key é pública por design; a segurança vem das políticas RLS
     (arquivo supabase/schema.sql).

   VAPID_PUBLIC_KEY (notificações push):
     Gere o par de chaves com:  npx web-push generate-vapid-keys
     - A chave PÚBLICA vai aqui.
     - A chave PRIVADA vai como secret da Edge Function (ver README).
     Deixe vazio ("") para desativar push (o resto do app funciona normal).
   ===================================================================== */
export const SUPABASE_URL = "https://jycbewmizgwugoapbbzz.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5Y2Jld21pemd3dWdvYXBiYnp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDY2MzcsImV4cCI6MjA5OTA4MjYzN30.R9jKcenGlt1crYABuHel4Cjz7l_3h8D4cgPc50Hq4Js";

export const VAPID_PUBLIC_KEY =
  "BOVF9EN1ba7sC8R-8CRW3z4HEnE_iVcthndfHhTTVib6OdLLn33Ng2cEiK4CYR5WY_af9HgiIv3aAw6QWxcNzeE";

export const TEAM = {
  name: "Proletariado Alviverde",
  short: "Proleta",
};
