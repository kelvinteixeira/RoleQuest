# Checklist de lançamento

Tudo abaixo já está no código; o que falta são contas e chaves que só você pode criar. Cada item funciona sozinho: sem a chave, o recurso fica desligado (sem erro) e o resto do app segue normal.

## 1. Banco (Supabase)

- [ ] Rodar `supabase/pending.sql` (ou `setup.sql` num banco novo) no SQL Editor. Traz: exclusão de conta, planos, créditos, limites e lembretes. `npm run db:check` valida tudo antes (137 cenários).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no servidor (só no servidor; nunca com `NEXT_PUBLIC_`).
- [ ] Auth → URL Configuration: o domínio de produção em *Site URL* e em *Redirect URLs* (confirmação de e-mail e redefinição de senha).
- [ ] As sessões agora ficam em cookies (`proxy.ts` protege as páginas no servidor). Quem já estava logado continua logado: a sessão antiga migra sozinha.

## 2. Jurídico

- [ ] `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_DOCUMENT`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_LEGAL_CITY`. Sem eles, `/terms` e `/privacy` mostram [colchetes].
- [ ] **Revisar os textos com um advogado** (`src/app/(legal)/terms` e `privacy`). Foram escritos como ponto de partida: LGPD (bases legais, direitos do art. 18, encarregado), CDC (7 dias de arrependimento), IA e provedores.
- [ ] Nomear o encarregado (DPO) e o e-mail de contato.

## 3. Pagamentos (Stripe)

- [ ] Criar os produtos: plano Mestre e Mesa (recorrentes, mensais) e os pacotes de 100 e 300 créditos (pagamento único). Preços sugeridos em `src/config/plans.ts` (a página mostra esses valores; ajuste os dois juntos).
- [ ] Ativar Pix e cartão em Settings → Payment methods (o checkout usa o que estiver ativo; Pix vale para os créditos, assinaturas usam cartão).
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MESTRE`, `STRIPE_PRICE_MESA`, `STRIPE_PRICE_CREDITS_100`, `STRIPE_PRICE_CREDITS_300`.
- [ ] Webhook em `https://SEU-DOMINIO/api/billing/webhook` com os eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created|updated|deleted`; copiar o segredo para `STRIPE_WEBHOOK_SECRET`.
- [ ] Ativar o Customer Portal (Settings → Billing → Customer portal): trocar plano, cartão, cancelar.
- [ ] Testar no modo de teste do Stripe (cartão 4242…) e, só então, ligar os limites: `update billing_config set enforce = true;`
  - Antes disso todo mundo usa os limites do plano Mestre e nenhuma campanha é bloqueada.

## 4. Deploy (Vercel)

- [ ] Variáveis acima + `NEXT_PUBLIC_DATA_SOURCE=supabase`, `NEXT_PUBLIC_APP_URL`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`.
- [ ] `vercel.json` já agenda o job de lembretes (toda hora). Definir `CRON_SECRET`.
- [ ] Proteger o branch `main` exigindo o CI (`.github/workflows/ci.yml`: typecheck, lint, testes, regras do banco, build e e2e).

## 5. Monitoramento

- [ ] Erros do servidor e do navegador já vão para o log (uma linha JSON por erro). Para alertas, `ERROR_WEBHOOK_URL` com um webhook do Discord ou Slack (o mesmo erro avisa no máximo a cada 10 minutos).

## 6. Lembretes por e-mail

- [ ] Conta no Resend com o domínio verificado; `RESEND_API_KEY` e `REMINDER_FROM`.
- [ ] Cada pessoa liga/desliga em Configurações → Privacidade e seus dados. Sem e-mail configurado, as sessões ainda têm "Adicionar à agenda" (Google e .ics).

## 7. Voz

- [ ] Para quem está atrás de redes restritas: TURN com credenciais temporárias, por `TURN_URLS` + `TURN_SECRET` (coturn) ou `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN`.
- [ ] Mesas grandes (8+ pessoas): LiveKit (`NEXT_PUBLIC_VOICE_PROVIDER=livekit`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`). Os filtros de voz do mestre continuam funcionando.

## 8. Regras dos sistemas

- [ ] Conferir com os livros as fórmulas marcadas "a conferir" em [SYSTEM-RULES.md](SYSTEM-RULES.md) (Tormenta20, Ordem Paranormal, Pathfinder 2e, Vampiro/Lobisomem, GURPS). Cyberpunk RED (PV, gravemente ferido, teste de morte) já foi conferido com fontes públicas.
