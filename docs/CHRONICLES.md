# Chronicles Studio

Os melhores momentos da campanha viram um **episódio em vídeo** que mistura cinema e história em quadrinhos, e uma **HQ** para baixar.

## Como funciona

1. **Momentos.** O diário da campanha registra sozinho, durante a mesa: momentos épicos, 20 e 1 naturais, quedas, vitórias, armadilhas, revelações e lugares. Cada um ganha uma **nota de drama** (0 a 12). O estúdio pré-seleciona os melhores, pelo menos um por sessão; o mestre pode marcar e desmarcar.
2. **Roteiro (Claude).** O Claude recebe os momentos, os personagens, os NPCs conhecidos (só a parte pública, nunca as notas secretas) e o tom do mundo, e devolve um roteiro estruturado: abertura, cenas, rolagens decisivas e encerramento, com recordatório, balões, onomatopeia, movimento de câmera, clima e duração. Dá para pedir uma direção ("mais sombrio", "foco na Isolde") e editar tudo depois.
3. **Quadros (Gemini).** Primeiro um retrato de referência de cada personagem que aparece; depois cada quadro, enviando os retratos de quem está na cena, para os personagens saírem iguais em todo o episódio. As imagens não têm texto: balões e legendas são do vídeo.
4. **Vídeo (Remotion).** Prévia no player e exportação **MP4 no próprio navegador** (Chrome ou Edge; deixe a aba visível enquanto exporta).
5. **HQ para baixar.** A aba **HQ** do episódio mostra a mesma história diagramada em páginas A4: a abertura vira capa, cenas curtas ficam lado a lado e as de muito texto, as barulhentas e o encerramento ocupam a faixa inteira. Baixe em **PDF** (um arquivo) ou em **páginas PNG** (um ZIP quando há mais de uma). As páginas são desenhadas no navegador com o roteiro e as imagens que estão na tela, então editar um balão ou redesenhar um quadro já muda a HQ. Cena sem imagem sai como um quadro de cor.

## Chaves

As chaves ficam **só no servidor**, no `.env.local` (nunca com `NEXT_PUBLIC_`):

```env
ANTHROPIC_API_KEY=...   # console.anthropic.com → API Keys
GEMINI_API_KEY=...      # aistudio.google.com → Get API key
```

Reinicie o `npm run dev` depois de colocar as chaves. Sem elas, o estúdio usa **roteiro por regras** e **imagens de exemplo**, e todo o resto funciona igual.

Custos aproximados por episódio de 10 cenas: o roteiro custa alguns centavos de dólar; as imagens, cerca de 14 (10 quadros e 4 retratos), custam de alguns centavos a menos de um dólar, conforme o modelo do Gemini. Redesenhar um quadro gera só aquela imagem.

## Segurança

- As rotas `/api/chronicles/*` só atendem **mestres da campanha**: o servidor confere o token do Supabase e o papel na campanha. No modo local (sem contas reais), só respondem a `localhost` e ficam desligadas em produção.
- **Cota diária por pessoa** (qualquer um pode criar uma campanha e ser mestre dela): 20 roteiros e 120 imagens por dia, contados no banco (`chronicle_usage`).
- Anotações privadas do diário nunca entram por padrão: aparecem marcadas como "privado" e só vão para o vídeo se você marcar. O texto da campanha vai ao Claude como material da história, nunca como instruções.
- Episódios (`chronicle_episodes`) e imagens (bucket privado `chronicles`) são visíveis só para os mestres.
- O roteiro usa apenas o que está nos momentos e nas descrições públicas dos NPCs.

## Supabase

Aplique a migração `supabase/migrations/20261107000000_chronicles.sql`. Ela cria a tabela e o bucket privado `chronicles` com as permissões. Se o SQL Editor recusar a parte do Storage, crie o bucket `chronicles` (privado) em **Storage** e rode a migração de novo.

## Licença do Remotion

O Remotion é gratuito para pessoas e empresas com até 3 funcionários; acima disso, ele pede uma licença de empresa.
