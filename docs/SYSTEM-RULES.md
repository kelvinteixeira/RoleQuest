# Regras por sistema — plano de ação

> Objetivo: todo sistema da biblioteca ter **ficha que se calcula sozinha** e **criação guiada**, como o D&D 5e já tem.
> Documento vivo: marque cada item ao entregar (✅ entregue · 🟡 parcial · ⬜ pendente).

## 1. Onde estamos

| Sistema | Módulo | Valores automáticos | Bloco na ficha | Criação guiada |
| --- | --- | --- | --- | --- |
| D&D 5e | ✅ `dnd5e/` | PV, dados de vida, espaços de magia, deslocamento, CA por armadura | raça/classe/antecedente, resistências, conjuração, traços | ✅ SRD 5.1 completo |
| Pathfinder 2e | ✅ `pathfinder2e/` | PV (ancestralidade + (classe + CON) × nível), deslocamento | graus de proficiência (perícias, resistências, Percepção, CA, CD de classe), CA, Percepção como iniciativa | ✅ reforços, PV, perícias |
| Tormenta20 | ✅ `tormenta20/` | PV/PM pela classe cadastrada | Defesa, ½ nível em perícias, treino 2/4/6, Fortitude/Reflexos/Vontade | ✅ classe, pontos (10), perícias |
| 3D&T Victory | ✅ `3dt-victory/` | PV, PM, PA | pontos gastos | ✅ pontos de personagem |
| Call of Cthulhu | ✅ `call-of-cthulhu/` | PV, PM, teto da Sanidade | Movimento, Dano extra, Corpo, Esquivar, metade/quinto | ✅ rolagem ou 460 pontos, ocupação + interesse, Sorte |
| Vampiro: A Máscara | ✅ `storyteller/` | Vitalidade, Força de Vontade | trilhas de dano superficial/agravado | ✅ 4/3/3/3/2/2/2/2/1, perfis de perícia, Humanidade 7, Fome 1 |
| Lobisomem: O Apocalipse | ✅ `storyteller/` | Vitalidade, Força de Vontade | trilhas de dano | ✅ idem, Fúria 1 |
| Ordem Paranormal | ✅ `ordem-paranormal/` | PV/PE/SAN pela classe cadastrada, por NEX | NEX, PE por turno, Defesa, resistências | ✅ classe, pontos (4), perícias +5 |
| Cyberpunk RED | ✅ `cyberpunk-red/` | PV, Humanidade (menos implantes), Sorte | gravemente ferido, teste de morte, EMP efetiva, implantes | ✅ 62 pontos de atributo, 86 de perícia |
| GURPS | ✅ `gurps/` | PV, PF (com extras comprados) | Velocidade, Deslocamento, Esquiva, Carga, pontos gastos × total, traços | ✅ compra de atributos com o total da campanha |

Fichas que já existiam guardam os próprios valores: o cálculo automático só liga sozinho em fichas novas ou feitas pelo guia; nas outras, o jogador liga no bloco do sistema.

O que já existe e será reaproveitado:
- `features/character-sheet/model/checks.ts`: rolagem de cada mecânica, inclusive testes de resistência (`save`).
- `features/combat/model/profile.ts`: defesa, iniciativa e ataques do token.
- `SystemTemplate.classes` + `applyClass`: classes com bônus de recurso, perícias e habilidades, editáveis no editor de sistemas.
- `features/systems/dnd5e/`: o primeiro módulo completo (`srd.ts`, `rules.ts`, testes), mais `dnd-section.tsx` e `dnd-creator.tsx`.

## 2. Regra de licença (vale para todas as etapas)

- **Pode:** estrutura da ficha, fórmulas e cálculos, procedimentos de criação (distribuir pontos, rolar atributos), nomes genéricos de campos.
- **Não pode:** texto dos livros, listas de classes, origens, raças, clãs, disciplinas, magias, rituais, poderes e equipamentos com seus números, a menos que estejam sob licença aberta (como o SRD 5.1 do D&D).
- **Como fica o conteúdo fechado:** o grupo cadastra as classes e opções na própria mesa ("duplicar como meu" + editor de classes). O módulo traz os campos e o cálculo; os números da classe ficam com quem tem o livro.
- **Licenças abertas a confirmar antes de incluir conteúdo:** Pathfinder 2e (ORC, Remaster) e Call of Cthulhu (BRP sob ORC, não o próprio CoC). Até a confirmação, ficam como conteúdo fechado.

## 3. Etapa A — fundação comum ✅

Entregue. Onde ficou:
- `features/systems/rules/types.ts`: `SystemRules` (puro: `derived`, `sync`, `defense`, `initiative`, `saves`), `SystemRulesUi` (`Panel`, `creation`) e `CreationFlow`.
- `features/systems/rules/registry.ts`: `rulesFor(system)` e `syncSheet` (módulo do sistema + crescimento das classes); sem React, usado por `checks.ts` e `profile.ts`.
- `features/systems/rules/ui.tsx`: `rulesUiFor(system)`, usado pela ficha e pelo diálogo de criação.
- `features/systems/rules/build.ts`: `sheet.build` por sistema (`buildOf`, `withBuild`), `autoDerived` e `setResourceMax`.
- `features/systems/rules/generic.ts`: módulo padrão; classes com `resourceGrowth` recalculam recursos por nível (campos no editor de sistemas).
- `features/characters/components/creation/pieces.tsx`: cartões, chips com limite, compra de pontos e distribuição de valores.
- `features/systems/dnd5e/`: `srd.ts`, `rules.ts`, `panel.tsx`, `creation.tsx`; fichas antigas com `sheet.dnd` migram em `ensureSheet`.

Para criar um módulo novo: `rules.ts` com um `SystemRules` (e `systemId`), registrar em `registry.ts`; `panel.tsx` e/ou `creation.tsx` registrados em `ui.tsx`.

O que estava planejado:

Meta: ficha, criação e mesa deixam de ter código de D&D dentro e passam a perguntar ao "módulo do sistema".

- ✅ **A1. Interface `SystemRules`** em `features/systems/rules/types.ts`:
  ```ts
  interface SystemRules<Build = unknown> {
    systemId: BuiltInSystemId;
    /** Números exibidos no bloco do sistema (CA, Defesa, NEX, Vontade…). */
    derived(system, sheet, level): DerivedStat[];
    /** O que se ajusta sozinho (PV máx., recursos, deslocamento); devolve a mesma ficha se nada mudar. */
    sync(system, sheet, level): CharacterSheet;
    /** Opcional: substitui as derivações genéricas do token. */
    defense?(system, sheet, level): number;
    initiative?(system, sheet, level): { value: number; dice?: number };
    /** Testes de resistência do sistema (D&D: 6 atributos; PF2: Fort/Ref/Von; T20: perícias). */
    saves?(system, sheet, level): SaveDefinition[];
    /** Bloco na aba Ficha. */
    Panel: React.ComponentType<SectionProps & { level: number | null }>;
    /** Criação guiada: passos, validação de cada passo e a ficha final. */
    creation?: CreationFlow<Build>;
  }
  ```
- ✅ **A2. Registro** `rulesFor(system)` por `baseSystemId ?? id` (cópias de um sistema herdam o módulo); sem módulo, a ficha genérica de hoje.
- ✅ **A3. Dados da ficha por sistema:** trocar `sheet.dnd` por `sheet.build?: { system: string; data: unknown }` e migrar fichas existentes em `ensureSheet` (o `dnd` antigo vira `build`).
- ✅ **A4. Plugar o registro** em `sheet-editor.tsx` (bloco e `sync`), `profile.ts` (defesa e iniciativa), `checks.ts` (resistências), `create-character-dialog.tsx` (passos) e `use-room-sync.ts` (testes pedidos na mesa).
- ✅ **A5. Peças de criação reutilizáveis** extraídas de `dnd-creator.tsx`: cartões de escolha, chips com limite, distribuidor de pontos com orçamento, atribuição de valores (conjunto fixo ou rolado), resumo final.
- ✅ **A6. Motor de classes:** ampliar `ClassDefinition` com fórmulas por nível (`hpPerLevel`, `resourcePerLevel`, `startingHp`) para que T20, Ordem e PF2 calculem PV e recursos a partir das classes que o grupo cadastrar.
- ✅ **A7. D&D 5e migrado** para a interface, sem mudar o comportamento; os testes atuais continuam passando.

Pronto quando: typecheck, lint e testes passam; a ficha e a criação de D&D funcionam igual; um sistema sem módulo continua igual a hoje.

## 4. Etapa B — um módulo por sistema ✅

Entregue para os dez sistemas, sobre o painel genérico (`rules/panel.tsx`: números, resistências, chave do automático e um extra por sistema) e a criação por configuração (`rules/creation-kit.tsx`: classe cadastrada, método de atributos, método de perícias, toques finais). Também: perícias da Ordem Paranormal e do Narrador ligadas ao atributo de cada uma, e o bônus de perícia do Tormenta20 corrigido (½ nível em todas + treino 2/4/6).

Fórmulas de sistemas fechados foram escritas a partir de conhecimento geral das regras. Situação da conferência:
- ✅ Cyberpunk RED: PV = 10 + 5 × ⌈(CORPO + VON) / 2⌉, gravemente ferido na metade, teste de morte = CORPO (conferido com fontes públicas).
- ⬜ A conferir com o livro: compra de pontos do Tormenta20 (10 pontos; custos 1/2/4/7), criação e limite de PE por turno da Ordem Paranormal, Fúria inicial do Lobisomem, graus e reforços do Pathfinder 2e, custos do GURPS.

O que estava planejado:

Cada módulo entrega o mesmo pacote:
1. `features/systems/<id>/rules.ts` com `derived`, `sync` e o que mais o sistema precisar;
2. `rules.test.ts` com as fórmulas (casos de nível 1, nível alto e limites);
3. bloco na ficha;
4. criação guiada;
5. verificação no navegador (criar um personagem, subir de nível, rolar na mesa).

### B1. Tormenta20 ✅
- **Derivados:** PV e PM por classe e nível (+CON nos PV), Defesa = 10 + DES + armadura + escudo, bônus de perícia = metade do nível + atributo + treino (o treino cresce com o nível). Fortitude, Reflexos e Vontade são perícias e viram os "testes de resistência".
- **Correção:** `proficiencyBonus` do T20 hoje é `2 + nível/2`; separar "metade do nível" (todas as perícias) do bônus de treino.
- **Criação:** atributos por pontos com tabela de custo configurável; raça/origem/classe escolhidas das cadastradas pelo grupo, com os bônus e as perícias definidos nelas; perícias treinadas.
- **Conteúdo:** fechado. O grupo cadastra raças, origens e classes.

### B2. Ordem Paranormal ✅
- **Derivados:** PV, PE e SAN pela classe (valor inicial + VIG ou PRE) e por NEX; Defesa = 10 + AGI + equipamento; limite de PE por turno pelo NEX; graus de perícia (treinado, veterano, expert) somando bônus fixos.
- **Criação:** atributos começam em 1 com pontos a distribuir e a opção de reduzir um a 0; origem e classe cadastradas pelo grupo; perícias da origem e da classe.
- **Mesa:** marcador de Sanidade no token, como a Vitalidade.
- **Conteúdo:** fechado.

### B3. Pathfinder 2e ✅
- **Derivados:** graus de proficiência (destreinado, treinado, especialista, mestre, lendário = nível + 2/4/6/8); CA = 10 + DES (com limite da armadura) + proficiência + item; Fortitude, Reflexos e Vontade com graus; Percepção como iniciativa; PV = ancestralidade + (classe + CON) × nível.
- **Ficha:** trocar "treinado sim/não" das perícias por graus.
- **Criação:** ancestralidade, formação e classe com reforços de atributo (+1 ou +2 por etapa).
- **Conteúdo:** depende da confirmação da licença ORC; senão, cadastrado pelo grupo.

### B4. 3D&T Victory ✅
- **Derivados:** PV = R × 5, PM = R × 5, PA = P (já descritos no modelo; viram automáticos).
- **Criação:** orçamento de pontos de personagem por escala, distribuídos entre P, H e R; vantagens e desvantagens como lista com custo, debitado do orçamento.
- **Conteúdo:** vantagens com nome e custo cadastrados pelo grupo.

### B5. Call of Cthulhu ✅
- **Derivados:** PV = (CON + TAM) / 10, Sanidade inicial = POD, PM = POD / 5, Esquivar = DES / 2, Língua nativa = EDU, Taxa de movimento (DES/FOR × TAM), Bônus de dano e Corpo (FOR + TAM); valores de metade e quinto ao lado de cada atributo e perícia.
- **Criação:** rolar atributos (3d6 × 5 e (2d6 + 6) × 5 conforme o atributo) ou distribuir; Sorte rolada; pontos de ocupação e de interesse (fórmulas por EDU e INT) distribuídos nas perícias.
- **Conteúdo:** lista de ocupações cadastrada pelo grupo.

### B6. Vampiro: A Máscara ✅
- **Derivados:** Vitalidade = Vigor + 3, Força de Vontade = Autocontrole + Determinação, Humanidade inicial, Fome.
- **Ficha:** trilha de dano com caixas (superficial e agravado) para Vitalidade e Força de Vontade, no lugar da barra.
- **Criação:** distribuição fixa de atributos (um em 4, três em 3, quatro em 2, um em 1) e de perícias por perfil; clã, disciplinas e predador como campos do grupo.
- **Conteúdo:** fechado (clãs e disciplinas não entram).

### B7. Lobisomem: O Apocalipse ✅
- Mesmo núcleo do Vampiro (módulo "Narrador" compartilhado: trilha de dano, distribuição de atributos e perícias) + Fúria e Equilíbrio.
- **Conteúdo:** fechado.

### B8. Cyberpunk RED ✅
- **Derivados:** PV = 10 + 5 × média(COR, VON) arredondada para cima; limiar de "gravemente ferido" = metade dos PV; Humanidade = EMP × 10 menos o custo dos implantes; Sorte = SOR; deslocamento por MOV.
- **Criação:** distribuição de pontos nos 10 atributos (ou pacote rápido) e perícias; função (papel) cadastrada pelo grupo.
- **Ficha:** implantes com custo de Humanidade, que reduz a Humanidade máxima.

### B9. GURPS ✅
- **Derivados:** PV = ST, PF = HT, Vontade e Percepção = IQ, Velocidade Básica = (HT + DX) / 4, Deslocamento = parte inteira da velocidade, Esquiva = velocidade + 3; custo em pontos de cada atributo.
- **Ficha:** total de pontos gastos × orçamento, perícias com dificuldade e nível relativo (custo calculado).
- **Criação:** orçamento de pontos, atributos, vantagens/desvantagens e perícias cadastradas pelo grupo.

## 5. Ordem e tamanho

| Ordem | Entrega | Tamanho estimado | Por quê |
| --- | --- | --- | --- |
| 1 | Etapa A (fundação + D&D migrado) | grande | destrava todo o resto e evita refazer |
| 2 | Tormenta20 | médio | mais jogado no Brasil, d20 parecido com D&D |
| 3 | Ordem Paranormal | médio | muito jogado no Brasil; NEX e SAN |
| 4 | 3D&T Victory | pequeno | fórmulas simples, valida a interface com pontos |
| 5 | Call of Cthulhu | médio | muitos derivados, criação por rolagem |
| 6 | Vampiro + Lobisomem | médio | módulo "Narrador" compartilhado, trilha de dano |
| 7 | Cyberpunk RED | médio | implantes × Humanidade |
| 8 | Pathfinder 2e | grande | graus de proficiência mudam a ficha de perícias |
| 9 | GURPS | grande | economia de pontos e perícias por dificuldade |

Cada linha é um PR próprio, com testes do módulo e verificação no navegador.

## 6. Decisões em aberto

- **Conteúdo do Pathfinder 2e e do CoC:** incluir o que estiver sob ORC (com atribuição) ou deixar tudo para o grupo cadastrar?
- **Classes "fechadas" (T20, Ordem):** só cadastro pelo grupo, ou também um arquivo de importação para o mestre carregar as classes do próprio livro?
- **Criação guiada:** sempre opcional (como hoje, com "Sem o guia"), ou obrigatória nas campanhas em que o mestre ligar essa regra?
- **Fichas antigas:** ao ligar o cálculo automático numa ficha existente, recalcular tudo ou só o que estiver vazio?

## 7. Como verificar cada entrega

```bash
npm run typecheck
npm run lint
npm test
```

No navegador: criar um personagem do sistema pelo guia, conferir os números do resumo, subir de nível e ver os derivados mudarem, abrir a sala e rolar um teste de resistência pela ficha.
