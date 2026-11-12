import type { Metadata } from "next";
import { legal } from "@/config/legal";
import { Clause, LegalDocument } from "@/features/legal/legal-document";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Política de privacidade"
      updatedAt={legal.updatedAt}
      intro={
        <p>
          Esta política explica quais dados pessoais o Role Quest trata, para quê e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados
          (Lei 13.709/2018). O controlador é {legal.entity}, {legal.document}. Contato do encarregado (DPO): {legal.email}.
        </p>
      }
    >
      <Clause n={1} title="Dados que tratamos">
        <ul>
          <li>
            <strong>Cadastro:</strong> nome de exibição, e-mail, senha (guardada apenas como hash pelo provedor de autenticação), fuso horário e preferências.
          </li>
          <li>
            <strong>Conteúdo de jogo:</strong> campanhas, sessões, fichas, mapas, chat, diário, NPCs, episódios e arquivos que você envia.
          </li>
          <li>
            <strong>Voz:</strong> o áudio da conversa na mesa vai direto entre os participantes ou por um servidor de mídia e não é gravado.
          </li>
          <li>
            <strong>Pagamentos:</strong> dados do cartão ou Pix são tratados pelo Stripe; recebemos apenas o plano, o status e o identificador do cliente.
          </li>
          <li>
            <strong>Técnicos:</strong> registros de erro (mensagem, página e navegador), sem conteúdo das suas mensagens.
          </li>
        </ul>
      </Clause>

      <Clause n={2} title="Para que usamos e com qual base legal">
        <ul>
          <li>Prestar o serviço que você contratou (execução de contrato): conta, mesas, fichas, chat, voz, episódios e cobrança.</li>
          <li>Segurança, prevenção de fraude e correção de erros (legítimo interesse).</li>
          <li>Lembretes de sessão por e-mail (legítimo interesse; você desliga quando quiser em Configurações).</li>
          <li>Cumprir obrigações legais e fiscais (obrigação legal).</li>
        </ul>
        <p>Não vendemos seus dados e não os usamos para publicidade.</p>
      </Clause>

      <Clause n={3} title="Com quem compartilhamos">
        <ul>
          <li>Supabase: banco de dados, autenticação e armazenamento de arquivos.</li>
          <li>Vercel (ou outro provedor de hospedagem): execução do site.</li>
          <li>Stripe: pagamentos.</li>
          <li>Anthropic e Google: só quando o mestre usa o Chronicles Studio (trechos do diário, nomes e descrições dos personagens).</li>
          <li>Provedor de e-mail: envio de lembretes e de mensagens da conta.</li>
          <li>Servidores de voz (TURN/LiveKit), quando usados para conectar a conversa.</li>
        </ul>
        <p>
          Alguns desses provedores ficam fora do Brasil; a transferência internacional ocorre com cláusulas contratuais e garantias compatíveis com a LGPD.
        </p>
      </Clause>

      <Clause n={4} title="Por quanto tempo guardamos">
        <p>
          Enquanto sua conta existir. Ao excluí-la, apagamos sua conta, as campanhas que você criou, seus personagens e os arquivos delas; registros de pagamento
          ficam pelo prazo exigido pela lei fiscal. Mensagens e momentos que você deixou em campanhas de outras pessoas continuam lá, sem vínculo com a sua conta.
        </p>
      </Clause>

      <Clause n={5} title="Seus direitos">
        <p>Você pode, a qualquer momento (art. 18 da LGPD):</p>
        <ul>
          <li>confirmar e acessar seus dados, e baixá-los em Configurações → Privacidade e seus dados → Exportar meus dados;</li>
          <li>corrigir dados no seu perfil;</li>
          <li>excluir a conta em Configurações → Privacidade e seus dados → Excluir conta;</li>
          <li>revogar consentimentos e se opor a tratamentos baseados em legítimo interesse;</li>
          <li>pedir informações sobre compartilhamento ou reclamar à ANPD.</li>
        </ul>
        <p>Para qualquer pedido, escreva para {legal.email}. Respondemos em até 15 dias.</p>
      </Clause>

      <Clause n={6} title="Cookies e armazenamento local">
        <p>
          Usamos apenas o necessário para o serviço funcionar: um cookie de sessão para manter você conectado e o armazenamento do navegador para preferências
          (como volume e animações). Não usamos cookies de publicidade nem de rastreamento.
        </p>
      </Clause>

      <Clause n={7} title="Segurança">
        <p>
          Dados trafegam com criptografia (HTTPS) e o acesso no banco segue regras por pessoa e por campanha: cada um só vê o que lhe cabe. Se houver um incidente
          que traga risco a você, avisaremos você e a ANPD.
        </p>
      </Clause>

      <Clause n={8} title="Mudanças">
        <p>Avisaremos mudanças relevantes por e-mail ou no serviço antes que entrem em vigor.</p>
      </Clause>
    </LegalDocument>
  );
}
