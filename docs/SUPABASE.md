# Supabase — como ligar o Role Quest ao seu projeto

O app funciona em dois modos, escolhidos por `NEXT_PUBLIC_DATA_SOURCE`:

- `mock` (padrão): tudo fica no navegador (localStorage), com usuários de demonstração.
- `supabase`: contas reais (Supabase Auth) e dados no Postgres do seu projeto, protegidos por Row Level Security.

## 1. Variáveis de ambiente

Copie `.env.example` para `.env.local` (o `.env.local` não vai para o Git) e preencha:

```env
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon ou publishable key>
```

Os dois valores ficam em **Project Settings → API** (ou **API Keys**). Use a chave **anon / publishable**: ela é pública por natureza e só enxerga o que as políticas RLS permitem.

> **Nunca** coloque a chave `service_role` / `secret` no app nem em variáveis `NEXT_PUBLIC_*`. Ela ignora o RLS e daria acesso total ao banco a qualquer visitante.

Reinicie o `npm run dev` depois de mudar o `.env.local`.

## 2. Autenticação

Em **Authentication**:

- **Sign In / Providers → Email**: deixe habilitado.
- **URL Configuration**: em *Site URL* coloque `http://localhost:3000`; em *Redirect URLs* adicione `http://localhost:3000/login` e `http://localhost:3000/reset-password` (e depois os mesmos caminhos no domínio de produção).
- **Confirm email**: opcional. Os convites são por link (o app não manda e-mail de convite), então desligar só tira a etapa de confirmar a conta. Lembre que o e-mail embutido do Supabase tem limite baixo por hora; ele é usado só na confirmação de conta e na recuperação de senha.

A recuperação de senha funciona assim: **Esqueci a senha** envia o link, o link abre `/reset-password` já autenticado para a troca, e a nova senha entra direto.

## 3. Aplicar o esquema

O esquema inteiro (tabelas, RLS, gatilhos e funções) está em `supabase/migrations/`, em arquivos aplicados em ordem de nome (o primeiro cria tudo; os seguintes ajustam). Use uma das opções abaixo.

**Pelo painel:** abra **SQL Editor**, cole o conteúdo de cada arquivo de `supabase/migrations/` em ordem e execute — um de cada vez, todos eles. Se já aplicou alguns, rode só os que faltam (os de nome mais novo).

**Pela CLI:**

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <project-ref>
```

```bash
npx supabase db push
```

O projeto deve estar vazio (ou sem tabelas com os mesmos nomes no schema `public`).

## 4. Primeiro acesso

1. `npm run dev` e abra `http://localhost:3000`.
2. Crie uma conta em **Criar conta** (o botão de demonstração some no modo Supabase).
3. O perfil é criado automaticamente (gatilho `handle_new_user`) e o onboarding começa.
4. Para testar com jogadores, crie uma segunda conta em outra janela anônima e convide o e-mail dela pela campanha.

## O que o banco garante

As permissões de `src/lib/permissions.ts` estão replicadas no banco, então valem mesmo se alguém chamar a API direto:

- Só membros enxergam a campanha; quem cria vira mestre automaticamente e a campanha nunca muda de dono.
- Entrar numa campanha só pelo link de convite (`join_campaign` confere o código e as vagas); ninguém, nem o mestre, adiciona pessoas direto. O código é aleatório, gerado pelo banco e visível só aos mestres; gerar outro invalida o anterior.
- Só quem criou a campanha muda papéis; o criador não pode ser removido nem rebaixado.
- As notas do mestre ficam numa tabela só dos mestres (`campaign_gm_notes`), fora da linha da campanha que os jogadores leem.
- Fichas completas só para o dono do personagem e para os mestres; os outros jogadores veem o grupo sem a ficha (`campaign_characters`). Personagem não muda de dono, e só entra numa campanha em que o dono joga.
- NPCs, encontros e mapas salvos são só do mestre; jogadores recebem os NPCs conhecidos sem segredos e só com fatos revelados (`known_npcs`).
- Entradas privadas do diário só para os mestres.
- Sistemas personalizados: o dono, e quem joga numa campanha do mesmo dono que usa o sistema.
- O e-mail do perfil vem da conta e não muda pelo perfil.

Para conferir essas regras localmente (Postgres em memória, sem Docker, 53 cenários incluindo tentativas de burlar cada regra):

```bash
npm run db:check
```

## O que ainda fica no navegador

Esta é a primeira etapa. Limitação conhecida: as mudanças de membros (papel, remoção, vínculo do personagem) comparam com a lista carregada na tela; se alguém entrar pelo link no mesmo instante em que o mestre remove outra pessoa, recarregue e confira.

Por enquanto continuam locais (por navegador):

- o estado da mesa ao vivo (tokens, névoa, chat, rolagens) — vem com a sincronização em tempo real;
- as imagens importadas como mapa (IndexedDB) — vão para o Supabase Storage;
- a voz e a central de áudio (LiveKit).
