# Role Quest

Plataforma web para jogar RPG de mesa online — mesa virtual 3D, fichas para os principais sistemas e, no horizonte, o **Chronicles Studio**: transformar as sessões em episódios.

> Pronto para lançar: modo local (tudo no navegador, para testar) ou Supabase (contas reais, mesa em tempo real, voz, pagamentos). Veja o [roadmap](docs/ROADMAP.md) e o [checklist de lançamento](docs/LAUNCH.md).

## O que já funciona

- Conta local, onboarding, painel, campanhas (assistente de criação em 7 etapas) e convites por link
- Biblioteca com modelos de 10 sistemas (D&D 5e, Pathfinder 2e, Call of Cthulhu, Vampiro, Lobisomem, Tormenta20, 3D&T Victory, Ordem Paranormal, Cyberpunk RED, GURPS) e sistema próprio
- Fichas de personagem por sistema: atributos, recursos, perícias, habilidades, inventário, campos personalizados, história e anotações privadas, com testes usando a mecânica de cada sistema
- Regras por sistema nos 10 sistemas: ficha que se calcula sozinha, bloco próprio do sistema e criação guiada (D&D 5e com o SRD 5.1: raças, classes, armas e magias)
- Jogadores só pedem movimento (ping no mapa); o mestre controla mapa, cena, som e tokens
- Chronicles Studio: episódios em vídeo e HQ a partir dos momentos da mesa
- Planos (Grátis, Mestre, Mesa) e créditos de IA com Stripe; termos de uso, privacidade e ferramentas da LGPD (exportar e excluir a conta)
- Lembretes de sessão por e-mail e "adicionar à agenda"; voz com TURN ou LiveKit; qualidade gráfica por aparelho; mapa navegável pelo teclado
- Sala de jogo: mapa 3D por tiles ou a partir de uma imagem, editor do mestre com camadas e biblioteca de mapas por campanha, névoa de guerra com linha de visão e iluminação dinâmica, portas e armadilhas, dados 3D e efeitos sonoros, personagens animados, combate pelas regras de cada sistema a partir das fichas (ataques com alcance, defesa e armadura, iniciativa), dados, chat com mensagens privadas e bots de teste

## Rodando

```bash
npm install
npm run dev
```

Abra http://localhost:3000 e use **Explorar com a conta de demonstração**.

```bash
npm run typecheck
npm run lint
npm run db:check   # regras do banco (RLS, funções) num Postgres em memória
npm run e2e        # testes de ponta a ponta (Playwright, modo local)
npm test
npm run build
```

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Framer Motion · three.js / react-three-fiber · Vitest.

Arquitetura e decisões: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Créditos

Modelos 3D CC0 de Kenney, Quaternius, Kay Lousberg (KayKit) e OpenGameArt — detalhes em `public/assets/map/CREDITS.md` e `public/assets/characters/CREDITS.md`. Nomes de sistemas de RPG são marcas de seus titulares; o Role Quest não é afiliado a eles e não reproduz conteúdo dos livros.
