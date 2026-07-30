/* ============================================================
   AGENTE DE VERDADE — teto de gasto, ferramentas próprias, e rodar sozinho

   O QUE UM "AGENTE" ERA: um nome, um ícone e um systemPrompt. Escolher um
   agente copiava o prompt pra conversa e acabava ali. Tudo o mais era global —
   as ferramentas, o gasto, o modo autônomo. Na prática, um preset com rosto.

   O QUE FALTAVA, e é o que este arquivo traz:

     TETO DE GASTO. Um agente que roda sozinho gasta em VÁRIAS rodadas, e um
     erro de julgamento dele custa dinheiro de verdade. O teto é total (não
     mensal): trava e espera você aumentar. Zerar sozinho todo mês transformaria
     o limite num aviso, e um limite que se levanta sozinho não é limite.

     FERRAMENTAS POR AGENTE. O interruptor global dá TODAS as ferramentas a
     qualquer agente — o da incubadora ganhava acesso ao seu PC e ao seu Gmail
     sem precisar. Menos ferramenta também é resposta melhor: com oito opções na
     mesa, modelo pequeno escolhe errado.

     RODAR SOZINHO. O loop autônomo (/api/autonomous) já existia no backend e a
     tela nunca o ligou a um agente: era um modo global, sem prompt nem modelo
     nem limite próprios. Agora é ESTE agente que roda.
   ============================================================ */

/* Defaults de quem foi criado antes destes campos existirem. Não migra dado
   nenhum: um agente sem `tools` continua com todas, que é como ele já se
   comportava — mudar isso calado quebraria agente que funciona hoje. */
function agenteNormalizado(a){
  return {
    budget: Number(a?.budget) || 0,        // US$; 0 = sem teto
    spent: Number(a?.spent) || 0,          // US$ acumulado, nunca zera sozinho
    tools: Array.isArray(a?.tools) ? a.tools : null,   // null = todas
    autonomo: a?.autonomo !== false,       // pode rodar sozinho (padrão: sim)
  };
}

function achaAgente(id){
  return id ? state.agents.find(a => a.id === id) : null;
}

/* O agente da conversa atual. `conv.agentId` é gravado quando você abre uma
   conversa a partir de um agente — é o que permite atribuir gasto e ferramentas
   à pessoa certa depois, em vez de tudo cair num balde só. */
function agenteDaConversa(conv){
  return achaAgente((conv || (typeof getCurrentConv === 'function' ? getCurrentConv() : null))?.agentId);
}

/* ---------- teto de gasto ---------- */

function gastoDoAgente(a){
  const n = agenteNormalizado(a);
  return { gasto: n.spent, teto: n.budget, sobra: n.budget ? Math.max(0, n.budget - n.spent) : Infinity };
}

function agenteEstourou(a){
  if (!a) return false;
  const { teto, gasto } = gastoDoAgente(a);
  return teto > 0 && gasto >= teto;
}

/* Debita no agente. Chamado do trackUsage — o mesmo lugar que já contava o
   gasto global, pra não existirem duas contabilidades que divergem. */
function debitaAgente(conv, custo){
  const a = agenteDaConversa(conv);
  if (!a || !(custo > 0)) return;
  a.spent = (Number(a.spent) || 0) + custo;
  persistAgents();
  const { teto, gasto } = gastoDoAgente(a);
  if (teto > 0 && gasto >= teto){
    try{ toast(`"${a.name}" atingiu o teto de US$ ${teto.toFixed(2)}. ` +
               `Aumente em Agentes › Editar pra ele voltar a responder.`, 'warn'); }catch(e){}
  }
  if (typeof renderAgents === 'function' && document.getElementById('agent-view')?.classList.contains('active')){
    renderAgents();
  }
}

/* Trava ANTES de gastar. Devolve a mensagem do bloqueio, ou null se pode
   seguir — quem chama decide como mostrar. */
function bloqueioPorTeto(conv){
  const a = agenteDaConversa(conv);
  if (!agenteEstourou(a)) return null;
  const { teto, gasto } = gastoDoAgente(a);
  return `O agente "${a.name}" chegou ao teto de gasto: US$ ${gasto.toFixed(4)} de ` +
    `US$ ${teto.toFixed(2)}. Ele não vai gastar mais nada até você aumentar o ` +
    `limite (Agentes › Editar › Teto de gasto) ou zerar o contador.`;
}

/* ---------- ferramentas por agente ---------- */

/* As ferramentas que ESTE agente enxerga. Sem agente, ou com `tools` nulo,
   continua sendo tudo — o comportamento de antes. */
function ferramentasDoAgente(conv){
  const a = agenteDaConversa(conv);
  const n = a ? agenteNormalizado(a) : null;
  const todas = Object.keys(TOOLS);
  if (!n || !n.tools) return todas;
  /* Interseção, e não a lista salva direto: uma ferramenta pode ter deixado de
     existir entre uma versão e outra, e mandar nome fantasma pro modelo faz ele
     tentar chamar o que não há. */
  return todas.filter(t => n.tools.includes(t));
}

/* Rótulo legível de cada ferramenta, pra tela de configuração. Sem isto a lista
   seria de nomes internos (`pc_action`), que não dizem nada a quem escolhe. */
const FERRAMENTA_ROTULO = {
  get_datetime: 'Data e hora',
  calculate: 'Calcular',
  buscar_meus_documentos: 'Buscar nos meus documentos',
  enviar_email: 'Enviar e-mail (pede confirmação)',
  ver_agenda: 'Ver agenda',
  marcar_evento: 'Marcar evento',
  pc_action: 'Rodar comando no PC',
  pc_file: 'Mexer em arquivo do PC',
  execute_code: 'Executar código',
  browse_web: 'Abrir página',
};
const rotuloFerramenta = (t) => FERRAMENTA_ROTULO[t] || t;

/* ---------- rodar sozinho ---------- */

/* O loop autônomo com a identidade DESTE agente: o prompt dele, o modelo dele,
   e o teto dele. Antes era um modo global — o mesmo loop pra qualquer coisa. */
async function rodaAgenteSozinho(agente, tarefa){
  if (!backendUrl()){
    toast('O modo autônomo roda no Backend VTz OS. Configure o backend primeiro.', 'warn');
    return;
  }
  const bloqueio = agenteEstourou(agente)
    ? `"${agente.name}" está no teto de gasto. Aumente o limite antes de soltá-lo.`
    : null;
  if (bloqueio){ toast(bloqueio, 'warn'); return; }

  const pedido = (tarefa || '').trim() ||
    (prompt(`O que "${agente.name}" deve fazer sozinho?\n\n` +
            'Ele vai trabalhar em várias rodadas até terminar — descreva o RESULTADO ' +
            'esperado, não o passo a passo.') || '').trim();
  if (!pedido) return;

  /* Conversa própria, marcada com o agente (startAgentConversation já grava o
     agentId): é assim que o gasto das várias rodadas cai na conta certa e as
     ferramentas dele valem.

     A tarefa entra pelo campo de mensagem porque é DE LÁ que o loop autônomo a
     lê. Duplicar a leitura aqui criaria um segundo caminho pra mesma coisa, e
     dois caminhos divergem. */
  startAgentConversation(agente);
  const campo = document.getElementById('chat-input');
  if (!campo){ toast('Não achei o campo de mensagem.', 'warn'); return; }
  campo.value = pedido;
  if (typeof startAutonomousAgent === 'function') await startAutonomousAgent();
  else toast('O modo autônomo não está disponível nesta versão.', 'warn');
}
