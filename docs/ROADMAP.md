# Role Quest — Plano de desenvolvimento

Legenda: ✅ entregue · 🟡 parcial · ⬜ pendente

## Fase 1 — Fundação ✅
- ✅ Next.js 16 + TypeScript strict + Tailwind v4
- ✅ Estrutura de pastas por domínio
- ✅ Design system (tokens, tipografia, primitivos de UI)
- ✅ Layout global (sidebar, topbar, navegação mobile)
- ✅ Autenticação visual funcional em modo local: login, cadastro, recuperação de senha, configuração de perfil
- ✅ Dashboard com campanhas, convites, sessões, personagens, sistemas e bibliotecas
- ✅ Camada de dados: contratos de repositório, implementação mock persistida, services
- ✅ Biblioteca dos 10 sistemas (modelos estruturais) + modelo "sistema próprio"

## Fase 2 — Campanhas e personagens 🟡
- ✅ Assistente de criação de campanha (7 etapas, prévia ao vivo) + opção "começar do zero"
- ✅ Página da campanha (visão geral, membros, sessões)
- ✅ Aceitar/recusar convites
- ⬜ Editor completo de "sistema próprio" (atributos, perícias, classes, progressão)
- ✅ Criação, edição, duplicação e exclusão de personagens; fichas a partir do modelo de cada sistema com salvamento automático
- ✅ Atributos, recursos, condições, perícias (atributo escolhível), habilidades, campos personalizados, história e anotações privadas
- ✅ Testes pela mecânica de cada sistema (d20+mod, d100 com dados de bônus/penalidade, parada de d10, Xd20, 1d6+atributo, 1d10 explosivo, 3d6)
- ✅ Inventário com equipado, slots, carga e moedas
- ✅ Ficha aberta dentro da sala, com testes publicados no chat
- ⬜ Gerenciamento de jogadores e permissões por campanha

## Fase 3 — Virtual Tabletop ✅
- ✅ Sala de jogo em tela cheia (`/campaign/[id]/session`), estado por eventos (`RoomEvent`) salvo no navegador
- ✅ Mapa 3D (three.js) em visão de cima inclinada: terreno por tiles com elevação, água animada, objetos 3D CC0, luz e sombras; câmera com zoom, pan, giro e vista de topo
- ✅ Editor de mapas do mestre: terreno, objetos, elevar/rebaixar, borracha e girar; formas pincel, retângulo, contorno, elipse, linha e balde; desfazer/refazer; modelos prontos; redimensionar
- ✅ Tokens 3D arrastáveis com linha de movimento, distância e alcance; regras de bloqueio por terreno e objetos (pontes liberam a água)
- ✅ Personagens e criaturas 3D animados (CC0): guerreiro, bárbaro, mago, assassino, arqueiro, vampiro, esqueletos, necromante, morcegos, lobo e lobisomem; parado, andar, atacar, conjurar, levar golpe e morrer; aparência trocável pelo mestre
- ✅ Combate: iniciativa, turnos, PV com feedback visual, condições, ataque simplificado (d20 + bônus × defesa)
- ✅ Rolador de dados (d4–d100, múltiplos, modificador, vantagem/desvantagem, pública/só mestre) e comandos no chat
- ✅ Chat geral, privado mestre ↔ jogador e mensagens do sistema; "Momento épico" registrado no log
- ✅ Bots de teste locais (jogam turnos, curam, conversam, respondem sussurros) e inimigos automáticos
- ✅ Biblioteca de mapas por campanha: salvar, atualizar, copiar, abrir no editor, excluir e usar na mesa (miniaturas)
- ✅ Névoa de guerra: o que os personagens veem (linha de visão com raio ajustável) vira área explorada; paredes, rochas e portas fechadas bloqueiam a visão; pincel do mestre para revelar e esconder; visão do mestre com véu e prévia "ver como os jogadores" (escuridão total, inimigos fora da vista ocultos)
- ✅ Portas de madeira e grades de ferro (abrir, fechar, trancar; grades deixam ver através), alinhadas às paredes; armadilhas de espinhos e dardos ocultas e armadas que disparam uma vez no caminho de quem passa (jogadores, bots e inimigos), com dano configurável; modelo "Cripta esquecida"
- ✅ Iluminação dinâmica: luz ambiente do mapa (dia, penumbra, escuridão), fogueiras, tochas de parede e braseiros que acendem e apagam, luz carregada por token (vela, tocha, lanterna, magia); no escuro o grupo só vê o que está ao lado ou iluminado, e a névoa segue a luz
- ✅ Importar imagem como mapa: desenho por baixo da grade (PNG, JPG, WebP), casas na largura, ajuste fino e opacidade; paredes, portas e armadilhas pintadas por cima; imagem guardada no navegador (IndexedDB)
- ✅ Camadas no editor (imagem de fundo, terreno, objetos, anotações do mestre) com ocultar e travar; ferramenta "Anotar" e anotações visíveis só para o mestre na mesa
- ✅ Regras de combate por sistema a partir das fichas: aba Combate na ficha (defesa, armadura, deslocamento, ataques com alcance), ataque e defesa pela mecânica de cada sistema, iniciativa por sistema, inimigos e bots convertidos para a escala do sistema; PV sincronizados entre mesa e ficha; personagens de demonstração com fichas preenchidas
- ✅ Dados 3D (rolam sobre a mesa a cada rolagem e mostram os valores) e efeitos sonoros sintetizados (dados, golpes, cura, portas, grades, armadilhas, fogo, passos, início de combate), com botão de silenciar

## Fase 4 — Comunicação ⬜
Chat geral/privado/sistema/anotações, voz WebRTC (LiveKit), presença, sincronização em tempo real, central de áudio.

## Fase 5 — Ferramentas avançadas do mestre ✅
- ✅ NPCs por campanha (`/campaign/[id]/gm`): descrição pública, notas secretas, fatos a revelar, atitude, aparência e bloco de combate que se adapta ao sistema
- ✅ Revelar fatos na mesa (aba Mestre): vai para o chat e para o diário; os jogadores só veem NPCs conhecidos e fatos revelados
- ✅ Encontros prontos com estimativa de dificuldade para o grupo; "Rodar" põe as criaturas no mapa e rola a iniciativa
- ✅ Diário e linha do tempo (`/campaign/[id]/journal`): momentos da mesa registrados com um clique (combates, quedas, armadilhas, revelações, momentos épicos, 20/1 naturais) e anotações do mestre, públicas ou privadas
- ✅ Geradores por cenário (fantasia, horror, moderno/cyberpunk): NPC rápido por nível de ameaça, nomes, lugares, tesouro e ganchos
- ✅ Combate e iniciativa (entregues na Fase 3)

## Fase 6 — Chronicles Studio ⬜
Log de eventos, momentos épicos, diário automático, roteiro estruturado, editor de episódios, composições Remotion.

## Fase 7 — Supabase ⬜
Auth real, Postgres + RLS, Storage, Realtime, troca de `DATA_SOURCE` para `supabase`.

## Como verificar cada entrega
```bash
npm run typecheck
npm run lint
npm test
npm run build
```
