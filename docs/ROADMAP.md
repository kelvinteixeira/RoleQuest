# Role Quest — Plano de desenvolvimento

Legenda: ✅ entregue · 🟡 parcial · ⬜ pendente

## Fase 1 — Fundação ✅
- ✅ Next.js 16 + TypeScript strict + Tailwind v4
- ✅ Estrutura de pastas por domínio
- ✅ Design system (tokens, tipografia, primitivos de UI)
- ✅ Layout global (sidebar, topbar, navegação mobile)
- ✅ Autenticação visual funcional em modo local: login, cadastro, recuperação de senha, configuração de perfil
- ✅ Dashboard com campanhas, entrada por link de convite, sessões, personagens, sistemas e bibliotecas
- ✅ Camada de dados: contratos de repositório, implementação mock persistida, services
- ✅ Biblioteca dos 10 sistemas (modelos estruturais) + modelo "sistema próprio"

## Fase 2 — Campanhas e personagens ✅
- ✅ Assistente de criação de campanha (7 etapas, prévia ao vivo) + opção "começar do zero"
- ✅ Página da campanha (visão geral, membros, sessões)
- ✅ Entrar numa campanha pelo link de convite do mestre (`/join/[code]`), com prévia da mesa e das vagas
- ✅ Editor completo de "sistema próprio" (`/systems/[id]/edit`): identidade e cor, mecânica de teste, atributos, recursos, perícias, classes (bônus, perícias treinadas, habilidades iniciais), progressão com tabela de níveis, condições, campos da ficha, combate e inventário; criar do zero ou "duplicar como meu" a partir de qualquer sistema; classe escolhida na ficha
- ✅ Criação, edição, duplicação e exclusão de personagens; fichas a partir do modelo de cada sistema com salvamento automático
- ✅ Atributos, recursos, condições, perícias (atributo escolhível), habilidades, campos personalizados, história e anotações privadas
- ✅ Testes pela mecânica de cada sistema (d20+mod, d100 com dados de bônus/penalidade, parada de d10, Xd20, 1d6+atributo, 1d10 explosivo, 3d6)
- ✅ Inventário com equipado, slots, carga e moedas
- ✅ Ficha aberta dentro da sala, com testes publicados no chat
- ✅ Configurações da campanha (`/campaign/[id]/settings`): informações, mundo e narrador; regras da mesa (editar fichas, mover tokens, mensagens privadas, rolagens públicas, vagas); jogadores (tornar mestre/jogador, remover) e link de convite (copiar, gerar outro, desativar)
- ✅ Fichas da campanha (`/campaign/[id]/characters`): o mestre abre todas, o jogador a sua

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
- ✅ Dados 3D arremessados sobre toda a mesa: faces numeradas (d4 a d20 e d100) que caem com o resultado virado para a câmera, quiques com gravidade, poeira, estalo e tremor de câmera a cada batida; o d20 sozinho termina em câmera lenta; crítico com coluna de luz dourada, onda de choque, faíscas e clarão; falha crítica com fumaça vermelha, brasas e tremor. Efeitos sonoros sintetizados (dados, golpes, cura, portas, grades, armadilhas, fogo, passos, início de combate), com botão de silenciar
- ✅ Construções no editor: arrastar um lote gera casa, taverna, templo, torre, castelo (com fortaleza e sala do trono), ruínas, praça ou fazenda, com piso, paredes, porta e mobília; terrenos novos (assoalho, calçamento, tapete, neve, parede de madeira, muralha de pedra); mapas prontos "Vilarejo da encruzilhada" e "Castelo do vale"
- ✅ Mobília e itens de vila (17 peças: barril, mesa, cama, trono, poço, barraca de feira…) e objetos colocados um por clique, com giro antes de colocar; árvores, rochas e plantas mantêm o modo "Espalhar vários"
- ✅ Cercas nas linhas da grade (e peça de canto): a casa fica livre e o token não atravessa o lado cercado
- ✅ Personagens no mapa: NPCs da campanha, pessoas e criaturas posicionados no editor (só o mestre vê) viram tokens ao aplicar o mapa; reaplicar não traz de volta quem já entrou
- ✅ Bestiário: 39 monstros prontos, do slime ao dragão ancião, com 34 modelos animados CC0; no editor (Personagens → Monstros) e na mesa (aba Mestre → Bestiário)
- ✅ Criaturas grandes ocupam 2×2, 3×3 ou 4×4 casas: ninguém entra no espaço delas, não passam em vão estreito, alcance e distância medidos pela borda
- ✅ Modelos revistos: taverneiro (com caneca) e aldeão com corpos próprios; lobisomem bípede animado com focinho, cauda e olhos acesos; golem de pedra facetado com pedras nos ombros, costas e antebraços; dragão jovem com corpo inteiro; lula flutuante sem asas nem chifres (distinta do diabrete); slimes, gosmas e cogumelos balançam, quicam e pulam
- ✅ Movimento planejado: clicar no chão (ou arrastar o token) mostra o caminho e a distância; só anda depois de confirmar (Enter) ou cancela (Esc); no combate o jogador só planeja com o próprio personagem e na sua vez, sem passar do deslocamento; o boneco segue o caminho sem voltar ao início
- ✅ Câmera em 3ª pessoa: atrás do personagem selecionado (ou de quem está na vez), acompanhando enquanto ele anda; giro e zoom continuam valendo
- ✅ "Encerrar sessão" (mestre): salva na hora a mesa inteira (mapa, objetos, tokens e monstros com os PV, névoa, combate, chat e áudio) e ela abre igual na próxima sessão
- ✅ Ao encerrar, o mestre marca a sessão agendada como jogada (opção ligada por padrão): ela vai para o histórico da campanha e a próxima vira "Sessão N+1"

## Fase 4 — Comunicação ✅
- ✅ Chat geral, privado e do sistema; anotações do mestre (entregues nas Fases 3 e 5)
- ✅ Presença e sincronização em tempo real (Fase 7, etapa 2)
- ✅ Central de áudio sincronizada: 16 trilhas generativas em quatro climas (calma, aventura, tensão e sombra, batalha) com reverb e instrumentos sintetizados; 18 ambientes em estéreo que se misturam (clima, natureza, lugares, ação e mistério); faixas próprias do mestre
- ✅ Voz na mesa por WebRTC direto entre os navegadores (sem servidor de mídia; TURN opcional), com silenciar e indicador de quem fala
- ✅ Vozes de personagem para o mestre: 11 filtros (gigante, goblin, fada, ancião, demônio, dragão, espectro, constructo, divindade, mensagem distante) trocados na hora, com mudança de tom por grãos alinhados em AudioWorklet e monitor para se ouvir

## Fase 5 — Ferramentas avançadas do mestre ✅
- ✅ NPCs por campanha (`/campaign/[id]/gm`): descrição pública, notas secretas, fatos a revelar, atitude, aparência e bloco de combate que se adapta ao sistema
- ✅ Revelar fatos na mesa (aba Mestre): vai para o chat e para o diário; os jogadores só veem NPCs conhecidos e fatos revelados
- ✅ Encontros prontos com estimativa de dificuldade para o grupo; "Rodar" põe as criaturas no mapa e rola a iniciativa
- ✅ Diário e linha do tempo (`/campaign/[id]/journal`): momentos da mesa registrados com um clique (combates, quedas, armadilhas, revelações, momentos épicos, 20/1 naturais) e anotações do mestre, públicas ou privadas
- ✅ Geradores por cenário (fantasia, horror, moderno/cyberpunk): NPC rápido por nível de ameaça, nomes, lugares, tesouro e ganchos
- ✅ Combate e iniciativa (entregues na Fase 3)

## Fase 6 — Chronicles Studio ✅
Os melhores momentos da campanha viram um episódio em vídeo que mistura cinema e HQ. Guia em [CHRONICLES.md](CHRONICLES.md).
- ✅ Momentos com nota de drama a partir do diário (épicos, 20/1 naturais, quedas, vitórias, armadilhas, revelações) e seleção automática dos melhores, ao menos um por sessão
- ✅ Roteiro escrito pelo Claude (saída estruturada: cenas com recordatório, balões, onomatopeia, câmera, clima, duração e rolagens decisivas; elenco com aparência fixa) e editável cena a cena
- ✅ Quadros ilustrados pelo Gemini, com retrato de referência de cada personagem para mantê-los iguais em todos os quadros; redesenhar um quadro
- ✅ Vídeo com Remotion: abertura com tarja de cinema, quadros com movimento de câmera e cor por clima, recordatório que aparece palavra por palavra, balões que surgem um a um, onomatopeia, d20 gigante nos dados decisivos (crítico dourado, falha vermelha) e encerramento "Continua…"; prévia no player e exportação MP4 no próprio navegador
- ✅ Sem chaves, roteiro por regras e imagens de exemplo (tudo funciona para testar)
- ✅ Formato HQ para baixar: o mesmo episódio diagramado em páginas A4 (capa, quadros lado a lado ou de página inteira, recordatórios, balões, onomatopeias, d20 nas rolagens decisivas e "Continua…"), com prévia na aba HQ e download em PDF ou em páginas PNG (ZIP), tudo montado no navegador
- ✅ Trilha sonora sintetizada no navegador a partir do clima de cada cena (acordes, pulsação, impactos na abertura, nas onomatopeias e no d20; fanfarra no crítico, trombone triste na falha), que abaixa sozinha enquanto o narrador ou um balão fala; vai junto no MP4
- ✅ Narração do recordatório: gravada pela voz do Gemini (com GEMINI_API_KEY; entra na prévia e no MP4, e a cena cresce para caber a fala) ou, sem chave, lida pela voz do navegador na prévia
- ✅ Compartilhar episódios com os jogadores: o mestre marca "Compartilhar" e os jogadores da campanha assistem ao vídeo e leem ou baixam a HQ na página Episódios, só leitura (RLS e Storage liberam só os episódios compartilhados e os arquivos que eles usam)

## Fase 7 — Supabase ✅
Antecipada para destravar a Fase 4. Guia de configuração em [SUPABASE.md](SUPABASE.md).
- ✅ Etapa 1 — fundação: esquema Postgres com RLS espelhando `lib/permissions.ts`, gatilhos de proteção (dono da campanha, papéis, personagem vinculado) e funções (`join_campaign`, `invite_preview`, `new_invite_link`, `campaign_characters`, `known_npcs`, `username_taken`); Supabase Auth com e-mail e senha; repositórios Supabase para todos os contratos; troca por `NEXT_PUBLIC_DATA_SOURCE`; `npm run db:check` valida o esquema e 53 cenários de acesso (incluindo tentativas de burlar as regras) num Postgres em memória; redefinição de senha pelo link do e-mail (`/reset-password`); convites por link no lugar dos convites por e-mail (nenhum e-mail enviado)
- ✅ Etapa 2 — mesa em tempo real: um cliente do mestre conduz a mesa (aplica tudo, salva no banco e escreve a visão de cada participante); jogadores recebem só o que podem ver (inimigos fora da visão do grupo, armadilhas ocultas, notas do mestre, rolagens secretas e sussurros alheios ficam com o mestre) e mandam pedidos que o mestre valida (mover o próprio personagem na sua vez, falar, sussurrar ao mestre, rolar, atacar, abrir portas, testes da ficha); dados sempre rolados pelo mestre; presença de quem está na mesa; co-mestre acompanha e pode assumir; tokens andam casa a casa pelo caminho; banner de turno ("Sua vez!"); dados 3D com arremesso, quiques, crítico dourado com faíscas e falha crítica; `db:check` com 88 cenários
- ✅ Etapa 3a — mídia: imagens de mapa no Supabase Storage (todos os jogadores veem o desenho; imagens antigas sobem sozinhas quando o mestre abre a mesa); central de áudio sincronizada pela mesa ao vivo: ambientes sintetizados que se misturam e trilhas generativas (hoje 18 e 16; ver Fase 4), faixas próprias enviadas pelo mestre, volume da mesa e volume de cada pessoa
- ✅ Etapa 3b — voz: canal de sinalização privado por campanha no Realtime (só membros entram); a chamada é WebRTC direto, sem LiveKit. `supabase/setup.sql` e `supabase/pending.sql` são gerados por `node scripts/build-sql.mjs`

## Fase 8 — Regras por sistema ✅
Plano completo em [SYSTEM-RULES.md](SYSTEM-RULES.md).
- ✅ D&D 5e: conteúdo do SRD 5.1, ficha que se calcula (resistências, CA por armadura, PV por classe, conjuração) e criação guiada
- ✅ Fundação comum: interface `SystemRules`, registro por sistema, dados da ficha por sistema (`sheet.build`), peças de criação reutilizáveis, classes com recursos que crescem por nível (editor de sistemas); D&D 5e migrado
- ✅ Módulos dos outros nove sistemas (Pathfinder 2e, Tormenta20, 3D&T Victory, Call of Cthulhu, Vampiro, Lobisomem, Ordem Paranormal, Cyberpunk RED, GURPS): valores automáticos, bloco próprio na ficha e criação guiada, sobre um painel genérico e uma criação por configuração; fichas antigas só recalculam quando o jogador liga o automático

## Como verificar cada entrega
```bash
npm run typecheck
npm run lint
npm test
npm run build
```
