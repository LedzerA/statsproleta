# Proleta · Estatísticas (v2)

App de estatísticas e **partidas ao vivo** do Proletariado Alviverde.

- **Visualizar é livre** — qualquer pessoa com o link vê estatísticas, partidas e lances ao vivo, sem login.
- **Admins logam** para editar dados e comandar partidas ao vivo (gols, pênaltis, fim de tempo).
- **Vários elencos** (Esporte, Veterano, …), cada um com atletas, partidas e estatísticas próprias.
- **Notificações push** de gols, pênaltis, fim do 1º/2º tempo — mesmo com o app fechado.
- **PWA**: dá para instalar na tela de início do celular.

Stack: React + TypeScript + Vite no front (hospedado no GitHub Pages) e Supabase no back
(Postgres + Auth + Realtime + Edge Functions). A versão antiga (arquivo único) está em `legacy/`.

---

## Rodando localmente

```bash
npm install
npm run dev        # abre em http://localhost:5173
npm run build      # gera dist/ (mesmo build do deploy)
```

## Configuração (uma vez só)

### 1. Banco de dados (Supabase)

No painel do Supabase → **SQL Editor**:

1. Rode o arquivo **`supabase/schema.sql`** inteiro (tabelas + segurança RLS + realtime).
   Se o projeto ainda tem as tabelas do app antigo, ele **migra os dados sozinho**
   (as tabelas velhas viram `athletes_v1`/`matches_v1`, nada é apagado).
2. Rode **`supabase/atualizacao-1.sql`** — recupera do banco antigo os **elencos**
   (Esporte/Veterano), **titulares**, **posições por atleta**, local/horário/uniforme,
   cronômetro e converte os lances antigos para a linha do tempo. Idempotente.
3. Rode **`supabase/seed.sql`** — só completa o que faltar (elenco Esporte + os 28 jogos
   históricos); não sobrescreve dados migrados nem edições feitas depois.

As credenciais do projeto (URL + anon key) ficam em **`src/config.ts`**. A anon key é pública
por design — quem protege a escrita são as políticas RLS do schema.

### 2. Criar admins

1. Supabase → **Authentication → Users → Add user** (e-mail + senha; marque "auto confirm").
2. No SQL Editor, promova o usuário a admin:

```sql
insert into public.admins (user_id, note)
select id, email from auth.users where email = 'email@do.admin';
```

Sem essa linha o usuário até loga, mas não consegue editar nada.

### 3. Notificações push (opcional, mas é o melhor recurso)

1. Gere o par de chaves VAPID:

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Cole a **chave pública** em `VAPID_PUBLIC_KEY` no `src/config.ts`.
3. Configure os secrets e faça o deploy da função (precisa da [CLI do Supabase](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref jycbewmizgwugoapbbzz
   supabase secrets set VAPID_PUBLIC_KEY="<pública>" VAPID_PRIVATE_KEY="<privada>" VAPID_SUBJECT="mailto:seu@email.com"
   supabase functions deploy send-push --no-verify-jwt
   ```

4. Crie o gatilho: Supabase → **Database → Webhooks → Create a new hook**:
   - Table: `match_events` · Events: **Insert**
   - Type: **Supabase Edge Functions** → função `send-push`

Pronto: todo lance inserido dispara push para todos os aparelhos que ativaram
notificações na tela **Mais**.

> iPhone: push só funciona com o app **adicionado à tela de início** (iOS 16.4+).

### 4. Publicar no GitHub Pages

1. No repositório do GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Faça push na branch `main` — o workflow `.github/workflows/deploy.yml` builda e publica sozinho.

O build usa caminhos relativos (`base: "./"`), então funciona em
`usuario.github.io/repo/` sem configurar nada. O endereço antigo
(`…/proleta-esporte.html`) redireciona automaticamente para o app novo.

---

## Como usar no dia a dia

**Partida ao vivo (admin):** Partidas → *Agendar* (ou *Nova partida*) → abrir a partida →
**🔴 Iniciar partida ao vivo**. Daí é só registrar: ⚽ Gol do Proleta (com autor e assistência),
gol do adversário, pênaltis, fim do 1º tempo, 2º tempo e **Encerrar** — o resultado entra
nas estatísticas na hora e cada lance vira notificação.

**Partida já encerrada (admin):** Partidas → *+ Nova partida* → preenche placar, relacionados,
gols e assistências, salva.

**Visualizador:** só abrir o link. Para receber notificações: **Mais → Ativar notificações**.
Para instalar como app: menu do navegador → *Adicionar à tela de início*.

## Estrutura

```
src/
  config.ts          credenciais Supabase + chave VAPID pública + nome do time
  lib/               tipos, cálculo de estatísticas, formatação, push, router
  state/store.tsx    estado global: dados, realtime, auth, ações
  views/             telas (Início, Partidas, Detalhe/Ao vivo, Atletas, Rivais, Mais)
public/
  sw.js              service worker (recebe push)
  manifest.webmanifest
supabase/
  schema.sql         tabelas + RLS + realtime (rodar no SQL Editor)
  seed.sql           dados migrados da v1 (gerado por scripts/gen-seed.mjs)
  functions/send-push/  Edge Function que envia os pushes
legacy/              versão 1 (arquivo único)
```
