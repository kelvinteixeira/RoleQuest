# Role Quest — Arquitetura Técnica

> Documento vivo. Atualize sempre que uma decisão estrutural mudar.

## 1. Visão geral

Role Quest é uma plataforma web de RPG de mesa online com três pilares:

1. **Mesa virtual** — mapa por tiles, tokens, fichas, dados, voz e chat em tempo real.
2. **Ferramentas do mestre** — controle de sessão, NPCs, encontros, áudio, narrativa.
3. **Chronicles Studio** — transforma os acontecimentos registrados numa sessão em roteiro e, futuramente, em episódio de vídeo.

O frontend é construído primeiro, sobre uma **camada de dados substituível**: hoje os repositórios usam dados locais (mock persistido no navegador); na Fase 7 serão trocados por implementações Supabase sem alterar componentes.

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
MockRepository (hoje)  →  SupabaseRepository (Fase 7)
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

## 5. Autenticação e permissões

- `stores/session.store.ts` guarda a sessão atual (persistida). `AuthGuard` protege o grupo `(dashboard)` e `campaign/*` no cliente.
- Na Fase 7: Supabase Auth + cookies SSR + `proxy.ts` (antigo middleware) para proteção no servidor, e **Row Level Security** como fonte de verdade das permissões.
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
- "Criar meu próprio sistema" gera um `SystemTemplate` com `kind: 'custom'` armazenado no repositório (editor completo na Fase 2).
- Nomes de sistemas são usados apenas de forma nominativa (compatibilidade). Role Quest não é afiliado aos titulares.

## 7. Decisões para as próximas fases

### Mapas (Fase 3)
- `features/map`: `MapDocument` serializável (terreno e elevação por célula + objetos), formas geométricas na grade (`model/shapes.ts`), modelos prontos e o renderizador 3D (`components/map-scene.tsx`, react-three-fiber). Terreno em dois `InstancedMesh` (corpo + topo), água num único plano com shader, objetos GLB normalizados ao tamanho da célula.
- `features/map-editor`: store do editor (rascunho, ferramenta, histórico) e painel. O mapa da sala só muda ao aplicar, via evento `map.replaced`.
- Assets 3D CC0 (Kenney, Quaternius) em `public/assets/map/props`, créditos em `public/assets/map/CREDITS.md`.
- Personagens: catálogo em `features/virtual-tabletop/model/character-models.ts` (arquivo, equipamento visível, mapa de animações, tingimento) e `components/character-figure.tsx` (clone com esqueleto, máquina de estados de animação). A store gera "cues" (ataque, conjuração, golpe) a partir dos eventos da mesa. GLBs em `public/assets/characters`, gerados por `scripts/build-character-assets.mjs` a partir dos pacotes originais (créditos em `public/assets/characters/CREDITS.md`).

### Mesa virtual (Fase 3)
- **Entregue (1ª versão):** `features/virtual-tabletop` com motor puro (`model/room-engine.ts`: `applyEvent` + construtores de eventos), mapa e caminhos (`model/map.ts`), bots de teste (`model/bots.ts`), store por campanha (`store/room.store.ts`) e o diretor de bots (`hooks/use-bot-director.ts`). O mapa usa SVG por enquanto; os itens abaixo continuam como plano para mapas grandes.
- Bots existem só no navegador e são marcados como bots na interface. Eles usam o mesmo `dispatch` de eventos que o mestre, então o fluxo será o mesmo com jogadores reais via Realtime.
- Renderização do mapa em **Canvas 2D** com camadas (terreno, objetos, tokens, fog, iluminação, desenho) e uma engine fora do React (`features/virtual-tabletop/engine`) que lê uma store Zustand; o React cuida só de painéis e ferramentas. Evita re-render do DOM a cada movimento.
- Estado do mapa como documento serializável (`MapDocument`) com camadas e operações — base para undo/redo e sincronização.
- Fog of War e visibilidade calculados por jogador no cliente do mestre e **filtrados no servidor** (o jogador não recebe o que não pode ver).

### Tempo real (Fase 4)
- **Supabase Realtime** (broadcast + presence) para movimentos de tokens, rolagens, chat e estado da sessão. Socket.IO só seria adicionado se surgir um requisito que o Realtime não atenda.
- Operações de mesa são eventos (`token.moved`, `dice.rolled`…) — o mesmo log alimenta o Chronicles Studio.

### Voz (Fase 4)
- LiveKit (self-host ou cloud). Token de acesso emitido por uma Edge Function após checar a participação na campanha.
- A UI de voz só mostrará estado "conectado" quando houver conexão real. Nada de chamada simulada.

### Áudio ambiente (Fase 4)
- Web Audio API com dois barramentos independentes: **música/ambiente** e **efeitos**, cada um com ganho mestre e ganho local do jogador.

### Chronicles Studio (Fase 6)
- Fonte: log de eventos da sessão (`SessionEvent`) + momentos épicos marcados pelo mestre.
- Roteiro gerado a partir dos eventos reais; IA (futura) só reorganiza/redige — **não inventa decisões ou falas dos jogadores**.
- Episódio = timeline de cenas (`EpisodeScene`) serializável → composição Remotion. Render em servidor/worker, saída 1920×1080 e 1080×1920.
- Captura de voz exige consentimento explícito de cada participante, registrado por sessão.

### IA narrativa (futuro)
- Interface `NarrativeAssistant` com provedores plugáveis; toda sugestão é rascunho que o mestre aceita ou descarta.
