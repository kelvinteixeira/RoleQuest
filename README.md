# Role Quest

Plataforma web para jogar RPG de mesa online — mesa virtual 3D, fichas para os principais sistemas e, no horizonte, o **Chronicles Studio**: transformar as sessões em episódios.

> Em desenvolvimento. Hoje os dados ficam no navegador (modo local); a integração com Supabase está planejada. Veja o [roadmap](docs/ROADMAP.md).

## O que já funciona

- Conta local, onboarding, painel, campanhas (assistente de criação em 7 etapas) e convites
- Biblioteca com modelos de 10 sistemas (D&D 5e, Pathfinder 2e, Call of Cthulhu, Vampiro, Lobisomem, Tormenta20, 3D&T Victory, Ordem Paranormal, Cyberpunk RED, GURPS) e sistema próprio
- Fichas de personagem por sistema: atributos, recursos, perícias, habilidades, inventário, campos personalizados, história e anotações privadas, com testes usando a mecânica de cada sistema
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
npm test
npm run build
```

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Framer Motion · three.js / react-three-fiber · Vitest.

Arquitetura e decisões: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Créditos

Modelos 3D CC0 de Kenney, Quaternius, Kay Lousberg (KayKit) e OpenGameArt — detalhes em `public/assets/map/CREDITS.md` e `public/assets/characters/CREDITS.md`. Nomes de sistemas de RPG são marcas de seus titulares; o Role Quest não é afiliado a eles e não reproduz conteúdo dos livros.
