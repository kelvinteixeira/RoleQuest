# Role Quest — Arquitetura Técnica

> Documento vivo. Atualize sempre que uma decisão estrutural mudar.

## 1. Visão geral

Role Quest é uma plataforma web de RPG de mesa online com três pilares:

1. **Mesa virtual** — mapa por tiles, tokens, fichas, dados, voz e chat em tempo real.
2. **Ferramentas do mestre** — controle de sessão, NPCs, encontros, áudio, narrativa.
3. **Chronicles Studio** — transforma os acontecimentos registrados numa sessão em roteiro e, futuramente, em episódio de vídeo.

O frontend é construído primeiro, sobre uma **camada de dados substituível**: os repositórios têm duas implementações, escolhidas por `NEXT_PUBLIC_DATA_SOURCE`: `mock` (dados locais persistidos no navegador) e `supabase` (Auth + Postgres com RLS). Os componentes não mudam entre elas.

## 2. Stack

| Camada | Tecnologia | Motivo |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, Cache Components) | Roteamento por segmentos, RSC, streaming |
| UI | React 19 + TypeScript (strict) | Tipagem rigorosa em todo o domínio |
| Estilo | Tailwind CSS v4 (tokens em `@theme`) | Design system via CSS variables, temas por sistema de RPG |
| Estado | Zustand | Stores pequenas por domínio, sem boilerplate, fácil de usar fora do React (engine de mapa, áudio) |
| Animação | Framer Motion | Transições de página, modais, dados |
| Ícones | Lucide React | Minimalistas e consistentes |
| Backend (Fase 7) | Supabase Auth, Postgres + RLS, Storage, Realtime | Auth, persistência, mídia e broadcast/presence |
| Voz (Fase 4) | WebRTC via **LiveKit** (SFU) | Malha P2P não escala além de ~4–5 participantes; SFU dá baixa latência, reconexão e controle de mute pelo servidor |
| Vídeo (Fase 6) | **Remotion** | Composições de vídeo em React, render 1080p 16:9 e 9:16 |

Dependências adicionais são evitadas: validação de formulários e carregamento assíncrono usam utilitários próprios pequenos (`src/lib/validation.ts`, `src/hooks/use-async.ts`).

## 3. Organização de pastas

```
src/
  app/                       Rotas (somente composição; sem regra de negócio)
    (auth)/                  login, register, forgot-password, onboarding
    (dashboard)/             dashboard, campaigns, characters, systems, library, settings
    campaign/[campaignId]/   visão da campanha (sala, fichas, diário e chronicles virão aqui)
  components/
    ui/                      Primitivos do design system (Button, Card, Modal, Tabs…)
    layout/                  AppShell, Sidebar, Topbar, MobileNav, PageHeader
    navigation/              Configuração de navegação
    feedback/                Toaster, EmptyState, ErrorState, LoadingState
    brand/                   Logo e marca
  features/                  Módulos por domínio (componentes + hooks + stores do domínio)
    authentication/
    dashboard/
    campaigns/               inclui o wizard de criação
    systems/                 biblioteca dos 10 sistemas + modelo "sistema próprio"
    characters/
    library/
    settings/
  services/                  Regras de negócio e orquestração (validação, permissões, agregações)
  repositories/
    contracts.ts             Interfaces de acesso a dados (o "contrato" com o backend)
    mock/                    Implementação local (in-memory + localStorage)
    index.ts                 Fábrica que escolhe a implementação (mock | supabase)
  mocks/fixtures/            Dados fictícios — usados SOMENTE pelos repositórios mock
  stores/                    Stores globais (sessão do usuário, UI, toasts)
  hooks/                     Hooks genéricos (use-async, use-mounted…)
  types/                     Tipos de domínio
  lib/                       Utilitários puros (cn, datas, ids, permissões, validação)
  config/                    Configuração da aplicação (fonte de dados, flags de recursos)
  constants/                 Constantes de produto (estilos visuais, rótulos)
```

Módulos que chegam nas próximas fases (`virtual-tabletop`, `map-editor`, `tokens`, `dice`, `combat`, `voice-chat`, `text-chat`, `audio-engine`, `game-master`, `npc`, `timeline`, `chronicles-studio`, `video-editor`) seguem a mesma convenção dentro de `features/`.

## 4. Fluxo de dados

```
Componente (features/*/components)
   │ usa
Hook do domínio (features/*/hooks, ex.: useDashboardData)
   │ chama
Service (src/services) ── regras: validação, permissões, ordenação, agregação
   │ chama
Repository (contrato em repositories/contracts.ts)
   │ implementado por
MockRepository (mock)  |  SupabaseRepository (supabase)
```

Regras:

- **Componentes nunca importam fixtures** nem repositórios diretamente. Eles usam hooks/services.
- **Fixtures nunca são importadas por services.** Só os repositórios mock as conhecem.
- **Services são funções puras de orquestração**, testáveis sem React.
- Erros de domínio são `AppError` com `code` tipado; a UI traduz para mensagens.

### Repositórios mock

- Banco em memória semeado a partir de `mocks/fixtures`, persistido em `localStorage` (`rq:mock-db:v1`).
- Latência artificial pequena (`config/app.ts → mockLatencyMs`) para exercitar estados de carregamento.
- `resetMockDatabase()` restaura o estado inicial (disponível em Configurações).
- Senhas no mock são armazenadas como hash SHA‑256 (Web Crypto). **Isso não é segurança real** — é só para não manter texto puro no navegador. A autenticação real será Supabase Auth.

### Repositórios Supabase

- `lib/supabase/client.ts`: cliente único do navegador com a chave anon/publishable (nunca a `service_role`).
- `repositories/supabase/mappers.ts`: conversão linha (snake_case) ↔ domínio, sem I/O e testada; objetos aninhados (mundo, política de jogadores, ficha, sistema) ficam em colunas `jsonb`.
- `repositories/supabase/errors.ts`: erros do PostgREST/Auth viram `AppError` (`42501` → `forbidden`, vagas esgotadas → `validation`…).
- O que o RLS sozinho não expressa vira função `security definer`: entrar pelo link de convite (e a prévia antes de entrar), gerar o código do link, ver o grupo sem as fichas alheias, NPCs conhecidos sem segredos.
- Esquema em `supabase/migrations/`; `npm run db:check` aplica as migrações num Postgres em memória (PGlite) e roda os cenários de acesso. Configuração passo a passo em [SUPABASE.md](SUPABASE.md).

## 5. Autenticação e permissões

- `stores/session.store.ts` guarda a sessão atual (persistida). `AuthGuard` protege o grupo `(dashboard)` e `campaign/*` no cliente.
- Com `DATA_SOURCE=supabase`: Supabase Auth (sessão no navegador, renovada por `authService.resume` ao abrir o app) e **Row Level Security** como fonte de verdade das permissões. Proteção de rotas no servidor (cookies SSR + `proxy.ts`) fica para quando houver rotas renderizadas com dados no servidor.
- Papéis são **por campanha** (`CampaignMember.role = 'game_master' | 'player'`). O mesmo usuário pode ser mestre numa campanha e jogador em outra.
- `lib/permissions.ts` define a matriz de capacidades (`campaign:manage`, `map:edit`, `sheet:edit-own`, `chat:private-gm`…). A UI usa `can(role, capability)`; o backend replicará a mesma matriz em políticas RLS.

## 5.1 Identidade visual

- Logo original: `public/brand/role-quest-logo.webp`. Versão vetorial em `src/components/brand/logo.tsx` (d20 em linha branca, "play" violeta e órbita em meia-lua) e favicon em `src/app/icon.svg`.
- Paleta derivada da logo, em tokens OKLCH em `src/app/globals.css`:

| Token | Uso | Valor de referência |
| --- | --- | --- |
| `canvas` / `surface-*` | Fundos: preto quase puro com leve tom violeta | `#0B0A0F` |
| `brand-ink` | Linhas da logo, texto principal | `#FAFAFA` |
| `accent-solid` | Botões e controles preenchidos (texto branco, 4,54:1) | `#9F41FB` |
| `accent` | Texto, ícones e bordas de destaque sobre fundo escuro (≥ 4,5:1) | violeta claro |
| `brand-from` → `brand-to` | Degradê da órbita | `#7D42DA` → `#B345FF` |

- Sistemas de RPG mantêm seus próprios acentos via `--system-accent`, sem alterar a marca.

## 6. Sistemas de RPG

- Cada sistema é um `SystemTemplate` (tipo em `types/system.ts`) em `features/systems/templates/`.
- O template descreve **estrutura** (atributos, recursos, perícias, dados, iniciativa, inventário, condições, campos personalizados, regras configuráveis, modelos de campanha e de mapa) — nunca texto de livros.
- Identidade visual por sistema: `theme.accent` vira a CSS variable `--system-accent` no escopo do componente, mantendo o design neutro global.
- "Criar meu próprio sistema" gera um `SystemTemplate` com `kind: 'custom'` armazenado no repositório; o editor (`features/systems/components/editor`, regras em `features/systems/model/system-editor.ts`) só edita sistemas do próprio dono. As chaves (atributo, perícia, recurso, classe) nascem do nome e nunca mudam ao renomear, para as fichas existentes não perderem dados; remover algo limpa as referências (`pruneReferences`). As fórmulas do template são texto descritivo: quem decide a rolagem é `dice.mechanic`.
- Classes (`SystemTemplate.classes`) ficam na ficha em `sheet.classKey`; `applyClass` move os máximos de recurso pela diferença de bônus ao trocar de classe, treina as perícias da classe e adiciona as habilidades uma vez.
- Administração da campanha em `services/campaign-admin.service.ts` (`campaign:manage` / `campaign:invite`): quem criou a campanha continua mestre e nunca é removido; sempre há pelo menos um mestre. Jogadores entram pelo **link de convite** (`/join/[code]`): um código aleatório por campanha, visível só aos mestres, que podem gerar outro (o anterior para de valer) ou desativá-lo; a entrada confere as vagas na hora.
- Nomes de sistemas são usados apenas de forma nominativa (compatibilidade). Role Quest não é afiliado aos titulares.

## 7. Decisões para as próximas fases

### Fichas (Fase 2)
- `features/character-sheet/model`: `sheet.ts` (ficha padrão a partir do modelo, mescla de fichas antigas, modificadores, carga) e `checks.ts` (resolvedor de testes por mecânica de dados). Puro, sem React.
- `services/character.service.ts`: CRUD, vínculo com a campanha e permissões (dono edita conforme a política da campanha; mestre vê e edita tudo; anotações privadas só para dono e mestre).
- `hooks/use-character-sheet.ts`: rascunho local com salvamento automático (debounce).
- Aba **Combate** da ficha (`SheetCombat`): defesa (automática a partir dos atributos ou manual), armadura, deslocamento e ataques (atributo, perícia, bônus, dano com `@mod`/`@value`, alcance). Ataque novo vem com o atributo/perícia corpo a corpo do sistema (`model/combat-defaults.ts`).

### Combate por sistema (Fase 3)
- `features/combat/model`: `rules.ts` resolve ataques pela mecânica do sistema — d20 contra defesa fixa (D&D, Pathfinder com crítico por +10, Tormenta20, Ordem com d20 mantém o maior), d100 contra Esquivar com níveis de sucesso (CoC), parada contra parada com dano pela margem (Vampiro/Lobisomem), 1d6+FA contra 1d6+FD (3D&T), 1d10 contra 1d10 com explosão (Cyberpunk RED) e 3d6 com defesa ativa (GURPS). Também iniciativa por sistema e a tradução das fichas de NPC (escritas em termos d20, `NpcStatBlock`) para cada escala. `profile.ts` transforma a ficha no bloco de combate do token. Puro, testado com dados roteirizados (`src/test/rng.ts`).
- A sala guarda `rules` (sistema da campanha). Tokens de jogador seguem a ficha (`token.synced`, ao abrir a sala e ao editar a ficha dentro dela) e os PV vão nos dois sentidos: o que muda na mesa é salvo na ficha (`hooks/use-sheet-hp-writeback.ts`) e aparece na ficha aberta sem desfazer outras edições; PV editados na ficha movem o token. Tokens de salas antigas são ligados às fichas da campanha pelo nome (`token.linked`); inimigos e bots guardam o `npc` e são recalculados em `rules.set`. Salas salvas antes disso são migradas em `model/room-migration.ts` (versão 1 da store persistida).

### Mapas (Fase 3)
- `features/map`: `MapDocument` serializável (terreno e elevação por célula + objetos), formas geométricas na grade (`model/shapes.ts`), modelos prontos e o renderizador 3D (`components/map-scene.tsx`, react-three-fiber). Terreno em dois `InstancedMesh` (corpo + topo), água num único plano com shader, objetos GLB normalizados ao tamanho da célula.
- `features/map-editor`: store do editor (rascunho, ferramenta, histórico) e painel. O mapa da sala só muda ao aplicar, via evento `map.replaced`.
- Assets 3D CC0 (Kenney, Quaternius) em `public/assets/map/props`, créditos em `public/assets/map/CREDITS.md`.
- **Portas e armadilhas** são props com `feature` (`door`, `gate`, `trap-spikes`, `trap-darts`), desenhados com primitivas em `map-scene.tsx` (sem GLB). O estado fica no próprio `PlacedProp` (`door: { open, locked }`, `trap: { hidden, armed, damage }`) e muda na mesa pelo evento `prop.updated`. Porta fechada bloqueia movimento (`isBlocked`) e, se for de madeira, a visão (`blocksSight`); grades só o movimento.
- **Iluminação**: `MapDocument.ambient` (`bright`/`dim`/`dark`), fontes de luz em `PropDef.light` (fogueira, tocha, braseiro; `PlacedProp.lit` apaga) e luz carregada (`RoomToken.light`). `vision.ts → visibleInLight`: uma casa é vista se está em linha de visão e dentro da visão, e perto o bastante para ver sem luz (dia: toda a visão; penumbra: 3; escuro: 1) ou iluminada por uma luz com linha de visão até ela. A renderização usa a mesma tabela de ambiente e um `pointLight` por fonte acesa.
- **Imagem como mapa**: `MapDocument.background` guarda só a referência (`imageId`), o tamanho e o alinhamento em casas (`model/background.ts`). O arquivo é reduzido para 2048 px e salvo pelo contrato `MapImageRepository`: no modo local, IndexedDB (`repositories/mock/images.ts`); com o Supabase, o bucket `map-images` na pasta da campanha (mestres gravam e veem tudo; jogadores só baixam a imagem do mapa que está nas visões deles, `can_see_map_image`). Imagens antigas, só do navegador do mestre, sobem quando ele conduz a mesa (`useLegacyMapImage`).
- **Camadas e anotações**: o editor tem estado de camadas (visível/travada) em `map-editor.store.ts`; ferramentas não mexem em camadas travadas (a borracha respeita cada uma). `MapDocument.notes` são anotações do mestre, renderizadas só para ele na mesa.
- **Biblioteca de mapas**: `MapRepository` (contrato) + `services/map.service.ts` (só o mestre, `map:edit`). Salvar usa o id do documento (salvar de novo atualiza); "cópia" gera id novo. Banco local na versão 3 (`maps`).
- Personagens: catálogo em `features/virtual-tabletop/model/character-models.ts` (arquivo, equipamento visível, mapa de animações, tingimento) e `components/character-figure.tsx` (clone com esqueleto, máquina de estados de animação). A store gera "cues" (ataque, conjuração, golpe) a partir dos eventos da mesa. GLBs em `public/assets/characters`, gerados por `scripts/build-character-assets.mjs` a partir dos pacotes originais (créditos em `public/assets/characters/CREDITS.md`).

### Mesa virtual (Fase 3)
- **Entregue (1ª versão):** `features/virtual-tabletop` com motor puro (`model/room-engine.ts`: `applyEvent` + construtores de eventos), mapa e caminhos (`model/map.ts`), bots de teste (`model/bots.ts`), store por campanha (`store/room.store.ts`) e o diretor de bots (`hooks/use-bot-director.ts`). O mapa usa SVG por enquanto; os itens abaixo continuam como plano para mapas grandes.
- Bots existem só no navegador e são marcados como bots na interface. Eles usam o mesmo `dispatch` de eventos que o mestre, então o fluxo será o mesmo com jogadores reais via Realtime.
- Renderização do mapa em **Canvas 2D** com camadas (terreno, objetos, tokens, fog, iluminação, desenho) e uma engine fora do React (`features/virtual-tabletop/engine`) que lê uma store Zustand; o React cuida só de painéis e ferramentas. Evita re-render do DOM a cada movimento.
- Estado do mapa como documento serializável (`MapDocument`) com camadas e operações — base para undo/redo e sincronização.
- **Névoa de guerra (entregue, local):** `features/map/model/vision.ts` calcula linha de visão (Bresenham) com raio. `RoomState.fog` guarda `explored` (índices de células); o reducer (`explore` em `room-engine.ts`) soma o que os personagens de jogador em pé veem após eventos que mudam a visão — determinístico, então cada cliente que aplica os mesmos eventos chega ao mesmo estado. O mestre revela/esconde com `fog.revealed`/`fog.hidden`. A visão atual é derivada (`partyVision`), não armazenada. Listas grandes de células ficam fora do log.
- Movimento: `walk()` percorre a rota (`routeTo`: linha reta se livre, senão BFS) e para na primeira armadilha armada, revelando, desarmando e rolando o dano (ignora armadura). Bots usam o mesmo caminho.
- Com jogadores reais (Fase 4/7), o que o jogador não pode ver deve ser **filtrado no servidor** (hoje a prévia "ver como os jogadores" só esconde na renderização).

### Tempo real (mesa compartilhada)
- **Um anfitrião por mesa:** o cliente de um mestre conduz a mesa (`features/virtual-tabletop/sync/use-room-sync.ts`). Ele guarda o estado completo, aplica os eventos (`room-engine.ts`), salva em `room_states` e escreve a visão de cada participante em `room_views`. A vez de conduzir é um "aluguel" renovado a cada 10 s (`claim_room_host`); outro mestre pode assumir.
- **Visões filtradas no anfitrião** (`sync/views.ts`): jogadores nunca recebem o estado completo. Ficam de fora inimigos fora da visão do grupo, armadilhas ocultas, notas do mestre, blocos de estatística de NPCs, rolagens secretas e sussurros de outros. O mapa dos jogadores vai à parte (`room_view_maps`), sem notas nem armadilhas ocultas. Cada visão leva os eventos recentes que a pessoa pode ver, para tocar animações, números de dano e sons.
- **Pedidos (intents)** (`sync/intents.ts`): jogadores inserem em `room_intents` (o RLS garante que falam só por si); o anfitrião valida contra a mesa e os direitos da pessoa (personagem próprio, sua vez no combate, regras da mesa, alcance, porta ao lado) e rola os dados ele mesmo. Co-mestres mandam eventos prontos (`kind: "events"`).
- **Transporte:** Supabase Realtime `postgres_changes` sobre essas tabelas (o RLS vale para cada inscrito), atrás do contrato `RoomSyncRepository`. Sem backend (modo local) a mesa fica no aparelho, como antes.
- **Presença:** `room_presence` com batimento a cada 10 s; só mestres podem marcar que conduzem.
- Operações de mesa são eventos (`token.moved`, `message.posted`…) — o mesmo log alimenta o Chronicles Studio.

### Chronicles Studio (Fase 6)
- `features/chronicles/model`: momentos com nota de drama (`moments.ts`), esquema do roteiro em Zod e normalização (`script.ts`), prompts de imagem (`prompts.ts`), roteiro por regras sem chave (`demo-script.ts`).
- Rotas de servidor `app/api/chronicles/{script,image,status}`: Claude (saída estruturada validada pelo mesmo esquema) e Gemini (imagens com referências de personagem); chaves só no servidor; só mestres da campanha (token do Supabase conferido no servidor).
- `services/chronicles.service.ts` orquestra: momentos, roteiro, retratos, quadros e salvamento a cada imagem (`ChronicleRepository`: tabela `chronicle_episodes` e bucket privado `chronicles`).
- `features/chronicles/video/episode-video.tsx`: composição Remotion usada no player e na exportação no navegador (`@remotion/web-renderer`), presa ao que a renderização no cliente suporta (sem z-index, gradientes lineares, fontes do sistema, SVG como imagem).

### Central de áudio
- O som da mesa é estado da sala (`room.audio`: trilha atual e camadas de ambiente), mudado por eventos `audio.music`, `audio.layer` (uma camada por vez, para dois mestres não desfazerem um ao outro) e `audio.ambience` (silêncio) — só mestres. Ele viaja nas visões como o resto, então todos tocam o mesmo: cada navegador sincroniza o próprio alto-falante (`features/audio-engine/mixer.ts`).
- Trilhas: temas generativos (`music.ts`, compassos com sorteio de semente fixa e relógio de agendamento, iguais em todos os navegadores a partir de `startedAt`) ou faixas enviadas (bucket `table-audio`, decodificadas uma vez). Ambientes sintetizados em `ambience.ts` (ruído filtrado com modulações e sons esparsos).
- Cada pessoa tem o próprio volume de música, ambiente e efeitos (`preferences.store`).

### Voz (Fase 4)
- LiveKit (self-host ou cloud). Token de acesso emitido por uma Edge Function após checar a participação na campanha.
- A UI de voz só mostrará estado "conectado" quando houver conexão real. Nada de chamada simulada.

### Áudio
- **Efeitos (entregue):** `features/audio-engine/sfx.ts` sintetiza os sons com Web Audio (sem arquivos) num barramento de efeitos com volume próprio. `room-sounds.ts` traduz cada lote de eventos da mesa em sons (função pura); a store publica o lote e `use-room-sounds.ts` toca respeitando a preferência do dispositivo.
- **Música/ambiente (Fase 4):** segundo barramento independente, com ganho mestre e ganho local do jogador.
- **Dados 3D:** `features/dice/components/dice-tray.tsx` anima os dados de cada rolagem num canvas próprio sobre a mesa; o resultado já vem do motor de dados, a animação é só visual.

### Ferramentas do mestre (Fase 5)
- `types/gm.ts` + contratos `NpcRepository`, `EncounterRepository`, `JournalRepository` (banco local v4, com dados de exemplo para a campanha de demonstração).
- `services/gm.service.ts`: tudo é do mestre (`npc:manage`); jogadores recebem só `knownNpcs` (NPCs conhecidos, descrição pública e fatos revelados — nunca notas secretas nem estatísticas) e as entradas públicas do diário. Com o Supabase, as mesmas regras viram RLS.
- `features/gm/model`: `npc.ts` (visão do jogador, validação, token do NPC no sistema da sala), `encounter.ts` (dificuldade estimada: ameaça das criaturas × orçamento do grupo; posicionamento longe do grupo), `journal.ts` (classifica as mensagens públicas da sala em entradas do diário; `sourceId` evita duplicar), `generators.ts` (determinístico por semente; texto original).
- Na sala, a aba Mestre usa as ações `addTokens` e `post` da mesa, então NPCs e encontros entram como eventos normais (prontos para o Realtime).
- Reforços durante um combate entram pelo evento `combat.joined` (iniciativa própria; quem está agindo mantém o turno).
- Diário: remover uma entrada que veio da mesa a marca como `dismissed` (fica oculta), para que "Registrar" não a traga de volta; anotações do mestre são apagadas de fato. Os momentos vão para a sessão em andamento (`currentSession`: ao vivo ou iniciada nas últimas 12 h), não para a próxima agendada.

### Chronicles Studio (Fase 6)
- Fonte: log de eventos da sessão (`SessionEvent`) + momentos épicos marcados pelo mestre.
- Roteiro gerado a partir dos eventos reais; IA (futura) só reorganiza/redige — **não inventa decisões ou falas dos jogadores**.
- Episódio = timeline de cenas (`EpisodeScene`) serializável → composição Remotion. Render em servidor/worker, saída 1920×1080 e 1080×1920.
- Captura de voz exige consentimento explícito de cada participante, registrado por sessão.

### IA narrativa (futuro)
- Interface `NarrativeAssistant` com provedores plugáveis; toda sugestão é rascunho que o mestre aceita ou descarta.
