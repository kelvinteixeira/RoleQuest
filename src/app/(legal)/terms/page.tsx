import type { Metadata } from "next";
import Link from "next/link";
import { legal } from "@/config/legal";
import { Clause, LegalDocument } from "@/features/legal/legal-document";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <LegalDocument
      title="Termos de uso"
      updatedAt={legal.updatedAt}
      intro={
        <p>
          Estes termos regem o uso do Role Quest, plataforma de RPG de mesa online operada por {legal.entity}, {legal.document}. Ao criar uma conta ou usar o
          serviço, você concorda com eles e com a <Link href="/privacy">Política de privacidade</Link>.
        </p>
      }
    >
      <Clause n={1} title="O serviço">
        <p>
          O Role Quest oferece mesa virtual, fichas de personagem, ferramentas para o mestre, chat e voz entre os participantes, e o Chronicles Studio, que transforma
          momentos das sessões em episódios ilustrados com ajuda de inteligência artificial.
        </p>
      </Clause>

      <Clause n={2} title="Conta">
        <ul>
          <li>Você é responsável pelas informações da sua conta e por manter a senha em segredo.</li>
          <li>Menores de 18 anos só podem usar o serviço com o consentimento dos pais ou responsáveis.</li>
          <li>Você pode excluir a conta a qualquer momento em Configurações → Privacidade e seus dados.</li>
        </ul>
      </Clause>

      <Clause n={3} title="Uso aceitável">
        <p>Não é permitido usar o Role Quest para:</p>
        <ul>
          <li>publicar conteúdo ilegal, discriminatório, de assédio ou que explore menores;</li>
          <li>enviar material protegido por direitos autorais sem autorização (por exemplo, textos e imagens de livros de RPG);</li>
          <li>tentar acessar dados de outras pessoas, sobrecarregar o serviço ou contornar limites e cobranças.</li>
        </ul>
        <p>Podemos remover conteúdo ou suspender contas que violem estas regras, avisando você sempre que possível.</p>
      </Clause>

      <Clause n={4} title="Seu conteúdo">
        <p>
          Campanhas, fichas, mapas, textos, imagens e áudios que você cria ou envia continuam sendo seus. Você nos autoriza a armazená-los, processá-los e exibi-los
          às pessoas que você convidar, apenas para prestar o serviço.
        </p>
      </Clause>

      <Clause n={5} title="Inteligência artificial">
        <p>
          Quando o mestre usa o Chronicles Studio, trechos do diário da campanha são enviados a provedores de IA (Anthropic e Google) para escrever o roteiro,
          desenhar os quadros e gravar a narração. O resultado pode conter erros ou imprecisões; revise antes de compartilhar.
        </p>
      </Clause>

      <Clause n={6} title="Planos, pagamentos e cancelamento">
        <ul>
          <li>O plano grátis não exige pagamento. Planos pagos são cobrados por mês, pelo Stripe, e renovam automaticamente até você cancelar.</li>
          <li>Você pode cancelar quando quiser em Configurações → Plano; o acesso pago continua até o fim do período já pago.</li>
          <li>
            Em compras feitas pela internet, você tem 7 dias para desistir (art. 49 do Código de Defesa do Consumidor) e receber o valor de volta: fale conosco em{" "}
            {legal.email}.
          </li>
          <li>Créditos de IA não expiram enquanto a conta existir; créditos já usados não são reembolsáveis.</li>
          <li>Preços podem mudar com aviso prévio de 30 dias; a mudança vale a partir da renovação seguinte.</li>
        </ul>
      </Clause>

      <Clause n={7} title="Sistemas de RPG e marcas">
        <p>
          Nomes de sistemas de RPG são marcas de seus titulares; o Role Quest não é afiliado a eles. Oferecemos a estrutura das fichas e conteúdo apenas quando
          publicado sob licença aberta (como o SRD 5.1 sob CC-BY-4.0). Use os livros que você possui legalmente.
        </p>
      </Clause>

      <Clause n={8} title="Disponibilidade e responsabilidade">
        <p>
          Trabalhamos para manter o serviço no ar e seus dados seguros, mas ele é oferecido no estado em que se encontra, podendo ter interrupções. Na medida
          permitida pela lei, não respondemos por danos indiretos nem por conteúdo publicado por usuários.
        </p>
      </Clause>

      <Clause n={9} title="Mudanças nestes termos">
        <p>Avisaremos mudanças relevantes por e-mail ou no próprio serviço. Continuar usando o Role Quest depois do aviso significa aceitar a nova versão.</p>
      </Clause>

      <Clause n={10} title="Lei e foro">
        <p>
          Estes termos seguem a lei brasileira. Fica eleito o foro do domicílio do consumidor, ou, quando não se tratar de relação de consumo, o de {legal.city}.
          Contato: {legal.email}.
        </p>
      </Clause>
    </LegalDocument>
  );
}
