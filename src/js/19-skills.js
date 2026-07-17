/* Instala uma skill de um SKILL.md raw do GitHub (CORS liberado no raw). */
/* núcleo compartilhado: baixa um SKILL.md cru, parseia e adiciona às skills.
   Usado tanto pela aba Config (instalar por URL) quanto pelos comandos do chat. */
/* baixa 1 SKILL.md cru (rápido: aborta em 6s). Retorna {url, text} ou lança. */
async function fetchSkillMarkdown(rawUrl){
  const url = rawUrl.replace(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\//, 'https://raw.githubusercontent.com/$1/$2/');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try{
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const text = await r.text();
    if (text.length > 60000) throw new Error('arquivo grande demais pra uma skill');
    return { url, text };
  } finally { clearTimeout(t); }
}
/* parseia o markdown de uma skill e adiciona ao estado (sem rede). */
function addSkillFromMarkdown(text, url){
  let name = '', desc = '';
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm){
    name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '') || '';
    desc = (fm[1].match(/^description:\s*(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '') || '';
  }
  if (!name){
    const h1 = text.match(/^#\s+(.+)$/m);
    name = h1 ? h1[1].trim() : (url.split('/').slice(-2, -1)[0] || 'Skill importada');
  }
  const trigger = deriveSkillKeywords(name, desc, fm ? fm[1] : '');
  const skill = { id: uid(), name: name.slice(0, 60), trigger, instructions: text, active:false, _sourceUrl: url, _desc: desc.slice(0, 200) };
  state.skills.push(skill);
  persistSkills();
  if (typeof renderSkills === 'function') renderSkills();
  return skill;
}
async function installSkillFromRawUrl(rawUrl){
  const { url, text } = await fetchSkillMarkdown(rawUrl);
  return addSkillFromMarkdown(text, url);
}
/* Testa TODAS as URLs candidatas em paralelo e instala a 1ª que responder um
   SKILL.md válido — muito mais rápido que tentar uma de cada vez. */
async function installSkillFromCandidates(candidates){
  const attempts = candidates.map(u => fetchSkillMarkdown(u));
  let hit;
  try{ hit = await Promise.any(attempts); }
  catch(_){ return null; }  // nenhuma respondeu
  return addSkillFromMarkdown(hit.text, hit.url);
}
/* Gera palavras-chave (trigger) automaticamente ao instalar uma skill.
   1º: campos explícitos no frontmatter (keywords/triggers/tags), inline ou lista YAML.
   2º: deriva de name + description, tirando palavras vazias (PT+EN) e curtas. */
function deriveSkillKeywords(name, desc, fmBody){
  const clean = (s) => s.trim().replace(/^["'\[]|["'\]]$/g, '').toLowerCase();
  if (fmBody){
    // inline: "keywords: a, b, c"  ou  "tags: [a, b]"  (whitespace horizontal só,
    // pra não atravessar a quebra de linha e capturar a 1ª linha de uma lista YAML)
    const inline = fmBody.match(/^[ \t]*(?:keywords|triggers|tags)[ \t]*:[ \t]*(\S.*)$/im);
    if (inline && inline[1].trim() && !inline[1].trim().startsWith('#')){
      const kws = inline[1].replace(/^\[|\]$/g, '').split(/[,;]/).map(clean).filter(Boolean);
      if (kws.length) return [...new Set(kws)].slice(0, 12).join(', ');
    }
    // lista YAML multilinha: "keywords:\n  - a\n  - b"
    const ml = fmBody.match(/^\s*(?:keywords|triggers|tags)\s*:\s*\n((?:\s*-\s*.+\n?)+)/im);
    if (ml){
      const kws = ml[1].split('\n').map(l => clean(l.replace(/^\s*-\s*/, ''))).filter(Boolean);
      if (kws.length) return [...new Set(kws)].slice(0, 12).join(', ');
    }
  }
  // fallback: deriva de name + description
  const STOP = new Set(('a,o,e,de,da,do,das,dos,para,por,com,sem,que,uma,um,as,os,no,na,nos,nas,em,ao,à,se,ou,mais,seu,sua,como,quando,' +
    'the,and,for,with,without,that,this,your,you,use,uses,used,using,when,how,what,to,of,in,on,is,are,be,as,it,at,an,or,from,by,its,into,can,will,help,helps,skill,skills,agent').split(','));
  const text = (name + ' ' + desc).toLowerCase();
  const words = text.match(/[a-zà-ú0-9][a-zà-ú0-9.\-]{2,}/gi) || [];
  const seen = new Set(), out = [];
  for (const w of words){
    const c = w.replace(/[.\-]+$/, '');
    if (c.length < 3 || STOP.has(c) || seen.has(c)) continue;
    seen.add(c); out.push(c);
    if (out.length >= 8) break;
  }
  return out.join(', ');
}
async function installSkillFromUrl(){
  const input = document.getElementById('skill-url-input');
  const url = input.value.trim();
  if (!url){ toast('Cole a URL do SKILL.md primeiro.', 'warn'); return; }
  try{
    const s = await installSkillFromRawUrl(url);
    input.value = '';
    toast(`Skill "${s.name}" instalada. Ative na aba Skills (switch) ou defina palavras-chave.`);
  }catch(e){ toast('Falha ao instalar: ' + e.message, 'err'); }
}

/* Resolve a "fonte" de uma skill (repo do GitHub + nome, ou URL crua) numa
   lista de URLs candidatas de SKILL.md pra tentar em ordem. */
function resolveSkillCandidates(src, skillName){
  const out = [];
  // já é um SKILL.md cru ou um blob do GitHub → usa direto
  if (/SKILL\.md(\?|#|$)/i.test(src) || /\/blob\//.test(src) || /raw\.githubusercontent\.com/.test(src)){
    out.push(src);
    if (!skillName) return out;
  }
  // repo do GitHub (URL completa) ou "owner/repo"
  const m = src.match(/github\.com\/([^/]+)\/([^/#?]+)/i) || src.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (m){
    const owner = m[1], repo = m[2].replace(/\.git$/, '');
    for (const br of ['main', 'master']){
      if (skillName){
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/${skillName}/SKILL.md`);
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/skills/${skillName}/SKILL.md`);
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/.claude/skills/${skillName}/SKILL.md`);
      } else {
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${br}/SKILL.md`);
      }
    }
  }
  return [...new Set(out)];
}

/* Comandos de skill no chat: `npx skills add <repo> --skill <nome>`, `/skill list`, etc.
   Não roda npx de verdade (o navegador não tem Node) — o site reconhece a sintaxe e
   faz o equivalente: resolve o SKILL.md, baixa e instala. */
function parseSkillCommand(raw){
  const rest = raw.trim().replace(/^npx\s+skills\b/i, '').replace(/^\/skills?\b/i, '').trim();
  const tokens = rest.split(/\s+/).filter(Boolean);
  const sub = (tokens.shift() || 'help').toLowerCase();
  let skillName = '';
  const args = [];
  for (let i = 0; i < tokens.length; i++){
    if (tokens[i] === '--skill' || tokens[i] === '-s') skillName = tokens[++i] || '';
    else args.push(tokens[i]);
  }
  return { sub, args, skillName };
}
async function handleSkillCommand(raw, conv){
  conv.messages.push({ role:'user', content: raw, _local:true, ts: Date.now() });
  const reply = (md) => {
    conv.messages.push({ role:'assistant', content: md, _local:true, ts: Date.now() });
    conv.updatedAt = Date.now();
    renderChat(); persistConversations(); renderHistoryList();
  };
  const findSkill = (q) => {
    q = (q || '').toLowerCase();
    return state.skills.find(x => x.name.toLowerCase() === q) || state.skills.find(x => x.name.toLowerCase().includes(q));
  };
  const { sub, args, skillName } = parseSkillCommand(raw);

  if (sub === 'add' || sub === 'install'){
    const src = args[0];
    if (!src) return reply('**Uso:** `npx skills add <repo-ou-url> --skill <nome>`\n\nEx.: `npx skills add https://github.com/microsoft/azure-skills --skill azure-quotas`');
    const candidates = resolveSkillCandidates(src, skillName);
    if (!candidates.length) return reply('Não entendi a fonte. Passe um repo do GitHub (`owner/repo` ou URL) com `--skill <nome>`, ou a URL crua de um `SKILL.md`.');
    reply(`⏳ Instalando skill de \`${esc(src)}\`${skillName ? ' (`'+esc(skillName)+'`)' : ''}…`);
    const installed = await installSkillFromCandidates(candidates);
    // remove a mensagem "instalando" antes de dar o resultado final
    conv.messages.pop();
    if (installed){
      const kw = installed.trigger ? `\n\n🔑 Palavras-chave (disparo automático): \`${esc(installed.trigger)}\`` : '';
      reply(`✅ Skill **${esc(installed.name)}** instalada.${installed._desc ? '\n\n_'+esc(installed._desc)+'_' : ''}${kw}\n\nJá dispara sozinha quando essas palavras aparecem na conversa — ou ative de vez com \`/skill on ${esc(installed.name)}\`. Ajuste as palavras na aba **Skills**.`);
    } else {
      reply(`❌ Não achei o \`SKILL.md\`. Tentei:\n\n${candidates.map(c => '- `' + c + '`').join('\n')}\n\nConfira o nome em \`--skill\`, ou cole a URL crua do \`SKILL.md\` direto no \`add\`.`);
    }
    return;
  }
  if (sub === 'list' || sub === 'ls'){
    if (!state.skills.length) return reply('Nenhuma skill instalada ainda.\n\nInstale com `npx skills add <repo> --skill <nome>`.');
    const rows = state.skills.map(s => `- ${s.active ? '🟢' : '⚪'} **${esc(s.name)}**${s._desc ? ' — ' + esc(s._desc) : ''}`).join('\n');
    return reply(`**Skills instaladas (${state.skills.length}):**\n\n${rows}\n\n_🟢 ativa · ⚪ inativa. Use \`/skill on <nome>\` pra ativar._`);
  }
  if (sub === 'remove' || sub === 'rm' || sub === 'uninstall'){
    const s = findSkill(skillName || args.join(' '));
    if (!s) return reply(`Não achei essa skill. Veja \`/skill list\`.`);
    state.skills = state.skills.filter(x => x.id !== s.id);
    persistSkills(); if (typeof renderSkills === 'function') renderSkills();
    return reply(`🗑️ Skill **${esc(s.name)}** removida.`);
  }
  if (sub === 'on' || sub === 'enable' || sub === 'off' || sub === 'disable'){
    const s = findSkill(skillName || args.join(' '));
    if (!s) return reply(`Não achei essa skill. Veja \`/skill list\`.`);
    s.active = (sub === 'on' || sub === 'enable');
    persistSkills(); if (typeof renderSkills === 'function') renderSkills();
    return reply(`${s.active ? '🟢' : '⚪'} Skill **${esc(s.name)}** ${s.active ? 'ativada' : 'desativada'}.`);
  }
  return reply(`**Comandos de skills** (digite no chat):\n\n- \`npx skills add <repo> --skill <nome>\` — instala do GitHub\n- \`/skill list\` — lista as instaladas\n- \`/skill on <nome>\` · \`/skill off <nome>\` — ativa/desativa\n- \`/skill remove <nome>\` — remove\n\nTambém aceita a URL crua de um \`SKILL.md\` direto no \`add\`.\n\n_Obs: não roda \`npx\` de verdade (o navegador não tem Node) — o site reconhece a sintaxe e baixa o \`SKILL.md\` do repo._`);
}
