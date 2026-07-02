
// ── PERSISTÊNCIA DE SESSÃO (sobrevive ao F5) ──
function saveSession(user, role) {
  try {
    localStorage.setItem('cs_user', JSON.stringify({email: user.email, role}));
    localStorage.setItem('cs_dia', new Date().toDateString());
  } catch(e) {}
}
async function carregarDados() {
  // Carregar tarefas do Sheets
  // Limpar listas antes de popular com dados reais
  const hPendEl = document.getElementById('h-pend');
  const hDoneEl = document.getElementById('h-done');
  if(hPendEl) hPendEl.innerHTML = '<div class="f11 cm" style="padding:20px;text-align:center;color:var(--dim);">✅ Nenhuma tarefa pendente!</div>';
  if(hDoneEl) hDoneEl.innerHTML = '<div class="f11 cm" style="padding:20px;text-align:center;color:var(--dim);">Nenhuma concluída hoje ainda.</div>';

  const res = await apiGet('getTarefas', {email: currentUser.email});
  if(res && res.ok && res.tarefas.length > 0) {
    const pend = document.getElementById('h-pend');
    const done = document.getElementById('h-done');
    const allTasks = document.getElementById('all-tasks');
    let pendHTML = '', doneHTML = '', allHTML = '';
    const urgMap = {urgente:'🔴 Urgente', normal:'🟡 Normal', baixa:'🟢 Baixa'};
    const urgClass = {urgente:'tag-u', normal:'tag-n', baixa:'tag-l'};
    let total=0, feitas=0, urgentes=0;
    res.tarefas.forEach(t => {
      var _em = currentUser.email.toLowerCase();
      if((t.usuario_email||'').toLowerCase()!==_em && (t.designado_para||'').toLowerCase()!==_em) return;
      total++;
      const tid = t.id;
      const urg = t.urgencia || 'normal';
      const tagCls = urgClass[urg] || 'tag-n';
      const tagLbl = urgMap[urg] || '🟡 Normal';
      const row = `<div class="ti" id="${tid}">
        <div class="chk" onclick="ckTask(event,'${tid}',this)"></div>
        <div class="f1 mw0">
          <div class="tt">${t.titulo}</div>
          <div class="tm"><span class="tag ${tagCls}">${tagLbl}</span><span class="tag">${t.categoria||''}</span><span class="ttime">${t.tempo||''}</span></div>
        </div>
      </div>`;
      if(t.status === 'concluida') {
        feitas++;
        doneHTML += `<div class="ti" style="opacity:.6;">
          <div class="chk done"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="f1 mw0"><div class="tt struck">${t.titulo}</div><div class="tm"><span class="tag tag-d">Concluída</span></div></div>
        </div>`;
      } else {
        if(urg === 'urgente') urgentes++;
        pendHTML += row;
        allHTML += row;
      }
    });
    if(pend) pend.innerHTML = pendHTML || '<div class="f11 cm" style="padding:20px;text-align:center;color:var(--dim);">✅ Nenhuma tarefa pendente!</div>';
    if(done) done.innerHTML = doneHTML || '<div class="f11 cm" style="padding:20px;text-align:center;color:var(--dim);">Nenhuma concluída hoje ainda.</div>';
    if(allTasks) allTasks.innerHTML = allHTML || '<div class="f11 cm" style="padding:16px;text-align:center;color:var(--dim);">Nenhuma tarefa encontrada.</div>';
    // Atualizar métricas
    const el = (id,v) => {const e=document.getElementById(id);if(e)e.textContent=v;};
    el('cnt-total', total); el('cnt-feitas', feitas); el('cnt-urgentes', urgentes);
  }

  // Carregar alarmes do Sheets
  const alRes = await apiGet('getAlarmes', {email: currentUser.email});
  if(alRes && alRes.ok && alRes.alarmes.length > 0) {
    ALARMS = alRes.alarmes.map(a => ({
      hora: a.hora, msg: a.mensagem, ativo: a.ativo, disparado: false, id: a.id
    }));
    if(document.getElementById('alarm-list')) renderAlarms();
  }

  // Sincronizar tarefas pendentes com o Modo Foco
  const pool = document.getElementById('foco-pool');
  if(pool && res && res.ok && res.tarefas) {
    const pendentes = res.tarefas.filter(t => t.status !== 'concluida');
    if(pendentes.length > 0) {
      const urgMap = {urgente:'🔴 Urgente', normal:'🟡 Normal', baixa:'🟢 Baixa'};
      const urgClass = {urgente:'tag-u', normal:'tag-n', baixa:'tag-l'};
      pool.innerHTML = pendentes.map(t => {
        const urg = t.urgencia || 'normal';
        const fid = 'fp-' + t.id;
        return `<div class="ti" id="${fid}" style="cursor:pointer;" onclick="toggleFocoSelect('${fid}','${t.titulo.replace(/'/g,"\'")}','${urgClass[urg]}','${urgMap[urg]}','${t.tempo||'—'}')">
          <div class="chk" id="fpc-${t.id}"></div>
          <div class="f1 mw0"><div class="tt f12">${t.titulo}</div>
          <div class="tm"><span class="tag ${urgClass[urg]}">${urgMap[urg]}</span><span class="ttime">${t.tempo||'—'}</span></div></div>
        </div>`;
      }).join('');
    }
  }

  // Zerar badges ao carregar
  canalUnread = 0;
  updateCanalBadge();
  const dot = document.getElementById('notif-dot');
  if(dot) dot.style.display = 'none';

  // Cache para dashboard
  if(res && res.ok) window.DASH_TAREFAS = res.tarefas || [];

  // Carregar Canal CS
  const canalRes = await apiGet('getCanal');
  if(canalRes && canalRes.ok) { renderCanalFeed(canalRes.posts); window.DASH_POSTS = canalRes.posts || []; }

  // Renderizar fixas e limpar antigas
  limparFixasAntigas();
  renderFixasDia();

  // Carregar dash master
  if(role === 'master') {
    const dashRes = await apiGet('getDash');
    if(dashRes && dashRes.ok) {
      const el = (id,v) => {const e=document.getElementById(id);if(e)e.textContent=v;};
      el('dash-abertas', dashRes.pendentes);
      el('dash-hoje', dashRes.concluidasHoje);
      el('dash-atrasadas', dashRes.atrasadas);
    }
  }

  // Atualizar listas que dependem de USERS
  renderTimeCS();
  renderPdiMaster();
  renderCadList();
  atualizarSeletores();
}

function renderCanalFeed(posts) {
  const feed = document.getElementById('canal-feed');
  if(!feed) return;
  if(!posts || posts.length === 0) {
    feed.innerHTML = '<div class="f11 cm" style="padding:30px;text-align:center;color:var(--dim);">Nenhum post ainda. Seja a primeira a publicar! 📢</div>';
    return;
  }
  feed.innerHTML = posts.map(p => {
    const init = p.autor_nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    const tempo = new Date(p.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    return `<div class="post" id="post-${p.id}" data-lido="false">
      <div class="fx ic gap8 mb8">
        <div class="p-av" style="background:linear-gradient(135deg,var(--purple),var(--cyan));">${init}</div>
        <div class="f1"><div class="f12 fw6" style="color:var(--text);">${p.autor_nome}</div><div class="f10 cdim">${tempo}</div></div>
        ${p.fixado?'<span class="tag" style="background:rgba(245,158,11,.15);color:#fcd34d;">📌 Fixado</span>':''}
        <span class="tag tag-i">${p.tipo}</span>
        <div id="lido-${p.id}" style="width:8px;height:8px;border-radius:50%;background:var(--purple);flex-shrink:0;"></div>
      </div>
      <div class="p-body">${p.mensagem}</div>
      <div class="fx gap6">
        <button class="react" onclick="toggleReacao(this,'👍','post-${p.id}')">👍 <span class="cnt-reacao">0</span></button>
        <button class="react" onclick="toggleReacao(this,'❤️','post-${p.id}')">❤️ <span class="cnt-reacao">0</span></button>
        <button class="react" onclick="toggleReacao(this,'🔥','post-${p.id}')">🔥 <span class="cnt-reacao">0</span></button>
        <button class="react" onclick="toggleReply(this)">💬 Responder</button>
        <button class="react" onclick="excluirPost('post-${p.id}')" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);color:#fca5a5;">🗑</button>
        <button class="react" onclick="markPostRead('post-${p.id}','lido-${p.id}')" style="margin-left:auto;">✓ Lido</button>
      </div>
      <div class="reply-area" style="display:none;margin-top:8px;border-top:1px solid var(--border);padding-top:8px;"><input placeholder="Resposta..."></div>
    </div>`;
  }).join('');
  // Só contar como não lido posts das últimas 24h
  const ontem = Date.now() - 86400000;
  canalUnread = posts.filter(p => new Date(p.criado_em).getTime() > ontem).length;
  updateCanalBadge();
}

function loadSession() {
  try {
    // Verificar se é um novo dia - se sim, limpar dados do dia anterior
    const hoje = new Date().toDateString();
    const ultimoDia = localStorage.getItem('cs_dia');
    if (ultimoDia && ultimoDia !== hoje) {
      // Novo dia! Limpar tarefas do dia anterior mas manter login
      const savedUser = localStorage.getItem('cs_user');
      localStorage.removeItem('cs_user');localStorage.removeItem('cs_dia');
      if (savedUser) localStorage.setItem('cs_user', savedUser);
      localStorage.setItem('cs_dia', hoje);
    } else if (!ultimoDia) {
      localStorage.setItem('cs_dia', hoje);
    }
    const saved = localStorage.getItem('cs_user');
    if (!saved) return false;
    const {email, role} = JSON.parse(saved);
    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return false;
    loginAs(role, user);
    return true;
  } catch(e) { return false; }
}
// Tentar restaurar sessão ao carregar
window.addEventListener('DOMContentLoaded', () => { setTimeout(loadSession, 50); });

// ── URL DO APPS SCRIPT ──
// Após publicar o Apps Script, cole a URL aqui:
const API_URL = 'https://script.google.com/a/macros/cellfy.com.br/s/AKfycbwA0w6BZzZ45bPG5MlhXVfTtX933zeZQjfTwSbyheRz0lC2cynZyasKjJUaWYK86SNN/exec';

// Usuários locais (fallback enquanto API não está configurada)
let USERS=[
  {id:1,nome:'Rafa Souza',         email:'rafaelasouza@cellfy.com.br',   senha:'cellfy2026',cargo:'CX Leader',                     nivel:'master', no_time:false},
  {id:2,nome:'Roseane Santos',     email:'roseanesantos@cellfy.com.br',  senha:'cellfy2026',cargo:'Assistente de E-Commerce Pleno',nivel:'membro', no_time:true},
  {id:3,nome:'Larissa Nascimento', email:'larissanascimento@cellfy.com.br',senha:'cellfy2026',cargo:'Auxiliar de E-commerce',      nivel:'membro', no_time:true},
  {id:4,nome:'Sarah Katriny',      email:'sarahsilva@cellfy.com.br',     senha:'cellfy2026',cargo:'Auxiliar de E-commerce',        nivel:'membro', no_time:true},
];

// ── API: buscar dados do Sheets ──
async function apiGet(action, params={}) {
  if (!API_URL) return null; // Sem API configurada
  try {
    const qs = new URLSearchParams({action, ...params}).toString();
    const r = await fetch(API_URL + '?' + qs);
    return await r.json();
  } catch(e) {
    console.warn('[API] Erro:', e);
    return null;
  }
}

async function apiPost(action, dados) {
  if (!API_URL) return null;
  try {
    const url = API_URL + '?action=' + action + '&dados=' + encodeURIComponent(JSON.stringify(dados));
    const r = await fetch(url);
    return await r.json();
  } catch(e) {
    console.warn('[API] Erro:', e);
    return null;
  }
}
let currentUser=USERS[0],role='master',isDark=true,autoTmr=null,timerInt=null,timerSec=25*60,timerOn=false,pomoDone=0;
const PGS={dashboard:'Minha Dashboard',hoje:'Meu Dia',foco:'Modo Foco',tarefas:'Tarefas',ferramentas:'Central de Ferramentas',metricas:'Minhas Métricas',pdi:'Meu PDI',canal:'Canal CS',dash:'Visão Geral do Time',time:'Gerenciar Time','pdi-master':'PDIs do Time',config:'Configurações',cadastro:'Cadastro de Colaboradores'};
const d=new Date();
document.getElementById('ps').textContent=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());

function doLogin(){
  const e=document.getElementById('l-email').value.trim().toLowerCase();
  const p=document.getElementById('l-pass').value;
  const u=USERS.find(x=>x.email.toLowerCase()===e&&x.senha===p);
  if(!u){alert('E-mail ou senha incorretos.');return;}
  loginAs(u.nivel,u);
}
function loginAs(r,u){
  role=r;currentUser=u||USERS[0];
  document.getElementById('v-login').style.display='none';
  document.getElementById('app').style.display='flex';
  const isMaster=r==='master';
  if(isMaster) document.body.classList.add('is-master');
  else document.body.classList.remove('is-master');
  document.getElementById('ns-master').style.display=isMaster?'block':'none';
  const init=currentUser.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('sb-av').textContent=init;
  document.getElementById('sb-nm').textContent=currentUser.nome;
  document.getElementById('sb-rl').textContent=currentUser.cargo||'Colaboradora';
  document.getElementById('sb-rl').textContent=currentUser.cargo;
  document.getElementById('btn-at').style.display=isMaster?'inline-flex':'none';
  document.getElementById('btn-post').style.display=isMaster?'inline-flex':'none';
  sp('hoje');changeInterval('30');
}
function doLogout(){
  document.getElementById('app').style.display='none';
  document.getElementById('v-login').style.display='flex';
  if(autoTmr)clearInterval(autoTmr);
}
function sp(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('act'));
  document.querySelectorAll('.ni').forEach(x=>x.classList.remove('act'));
  const pg=document.getElementById('p-'+p);if(pg)pg.classList.add('act');
  const ni=document.getElementById('n-'+p);if(ni)ni.classList.add('act');
  document.getElementById('pt').textContent=PGS[p]||p;
  document.getElementById('add-panel').style.display='none';

  if(p==='pdi') renderPdi();
  if(p==='config') renderAlarms();
  if(p==='hoje'){renderFixasDia();renderBannerLembretes();}
  if(p==='time') renderTimeCS();
  if(p==='cadastro') renderCadList();
  if(p==='pdi-master') renderPdiMaster();
  if(p==='dashboard') initDashboard();
  if(p==='ferramentas') renderFerramentas();
}
function tMode(){isDark=!isDark;document.body.classList.toggle('lm',!isDark);document.getElementById('ml').textContent=isDark?'Claro':'Escuro';}

function ckTask(e,id,chk){
  e.stopPropagation();
  const row=document.getElementById(id);
  if(!row)return;
  if(chk.classList.contains('done')){
    chk.classList.remove('done');
    chk.innerHTML='';
    row.style.opacity='1';
    const tt=row.querySelector('.tt');if(tt)tt.classList.remove('struck');
  }else{
    chk.classList.add('done');
    chk.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
    const tt=row.querySelector('.tt');if(tt)tt.classList.add('struck');
    setTimeout(()=>{
      const done=document.getElementById('h-done');
      if(done){
        const title=tt?tt.textContent:'Tarefa';
        const doneId='done-'+Date.now();
        const clone=document.createElement('div');
        clone.className='ti';
        clone.id=doneId;
        clone.style.opacity='.85';
        clone.innerHTML=`<div class="chk done"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="f1 mw0"><div class="tt struck">${title}</div>
          <div class="tm"><span class="tag tag-d">Concluída</span></div></div>
          <button onclick="undoTask('${doneId}','${title}')" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);color:#fcd34d;border-radius:5px;padding:2px 7px;font-size:10px;cursor:pointer;white-space:nowrap;font-family:inherit;" title="Mover de volta para pendentes">↩ Desfazer</button>`;
        done.prepend(clone);
      }
      row.style.transition='opacity .3s,height .3s,margin .3s,padding .3s';
      row.style.opacity='0';row.style.height='0';row.style.overflow='hidden';row.style.marginBottom='0';row.style.padding='0';
      setTimeout(()=>row.remove(),300);
    },500);
  }
}

function undoTask(doneId, title){
  const doneRow=document.getElementById(doneId);
  if(doneRow)doneRow.remove();
  const pend=document.getElementById('h-pend');
  if(!pend)return;
  const newId='t'+Date.now();
  const div=document.createElement('div');
  div.className='ti';div.id=newId;
  div.innerHTML=`<div class="chk" onclick="ckTask(event,'${newId}',this)"></div>
    <div class="f1 mw0"><div class="tt">${title}</div>
    <div class="tm"><span class="tag tag-n">🟡 Normal</span><span style="font-size:10px;color:var(--warn);margin-left:4px;">↩ Restaurada</span></div></div>`;
  pend.prepend(div);
}

function toggleAdd(){
  const p=document.getElementById('add-panel');
  const isOpen = p.style.display==='block';
  p.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) setTimeout(()=>{const i=document.getElementById('nt-d');if(i)i.focus();},50);
}
function toggleTF(){const f=document.getElementById('tf');f.style.display=f.style.display==='none'?'block':'none';}
function togglePF(){const f=document.getElementById('pf');f.style.display=f.style.display==='none'?'block':'none';}
// ── TAREFAS FIXAS DIÁRIAS ──
let TAREFAS_FIXAS = JSON.parse(localStorage.getItem('cs_fixas') || '[]');

function salvarFixasLocal() {
  localStorage.setItem('cs_fixas', JSON.stringify(TAREFAS_FIXAS));
}

function renderFixasDia() {
  const list = document.getElementById('fixas-list');
  const empty = document.getElementById('fixas-empty');
  if(!list) return;

  // Filtrar fixas do usuário atual (gerais + pessoais)
  const minhas = TAREFAS_FIXAS.filter(f =>
    f.escopo === 'geral' || f.criado_por === currentUser.email
  );

  if(minhas.length === 0) {
    list.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  // Verificar quais foram concluídas hoje
  const hoje = new Date().toDateString();
  const concluidasHoje = JSON.parse(localStorage.getItem('cs_fixas_concluidas_' + hoje) || '[]');

  const urgClass = {urgente:'tag-u', normal:'tag-n', baixa:'tag-l'};
  const urgMap = {urgente:'🔴 Urgente', normal:'🟡 Normal', baixa:'🟢 Baixa'};

  list.innerHTML = minhas.map(f => {
    const feita = concluidasHoje.includes(f.id);
    return `<div class="ti" id="fixa-row-${f.id}" style="margin-bottom:5px;${feita?'opacity:.6;':''}">
      <div class="chk ${feita?'done':''}" onclick="toggleFixa('${f.id}')" style="flex-shrink:0;">
        ${feita?'<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':''}
      </div>
      <div class="f1 mw0">
        <div class="tt ${feita?'struck':''}">${f.titulo}</div>
        <div class="tm">
          <span class="tag ${urgClass[f.urgencia]||'tag-n'}">${urgMap[f.urgencia]||'🟡 Normal'}</span>
          <span class="tag">${f.categoria}</span>
          ${f.escopo==='geral'?'<span class="tag tag-c">🌐 Geral</span>':'<span class="tag tag-p">👤 Pessoal</span>'}
        </div>
      </div>
      ${feita?'<span class="f10" style="color:var(--ok);flex-shrink:0;">✓ Feita hoje</span>':''}
    </div>`;
  }).join('');
}

function toggleFixa(id) {
  const hoje = new Date().toDateString();
  const key = 'cs_fixas_concluidas_' + hoje;
  let concluidas = JSON.parse(localStorage.getItem(key) || '[]');
  if(concluidas.includes(id)) {
    concluidas = concluidas.filter(x => x !== id);
  } else {
    concluidas.push(id);
  }
  localStorage.setItem(key, JSON.stringify(concluidas));
  renderFixasDia();
}

function toggleGerenciarFixas() {
  const modal = document.getElementById('modal-fixas');
  if(!modal) return;
  const isOpen = modal.style.display === 'flex';
  if(isOpen) {
    modal.style.display = 'none';
  } else {
    modal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;align-items:center;justify-content:center;';
    renderFixasGerenciar();
  }
}

function renderFixasGerenciar() {
  const list = document.getElementById('fixas-gerenciar-list');
  if(!list) return;
  if(TAREFAS_FIXAS.length === 0) {
    list.innerHTML = '<div class="f11 cm" style="padding:12px;text-align:center;color:var(--dim);">Nenhuma tarefa fixa cadastrada ainda.</div>';
    return;
  }
  const urgClass = {urgente:'tag-u', normal:'tag-n', baixa:'tag-l'};
  const urgMap = {urgente:'🔴 Urgente', normal:'🟡 Normal', baixa:'🟢 Baixa'};
  list.innerHTML = TAREFAS_FIXAS.map(f => `
    <div style="background:var(--card2);border-radius:7px;padding:9px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div class="f12 fw5" style="color:var(--text);margin-bottom:3px;">${f.titulo}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <span class="tag ${urgClass[f.urgencia]||'tag-n'}" style="font-size:9px;">${urgMap[f.urgencia]||'🟡 Normal'}</span>
          <span class="tag" style="font-size:9px;">${f.categoria}</span>
          ${f.escopo==='geral'?'<span class="tag tag-c" style="font-size:9px;">🌐 Geral</span>':'<span class="tag tag-p" style="font-size:9px;">👤 Pessoal</span>'}
          <span class="f10 cdim">por ${f.criado_por_nome}</span>
        </div>
      </div>
      <button onclick="excluirFixa('${f.id}')" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;white-space:nowrap;">🗑 Excluir</button>
    </div>`).join('');
}

function adicionarFixa() {
  const titulo = document.getElementById('fixa-titulo').value.trim();
  if(!titulo) { alert('Digite a descrição da tarefa.'); return; }
  const novaFixa = {
    id: 'fx' + Date.now(),
    titulo,
    categoria: document.getElementById('fixa-cat').value,
    urgencia: document.getElementById('fixa-urg').value,
    escopo: document.getElementById('fixa-escopo').value,
    criado_por: currentUser.email,
    criado_por_nome: currentUser.nome.split(' ')[0],
    criado_em: new Date().toISOString()
  };
  TAREFAS_FIXAS.push(novaFixa);
  salvarFixasLocal();
  document.getElementById('fixa-titulo').value = '';
  renderFixasGerenciar();
  renderFixasDia();
  showToast('Tarefa fixa adicionada! Aparecerá todo dia. ✓');
}

function excluirFixa(id) {
  if(!confirm('Excluir esta tarefa fixa? Ela não aparecerá mais nos próximos dias.')) return;
  TAREFAS_FIXAS = TAREFAS_FIXAS.filter(f => f.id !== id);
  salvarFixasLocal();
  renderFixasGerenciar();
  renderFixasDia();
}

// Limpar marcações de fixas de dias anteriores (manter localStorage limpo)
function limparFixasAntigas() {
  const hoje = new Date().toDateString();
  Object.keys(localStorage).forEach(k => {
    if(k.startsWith('cs_fixas_concluidas_') && !k.endsWith(hoje)) {
      localStorage.removeItem(k);
    }
  });
}

// ── CANAL CS ──
let canalUnread = 0;

function updateCanalBadge(){
  const badge = document.getElementById('canal-badge');
  if(!badge) return;
  if(canalUnread > 0){
    badge.textContent = canalUnread;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function markPostRead(postId, lidoId){
  const post = document.getElementById(postId);
  const dot = document.getElementById(lidoId);
  const btn = document.getElementById('btn-'+lidoId);
  if(post && post.dataset.lido === 'false'){
    post.dataset.lido = 'true';
    if(dot) dot.style.display = 'none';
    if(btn) { btn.textContent = '✓ Lido'; btn.style.color = 'var(--ok)'; btn.disabled = true; }
    canalUnread = Math.max(0, canalUnread - 1);
    updateCanalBadge();
  }
}

function markCanalRead(){
  document.querySelectorAll('.post[data-lido="false"]').forEach(post => {
    const postId = post.id;
    const lidoId = 'lido-' + postId.replace('post-','');
    markPostRead(postId, lidoId);
  });
}

async function publishPost(){
  const textarea = document.querySelector('#pf textarea');
  const select = document.querySelector('#pf select');
  if(!textarea || !textarea.value.trim()) return;
  const tipo = select ? select.value : '📢 Informativo';
  const now = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const init = document.getElementById('sb-av').textContent;
  const nome = document.getElementById('sb-nm').textContent;
  const feed = document.getElementById('canal-feed');
  const newId = 'post-' + Date.now();
  const lidoId = 'lido-' + Date.now();
  const div = document.createElement('div');
  div.className = 'post';
  div.id = newId;
  div.dataset.lido = 'false';
  div.innerHTML = `
    <div class="fx ic gap8 mb8">
      <div class="p-av" style="background:linear-gradient(135deg,var(--purple),var(--cyan));">${init}</div>
      <div class="f1"><div class="f12 fw6" style="color:var(--text);">${nome}</div><div class="f10 cdim">agora, ${now}</div></div>
      <div id="${lidoId}" style="width:8px;height:8px;border-radius:50%;background:var(--purple);flex-shrink:0;"></div>
      <span class="tag tag-i">${tipo}</span>
    </div>
    <div class="p-body">${textarea.value}</div>
    <div class="fx gap6">
      <button class="react" onclick="toggleReacao(this,'👍','${newId}')">👍 <span class="cnt-reacao">0</span></button>
      <button class="react" onclick="toggleReacao(this,'❤️','${newId}')">❤️ <span class="cnt-reacao">0</span></button>
      <button class="react" onclick="toggleReacao(this,'🔥','${newId}')">🔥 <span class="cnt-reacao">0</span></button>
      <button class="react" onclick="toggleReply(this)">💬 Responder</button>
      <button class="react" onclick="excluirPost('${newId}')" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);color:#fca5a5;">🗑</button>
      <button class="react" onclick="markPostRead('${newId}','${lidoId}')" id="btn-${lidoId}" style="margin-left:auto;">✓ Marcar como lido</button>
    </div>
    <div class="reply-area" style="display:none;margin-top:8px;border-top:1px solid var(--border);padding-top:8px;"><input placeholder="Resposta..."></div>`;
  feed.insertBefore(div, feed.firstChild);
  textarea.value = '';
  document.getElementById('pf').style.display = 'none';
  canalUnread++;
  updateCanalBadge();
  apiPost('publicarPost',{autor_email:currentUser.email,autor_nome:currentUser.nome,tipo,mensagem:div.querySelector('.p-body').textContent});
}

// Inicializar badge
setTimeout(updateCanalBadge, 200);

const REACOES={};
function toggleReacao(btn,emoji,postId){
  if(!REACOES[postId])REACOES[postId]={};
  if(!REACOES[postId][emoji])REACOES[postId][emoji]=[];
  var lista=REACOES[postId][emoji],email=currentUser.email,idx=lista.indexOf(email);
  var cel=btn.querySelector('.cnt-reacao');
  if(idx>=0){lista.splice(idx,1);btn.classList.remove('on');}else{lista.push(email);btn.classList.add('on');}
  if(cel)cel.textContent=lista.length>0?lista.length:'0';
}
function excluirPost(id){
  if(!confirm('Excluir este post?'))return;
  var el=document.getElementById(id);
  if(el){el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(function(){el.remove();},300);showToast('Post excluído.');}
}
function renderBannerLembretes(){
  var b=document.getElementById('banner-lembretes');if(!b)return;
  var ativos=ALARMS.filter(function(a){return a.ativo;});
  if(!ativos.length){b.style.display='none';return;}
  ativos.sort(function(a,c){return a.hora.localeCompare(c.hora);});
  b.style.display='flex';b.style.flexWrap='wrap';b.style.gap='6px';b.style.alignItems='center';
  b.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
    +'<strong style="margin-right:4px;">Lembretes:</strong>'
    +ativos.map(function(a){return '<span style="background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);border-radius:20px;padding:1px 10px;font-size:11px;">🕐 '+a.hora+' — '+a.msg+'</span>';}).join('');
}
function toggleReply(btn){const ra=btn.closest('.post').querySelector('.reply-area');if(ra)ra.style.display=ra.style.display==='none'?'block':'none';}

async function createTask(){
  const desc=document.getElementById('nt-d').value.trim();if(!desc)return;
  const urg=document.getElementById('nt-u').value;
  const time=document.getElementById('nt-t').value||'—';
  const obs=document.getElementById('nt-o').value.trim();
  const forVal=document.getElementById('nt-f').value;
  const URM={urgente:'🔴 Urgente',normal:'🟡 Normal',baixa:'🟢 Baixa'};
  const URC={urgente:'tag-u',normal:'tag-n',baixa:'tag-l'};
  const FORM={eu:'mim mesma',rose:'Rose',larissa:'Larissa',sarah:'Sarah'};
  const tid='t'+Date.now();
  const list=document.getElementById('h-pend');
  const div=document.createElement('div');div.className='ti';div.id=tid;
  div.innerHTML='<div class="chk" onclick="ckTask(event,\''+tid+'\',this)"></div><div class="f1 mw0"><div class="tt">'+desc+'</div><div class="tm"><span class="tag '+URC[urg]+'">'+URM[urg]+'</span><span class="ttime">'+time+'</span>'+(obs?'<span class="ttime cdim" style="font-style:italic;">&quot;'+obs+'&quot;</span>':'')+'</div></div>';
  list.prepend(div);
  const hist=document.getElementById('hist-list');
  if(hist){const now=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});const row=document.createElement('div');row.className='hist-r';row.style.cssText='background:rgba(124,92,252,.05);border-radius:6px;padding:8px;';row.innerHTML='<div class="m-av" style="background:linear-gradient(135deg,var(--purple),var(--cyan));width:28px;height:28px;font-size:10px;">'+document.getElementById('sb-av').textContent+'</div><div class="f1 mw0" style="margin-left:8px;"><div class="f12 fw6 mb6" style="color:var(--text);"><span class="cc">'+currentUser.nome.split(' ')[0]+'</span> → <span style="color:#a78bfa;">'+FORM[forVal]+'</span> — &quot;'+desc+'&quot;</div><div class="tm"><span class="tag '+URC[urg]+'">'+URM[urg]+'</span><span class="ttime">agora '+now+'</span><span class="tag tag-c">Pendente</span></div></div>';hist.insertBefore(row,hist.firstChild);}
  ['nt-d','nt-t','nt-o'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nt-u').value='normal';document.getElementById('nt-f').value='eu';
    // Atualizar aba Tarefas - all-tasks
  const allTasks = document.getElementById('all-tasks');
  if(allTasks) {
    const emptyMsg = allTasks.querySelector('.f11.cm');
    if(emptyMsg && emptyMsg.textContent.includes('Nenhuma')) emptyMsg.remove();
    const atDiv = document.createElement('div');
    atDiv.className='ti';atDiv.id='at'+tid;
    atDiv.innerHTML='<div class="chk" onclick="ckTask(event,\'at'+tid+'\',this)"></div><div class="f1 mw0"><div class="tt">'+desc+'</div><div class="tm"><span class="tag '+URC[urg]+'">'+URM[urg]+'</span><span class="ttime">'+time+'</span></div></div>';
    allTasks.prepend(atDiv);
  }

  // Atualizar Modo Foco - foco-pool
  const focoPool = document.getElementById('foco-pool');
  if(focoPool) {
    const emptyFoco = document.getElementById('foco-pool-empty');
    if(emptyFoco) emptyFoco.style.display='none';
    const fid = 'fp-'+tid;
    const fDiv = document.createElement('div');
    fDiv.className='ti'; fDiv.id=fid; fDiv.style.cursor='pointer';
    fDiv.onclick = () => toggleFocoSelect(fid, desc, URC[urg], URM[urg], time);
    fDiv.innerHTML='<div class="chk" id="fpc-'+tid+'"></div><div class="f1 mw0"><div class="tt f12">'+desc+'</div><div class="tm"><span class="tag '+URC[urg]+'">'+URM[urg]+'</span><span class="ttime">'+time+'</span></div></div>';
    focoPool.prepend(fDiv);
  }

  // Remover mensagem de "nenhuma tarefa pendente" se existir
  const pendEmpty = document.getElementById('h-pend-empty');
  if(pendEmpty) pendEmpty.style.display='none';

  document.getElementById('add-panel').style.display='none';
  sp('hoje');

  // Salvar no Sheets
  const cat = document.getElementById('nt-c').value;
  const designadoPara = forVal==='eu' ? currentUser.email : forVal;
  apiPost('salvarTarefa',{
    usuario_email: currentUser.email,
    titulo: desc, urgencia: urg, categoria: cat,
    tempo: time, observacao: obs,
    criado_por: currentUser.email,
    criado_por_nome: currentUser.nome,
    designado_para: designadoPara
  });
}

// ── FERRAMENTAS ──
let FERRAMENTAS = [
  {id:'f1', nome:'SAC Backoffice',   url:'', desc:'Formulário de registro e estornos', cat:'Formulário', icon:'📄'},
  {id:'f2', nome:'Input Diário CS',  url:'', desc:'Registro diário por plataforma',   cat:'Sheets',     icon:'📊'},
  {id:'f3', nome:'Audit CS',         url:'', desc:'Score e qualidade de atendimentos', cat:'Claude',     icon:'🤖'},
  {id:'f4', nome:'Assist CS',        url:'', desc:'Assistente inteligente de triagem', cat:'Claude',     icon:'🤖'},
  {id:'f5', nome:'CS V3',            url:'', desc:'Base principal de dados CS',       cat:'Sheets',     icon:'🗃️'},
  {id:'f6', nome:'Treinamentos CS',  url:'', desc:'Portal de capacitação da equipe',  cat:'Gestor',     icon:'🎓'},
];

const catColors = {
  'Formulário':'rgba(124,92,252,.15)',
  'Sheets':    'rgba(0,212,200,.12)',
  'Claude':    'rgba(59,130,246,.12)',
  'Gestor':    'rgba(16,185,129,.12)',
  'Sistema':   'rgba(245,158,11,.12)',
  'Outro':     'rgba(100,116,139,.12)',
};
const catTags = {
  'Formulário':'tag-p','Sheets':'tag-c','Claude':'tag-i',
  'Gestor':'tag-l','Sistema':'tag-n','Outro':'',
};

function renderFerramentas() {
  const grid = document.getElementById('ferramentas-grid');
  const empty = document.getElementById('ferr-empty');
  if(!grid) return;

  if(FERRAMENTAS.length === 0) {
    grid.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  grid.innerHTML = FERRAMENTAS.map(f => `
    <div class="tc" style="position:relative;">
      <!-- Botões de ação (só master) -->
      ${role==='master'?'<div style="position:absolute;top:8px;right:8px;display:flex;gap:4px;opacity:0;transition:opacity .15s;" class="tc-actions"><button onclick="editarFerramenta(\''+f.id+'\')" style="background:rgba(0,212,200,.15);border:1px solid var(--cyan);color:var(--cyan);border-radius:5px;padding:2px 7px;font-size:10px;cursor:pointer;" title="Editar">✏️</button><button onclick="excluirFerramenta(\''+f.id+'\')" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:5px;padding:2px 7px;font-size:10px;cursor:pointer;" title="Excluir">🗑</button></div>':''}
      <div onclick="openTool('${f.id}')" style="cursor:pointer;">
        <div class="tc-ic" style="background:${catColors[f.cat]||'rgba(100,116,139,.12)'};">
          <span style="font-size:18px;">${f.icon}</span>
        </div>
        <div class="fw6 f12 mb6" style="color:var(--text);">${f.nome}</div>
        <div class="f11 cm mb6">${f.desc}</div>
        <span class="tag ${catTags[f.cat]||''}" style="margin-top:4px;">${f.cat}</span>
      </div>
    </div>`).join('');

  // Mostrar botões ao hover
  grid.querySelectorAll('.tc').forEach(card => {
    const actions = card.querySelector('.tc-actions');
    if(!actions) return;
    card.addEventListener('mouseenter', () => actions.style.opacity='1');
    card.addEventListener('mouseleave', () => actions.style.opacity='0');
  });
}

// toggleTF já definida acima

function cancelarFerramenta() {
  const tf = document.getElementById('tf');
  if(tf) tf.style.display = 'none';
}

function salvarFerramenta() {
  const nome = document.getElementById('tf-nome').value.trim();
  const url  = document.getElementById('tf-url').value.trim();
  const desc = document.getElementById('tf-desc').value.trim();
  const cat  = document.getElementById('tf-cat').value;
  const icon = document.getElementById('tf-icon').value;
  const editId = document.getElementById('tf-editing-id').value;

  if(!nome) { alert('Digite o nome da ferramenta.'); return; }

  if(editId) {
    // Editar existente
    const f = FERRAMENTAS.find(x=>x.id===editId);
    if(f) { f.nome=nome; f.url=url; f.desc=desc; f.cat=cat; f.icon=icon; }
    showToast('Ferramenta atualizada! ✓');
  } else {
    // Nova ferramenta
    FERRAMENTAS.push({ id:'f'+Date.now(), nome, url, desc, cat, icon });
    showToast('Ferramenta adicionada! ✓');
  }

  cancelarFerramenta();
  renderFerramentas();
}

function editarFerramenta(id) {
  const f = FERRAMENTAS.find(x=>x.id===id);
  if(!f) return;

  const tf = document.getElementById('tf');
  document.getElementById('tf-title').textContent = '✏️ Editar ferramenta';
  document.getElementById('tf-editing-id').value = id;
  document.getElementById('tf-nome').value = f.nome;
  document.getElementById('tf-url').value = f.url || '';
  document.getElementById('tf-desc').value = f.desc;
  document.getElementById('tf-cat').value = f.cat;
  document.getElementById('tf-icon').value = f.icon;
  if(tf) tf.style.display = 'block';
  setTimeout(() => document.getElementById('tf-nome').focus(), 50);
}

function excluirFerramenta(id) {
  const f = FERRAMENTAS.find(x=>x.id===id);
  if(!f) return;
  if(!confirm(`Excluir a ferramenta "${f.nome}"?`)) return;
  FERRAMENTAS = FERRAMENTAS.filter(x=>x.id!==id);
  renderFerramentas();
  showToast('Ferramenta removida.');
}

function openTool(id) {
  const f = FERRAMENTAS.find(x=>x.id===id);
  if(!f) return;
  if(f.url) {
    window.open(f.url, '_blank');
  } else {
    document.getElementById('ifr-t').textContent = f.nome;
    const link = document.getElementById('ifr-link');
    if(link) { link.href = f.url || '#'; link.style.display = f.url ? 'inline-flex' : 'none'; }
    document.getElementById('ifr').style.display = 'block';
  }
}


function pickTab(el){el.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('act'));el.classList.add('act');}
function switchPdiTab(el,tabId){el.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('act'));el.classList.add('act');document.querySelectorAll('.pdi-tab').forEach(t=>{t.classList.remove('act');t.style.display='none';});const tg=document.getElementById(tabId);if(tg){tg.classList.add('act');tg.style.display='block';}}
function pickMood(el){
  el.parentElement.querySelectorAll('span').forEach(function(s){s.style.opacity='0.4';s.style.transform='scale(1)';});
  el.style.opacity='1'; el.style.transform='scale(1.3)';
  var emoji=el.textContent.trim();
  var mapa={'😴':'Esgotada','😐':'Neutro','🙂':'Bem','🔥':'Produtiva'};
  var label=mapa[emoji]||'';
  var agora=new Date();
  apiPost('salvarHumor',{usuario_email:currentUser.email,usuario_nome:currentUser.nome,emoji:emoji,label:label,
    data:agora.toLocaleDateString('pt-BR'),hora:agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),timestamp:Date.now()});
  showToast('Humor registrado: '+emoji+' '+label);
}

function setSync(s){const b=document.getElementById('sync-b');const t=document.getElementById('sync-t');const now=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});if(s==='ok'){b.className='sync-b s-ok';b.innerHTML='&#10003; Atualizado';t.textContent=now;}else if(s==='ld'){b.className='sync-b s-ld';b.innerHTML='&#8635; Atualizando...';}else{b.className='sync-b s-er';b.innerHTML='&#33; Sem conexão';t.textContent=now;}}
function doRefresh(){
  const icon=document.getElementById('ref-icon');
  if(icon){icon.style.animation='spin 1s linear infinite';}
  setTimeout(()=>{
    if(icon)icon.style.animation='';
  },1000);
}
function changeInterval(v){if(autoTmr)clearInterval(autoTmr);if(v==='0')return;autoTmr=setInterval(doRefresh,parseInt(v)*1000);}

function updTimer(){const m=Math.floor(timerSec/60),s=timerSec%60;document.getElementById('tmr').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function startTimer(){if(timerOn){clearInterval(timerInt);timerOn=false;document.getElementById('btn-st').textContent='▶ Retomar';return;}timerOn=true;document.getElementById('btn-st').textContent='⏸ Pausar';timerInt=setInterval(()=>{if(timerSec<=0){clearInterval(timerInt);timerOn=false;pomoDone++;document.getElementById('pomo-c').textContent=pomoDone;document.getElementById('tmr-l').textContent='Concluído! Faça uma pausa.';document.getElementById('btn-st').textContent='▶ Iniciar';timerSec=25*60;updTimer();return;}timerSec--;updTimer();},1000);}
// ── MODO FOCO ──
let focoFila = []; // {id, txt, tagClass, tagLabel, time, concluida}
let focoSelecionados = new Set();
let focoAtualIdx = 0;
let focoConcluidasCount = 0;

function toggleFocoSelect(rowId, txt, tagClass, tagLabel, time) {
  const chk = document.getElementById('fpc-' + rowId.replace('fp-',''));
  const row = document.getElementById(rowId);
  if (focoSelecionados.has(rowId)) {
    // Desmarcar
    focoSelecionados.delete(rowId);
    chk.classList.remove('done');
    chk.innerHTML = '';
    row.style.background = '';
    focoFila = focoFila.filter(t => t.id !== rowId);
  } else {
    // Marcar
    focoSelecionados.add(rowId);
    chk.classList.add('done');
    chk.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
    row.style.background = 'rgba(124,92,252,0.08)';
    focoFila.push({id: rowId, txt, tagClass, tagLabel, time, concluida: false});
  }
  focoUpdateFila();
}

function focoAddNew() {
  const input = document.getElementById('foco-new-txt');
  const txt = input.value.trim();
  if (!txt) return;
  const newId = 'fp-' + Date.now();
  // Adicionar na pool
  const pool = document.getElementById('foco-pool');
  const div = document.createElement('div');
  div.className = 'ti';
  div.id = newId;
  div.style.cursor = 'pointer';
  div.onclick = () => toggleFocoSelect(newId, txt, 'tag-n', '🟡 Normal', '—');
  div.innerHTML = `<div class="chk" id="fpc-${newId.replace('fp-','')}"></div><div class="f1 mw0"><div class="tt f12">${txt}</div><div class="tm"><span class="tag tag-n">🟡 Normal</span></div></div>`;
  pool.insertBefore(div, pool.firstChild);
  // Selecionar automaticamente
  toggleFocoSelect(newId, txt, 'tag-n', '🟡 Normal', '—');
  input.value = '';
}

function focoUpdateFila() {
  const list = document.getElementById('foco-fila-list');
  const emptyMsg = document.getElementById('foco-empty-msg');
  const atualWrap = document.getElementById('foco-atual-wrap');
  const progWrap = document.getElementById('foco-prog-wrap');
  const doneWrap = document.getElementById('foco-done-wrap');

  // Null check - elementos podem não existir se a página não estiver ativa
  if(!list || !emptyMsg || !atualWrap || !progWrap || !doneWrap) return;

  const pendentes = focoFila.filter(t => !t.concluida);

  if (focoFila.length === 0) {
    emptyMsg.style.display = 'block';
    atualWrap.style.display = 'none';
    progWrap.style.display = 'none';
    doneWrap.style.display = 'none';
    list.innerHTML = '<div class="f11 cm">Selecione tarefas ao lado para começar o foco.</div>';
    return;
  }

  emptyMsg.style.display = 'none';
  progWrap.style.display = 'block';

  if (pendentes.length === 0) {
    // Todas concluídas
    atualWrap.style.display = 'none';
    doneWrap.style.display = 'block';
    list.innerHTML = '';
  } else {
    doneWrap.style.display = 'none';
    // Mostrar atual
    const atual = pendentes[0];
    atualWrap.style.display = 'block';
    document.getElementById('foco-atual-txt').textContent = atual.txt;
    document.getElementById('foco-atual-meta').innerHTML = `<span class="tag ${atual.tagClass}">${atual.tagLabel}</span><span class="ttime" style="margin-left:6px;">⏱ ${atual.time}</span>`;

    // Fila restante (sem a atual)
    const resto = pendentes.slice(1);
    if (resto.length === 0) {
      list.innerHTML = '<div class="f10 cm" style="padding:6px 0;">Sem mais tarefas na fila.</div>';
    } else {
      list.innerHTML = '<div class="f10 cm mb6">Na fila:</div>' + resto.map(t => `
        <div class="ti" style="margin-bottom:4px;">
          <div class="f1 mw0"><div class="tt f11">${t.txt}</div><div class="tm"><span class="tag ${t.tagClass}" style="font-size:9px;">${t.tagLabel}</span><span class="ttime">${t.time}</span></div></div>
          <button onclick="focoRemoverDaFila('${t.id}')" style="background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:12px;" title="Remover da fila">✕</button>
        </div>`).join('');
    }
  }

  // Atualizar progresso
  const total = focoFila.length;
  const concluidas = focoFila.filter(t => t.concluida).length;
  const pct = total > 0 ? Math.round((concluidas/total)*100) : 0;
  document.getElementById('foco-prog-bar').style.width = pct + '%';
  document.getElementById('foco-prog-txt').textContent = concluidas + ' / ' + total + ' tarefas';
}

function focoConcluir() {
  const pendentes = focoFila.filter(t => !t.concluida);
  if (pendentes.length === 0) return;
  pendentes[0].concluida = true;
  focoConcluidasCount++;
  // Marcar como concluída na lista principal (Meu Dia)
  const rowId = pendentes[0].id;
  const mainRow = document.getElementById(rowId);
  if (mainRow) {
    const chk = mainRow.querySelector('.chk');
    const tt = mainRow.querySelector('.tt');
    if (chk) { chk.classList.add('done'); chk.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'; }
    if (tt) tt.classList.add('struck');
    setTimeout(() => { mainRow.style.opacity = '0.5'; }, 200);
  }
  focoUpdateFila();
}

function focoPular() {
  const pendentes = focoFila.filter(t => !t.concluida);
  if (pendentes.length <= 1) return;
  // Mover primeiro para o final
  const first = pendentes[0];
  focoFila = focoFila.filter(t => t.id !== first.id);
  focoFila.push(first);
  focoUpdateFila();
}

function focoRemoverDaFila(id) {
  focoFila = focoFila.filter(t => t.id !== id);
  focoSelecionados.delete(id);
  // Desmarcar na pool
  const chkEl = document.getElementById('fpc-' + id.replace('fp-',''));
  const rowEl = document.getElementById(id);
  if (chkEl) { chkEl.classList.remove('done'); chkEl.innerHTML = ''; }
  if (rowEl) rowEl.style.background = '';
  focoUpdateFila();
}

function focoReset() {
  focoFila = [];
  focoSelecionados.clear();
  focoConcluidasCount = 0;
  // Limpar seleções na pool
  document.querySelectorAll('#foco-pool .chk').forEach(c => { c.classList.remove('done'); c.innerHTML = ''; });
  document.querySelectorAll('#foco-pool .ti').forEach(r => r.style.background = '');
  focoUpdateFila();
}

function resetTimer(){clearInterval(timerInt);timerOn=false;timerSec=25*60;updTimer();document.getElementById('btn-st').textContent='▶ Iniciar';document.getElementById('tmr-l').textContent='Foco total — sem distrações';}
function shortBreak(){clearInterval(timerInt);timerOn=false;timerSec=5*60;updTimer();document.getElementById('tmr-l').textContent='Pausa de 5 minutos — respira!';}

function toggleCadForm(){const f=document.getElementById('cad-form');f.style.display=f.style.display==='none'?'block':'none';}
function renderPdiMaster(){
  const list = document.getElementById('pdi-master-list');
  if(!list) return;
  document.getElementById('pdi-master-index').style.display='block';
  document.getElementById('pdi-master-editor').style.display='none';

  const membros = USERS.filter(u=>u.nivel==='membro');
  if(!membros.length){
    list.innerHTML='<div class="f11 cm" style="padding:16px;text-align:center;color:var(--dim);">Nenhuma colaboradora cadastrada.</div>';
    return;
  }
  const cols=['linear-gradient(135deg,#7c5cfc,#00d4c8)','linear-gradient(135deg,#ec4899,#7c5cfc)','linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#10b981,#3b82f6)'];
  list.innerHTML = membros.map((u,i)=>{
    const init=u.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    const pdi=PDI_DATA[u.email.toLowerCase()];
    const nObjs=pdi?pdi.objetivos.length:0;
    const prog=pdi&&nObjs>0?Math.round(pdi.objetivos.reduce((s,o)=>s+o.progresso,0)/nObjs):0;
    const cor=prog>=75?'var(--ok)':prog>=40?'var(--warn)':'var(--err)';
    return `<div class="card" style="cursor:pointer;transition:all .15s;" onclick="abrirPdiColaboradora('${u.email}')"
      onmouseover="this.style.borderColor='var(--cyan)'" onmouseout="this.style.borderColor='var(--border)'">
      <div class="fx ic gap10 mb10">
        <div class="m-av" style="background:${cols[i%cols.length]};width:38px;height:38px;">${init}</div>
        <div class="f1 mw0">
          <div class="f13 fw6" style="color:var(--text);">${u.nome}</div>
          <div class="f10 cm">${u.cargo}</div>
        </div>
        <span class="tag ${nObjs>0?'tag-l':'tag-n'}">${nObjs} objetivo${nObjs!==1?'s':''}</span>
      </div>
      <div class="fx jb f10 mb5"><span class="cm">Progresso geral</span><span style="color:${cor};">${prog}%</span></div>
      <div class="prog"><div class="pf" style="width:${prog}%;background:${cor};"></div></div>
      <div class="f10 cdim mt8">Clique para editar o PDI ›</div>
    </div>`;
  }).join('');
}

let pdiEditandoEmail = '';

function abrirPdiColaboradora(email){
  pdiEditandoEmail = email.toLowerCase();
  const u = USERS.find(x=>x.email.toLowerCase()===pdiEditandoEmail);
  if(!u) return;

  if(!PDI_DATA[pdiEditandoEmail]){
    PDI_DATA[pdiEditandoEmail]={nome:u.nome,progresso:0,objetivos:[],notas:[],reunioes:[],feedbacks:[]};
  }

  document.getElementById('pdi-master-index').style.display='none';
  document.getElementById('pdi-master-editor').style.display='block';
  document.getElementById('pdi-editor-nome').textContent='PDI — '+u.nome;
  document.getElementById('pdi-editor-nome2').textContent=u.nome.split(' ')[0];
  document.getElementById('pdi-editor-cargo').textContent=u.cargo+' · '+u.email;

  renderEditorPdi();
}

function voltarPdiMaster(){
  document.getElementById('pdi-master-index').style.display='block';
  document.getElementById('pdi-master-editor').style.display='none';
  renderPdiMaster();
}

function renderEditorPdi(){
  const data=PDI_DATA[pdiEditandoEmail];
  if(!data) return;

  // Progresso geral
  const prog=data.objetivos.length>0
    ?Math.round(data.objetivos.reduce((s,o)=>s+o.progresso,0)/data.objetivos.length):0;
  document.getElementById('pdi-editor-prog').textContent=prog+'%';

  // Botão adicionar - desabilitar se já tem 3
  const btnNovo=document.getElementById('btn-novo-obj');
  if(btnNovo){
    btnNovo.disabled=data.objetivos.length>=3;
    btnNovo.style.opacity=data.objetivos.length>=3?'0.4':'1';
    btnNovo.title=data.objetivos.length>=3?'Máximo de 3 objetivos atingido':'';
  }

  // Objetivos
  const objsEl=document.getElementById('pdi-editor-objs');
  objsEl.innerHTML = data.objetivos.length===0
    ? '<div class="f11 cm mb12" style="text-align:center;padding:16px;background:var(--card2);border-radius:8px;color:var(--dim);">Nenhum objetivo ainda. Adicione o primeiro abaixo.</div>'
    : data.objetivos.map((o,i)=>`
      <div class="card mb10" style="border-left:3px solid ${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};">
        <div class="fx ic jb mb8">
          <div class="f12 fw6" style="color:var(--text);">🎯 ${o.titulo}</div>
          <div class="fx gap5">
            <button onclick="editarObjPara(${i})" style="background:rgba(0,212,200,.1);border:1px solid var(--cyan);color:var(--cyan);border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer;">✏️ Editar</button>
            <button onclick="excluirObjPara(${i})" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer;">🗑</button>
          </div>
        </div>
        <div class="f11 cm mb6">${o.meta}</div>
        <div class="fx ic gap12 mb8">
          <span class="f10 cdim">📅 Prazo: <strong style="color:var(--text);">${o.prazo||'—'}</strong></span>
          <span class="f10 cdim">Progresso: <strong style="color:${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};">${o.progresso}%</strong></span>
        </div>
        <div class="prog"><div class="pf" style="width:${o.progresso}%;background:${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};"></div></div>

        <!-- Form editar inline -->
        <div id="edit-obj-para-${i}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <div class="g2 mb8">
            <div><label class="lbl">Título</label><input id="eopt-${i}" value="${o.titulo}"></div>
            <div><label class="lbl">Prazo de entrega</label><input type="date" id="eopp-${i}" value="${o.prazo||''}"></div>
          </div>
          <div class="mb8"><label class="lbl">Meta / descrição</label>
            <textarea id="eopm-${i}" style="height:55px;resize:none;">${o.meta}</textarea>
          </div>
          <div class="mb10"><label class="lbl">Progresso: <span id="eoppr-lbl-${i}">${o.progresso}%</span></label>
            <input type="range" id="eoppr-${i}" min="0" max="100" value="${o.progresso}"
              oninput="document.getElementById('eoppr-lbl-${i}').textContent=this.value+'%'"
              style="width:100%;accent-color:var(--cyan);">
          </div>
          <div class="fx gap6">
            <button class="btn-p" style="font-size:10px;" onclick="confirmarEdicaoObjPara(${i})">💾 Salvar</button>
            <button class="btn" style="font-size:10px;" onclick="document.getElementById('edit-obj-para-${i}').style.display='none'">✕</button>
          </div>
        </div>
      </div>`).join('');

  // Notas
  const notasEl=document.getElementById('pdi-editor-notas');
  notasEl.innerHTML=(data.notas||[]).length===0
    ?'<div class="f11 cm mb8">Sem anotações ainda.</div>'
    :(data.notas||[]).map(n=>`
      <div style="background:var(--card2);border-left:2px solid ${n.tipo==='master'?'var(--cyan)':'var(--purple)'};border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:6px;">
        <div class="f10 fw6" style="color:${n.tipo==='master'?'var(--cyan)':'var(--purple)'};">${n.autor} · ${n.data}</div>
        <div class="f11 cm" style="margin-top:3px;">${n.texto}</div>
      </div>`).join('');
}

function abrirFormObjetivoPara(){
  const f=document.getElementById('form-obj-para');
  if(f) f.style.display=f.style.display==='none'?'block':'none';
  document.getElementById('obj-titulo').value='';
  document.getElementById('obj-meta').value='';
  document.getElementById('obj-prazo').value='';
  document.getElementById('obj-prog').value=0;
  document.getElementById('obj-prog-lbl').textContent='0%';
}

function salvarObjetivoPara(){
  const data=PDI_DATA[pdiEditandoEmail];
  if(!data) return;
  if(data.objetivos.length>=3){alert('Máximo de 3 objetivos por PDI.');return;}
  const titulo=document.getElementById('obj-titulo').value.trim();
  const meta=document.getElementById('obj-meta').value.trim();
  const prazo=document.getElementById('obj-prazo').value;
  const prog=parseInt(document.getElementById('obj-prog').value);
  if(!titulo||!meta){alert('Preencha título e meta.');return;}

  // Formatar prazo para exibição
  const prazoFmt=prazo?new Date(prazo+'T12:00:00').toLocaleDateString('pt-BR'):'';

  data.objetivos.push({titulo,meta,prazo:prazoFmt,progresso:prog});
  document.getElementById('form-obj-para').style.display='none';
  renderEditorPdi();
  apiPost('salvarPdiObjetivo',{usuario_email:pdiEditandoEmail,titulo,meta,prazo:prazoFmt,progresso:prog});
  showToast('Objetivo adicionado! ✓');
}

function editarObjPara(i){
  document.querySelectorAll('[id^="edit-obj-para-"]').forEach(el=>el.style.display='none');
  const f=document.getElementById('edit-obj-para-'+i);
  if(f) f.style.display='block';
}

function confirmarEdicaoObjPara(i){
  const data=PDI_DATA[pdiEditandoEmail];
  if(!data||!data.objetivos[i]) return;
  const titulo=document.getElementById('eopt-'+i).value.trim();
  const meta=document.getElementById('eopm-'+i).value.trim();
  const prazoRaw=document.getElementById('eopp-'+i).value;
  const prog=parseInt(document.getElementById('eoppr-'+i).value);
  if(!titulo||!meta){alert('Preencha título e meta.');return;}
  const prazo=prazoRaw?new Date(prazoRaw+'T12:00:00').toLocaleDateString('pt-BR'):'';
  data.objetivos[i]={titulo,meta,prazo,progresso:prog};
  renderEditorPdi();
  apiPost('salvarPdiObjetivo',{usuario_email:pdiEditandoEmail,titulo,meta,prazo,progresso:prog,index:i});
  showToast('Objetivo atualizado! ✓');
}

function excluirObjPara(i){
  if(!confirm('Excluir este objetivo?')) return;
  PDI_DATA[pdiEditandoEmail].objetivos.splice(i,1);
  renderEditorPdi();
  showToast('Objetivo excluído.');
}

function salvarNotaPara(){
  const txt=document.getElementById('pdi-editor-nota-nova').value.trim();
  if(!txt) return;
  const data=PDI_DATA[pdiEditandoEmail];
  if(!data) return;
  data.notas.push({
    autor:currentUser.nome.split(' ')[0],
    tipo:'master',
    texto:txt,
    data:new Date().toLocaleDateString('pt-BR')
  });
  document.getElementById('pdi-editor-nota-nova').value='';
  renderEditorPdi();
  apiPost('salvarNota',{usuario_email:pdiEditandoEmail,tipo:'Anotação',notas:txt,envolvidos:currentUser.nome});
}


function renderTimeCS(){
  const listCS = document.getElementById('time-cs-list');
  const listGer = document.getElementById('time-gerenciar-list');
  const countEl = document.getElementById('time-count');
  if(!listCS || !listGer) return;

  const cols = ['linear-gradient(135deg,#7c5cfc,#00d4c8)','linear-gradient(135deg,#ec4899,#7c5cfc)','linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#10b981,#3b82f6)'];
  const membros = USERS.filter(u=>u.nivel==='membro');
  const noTime = USERS.filter(u=>u.nivel==='membro' && u.no_time);
  const fora = USERS.filter(u=>u.nivel==='membro' && !u.no_time);

  if(countEl) countEl.textContent = noTime.length + ' pessoa' + (noTime.length!==1?'s':'');

  // Time CS ativo
  if(noTime.length === 0){
    listCS.innerHTML = '<div class="f11 cm" style="padding:16px;text-align:center;color:var(--dim);">Nenhuma colaboradora no Time CS ainda.<br>Ative ao lado →</div>';
  } else {
    listCS.innerHTML = noTime.map((u,i)=>{
      const init = u.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
      return `<div class="m-row">
        <div class="m-av" style="background:${cols[i%cols.length]};">${init}</div>
        <div class="f1 mw0" style="margin-left:8px;">
          <div class="f12 fw6" style="color:var(--text);">${u.nome}</div>
          <div class="f10 cm">${u.cargo}</div>
        </div>
        <div class="fx gap5">
          <button class="btn" style="font-size:10px;" onclick="toggleAdd();document.getElementById('nt-f').value='${u.email}'">✈️ Designar</button>
          <button class="btn" style="font-size:10px;color:var(--err);" onclick="removerDoTime('${u.email}')">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  // Lista para gerenciar (todos os membros)
  listGer.innerHTML = membros.map((u,i)=>{
    const init = u.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    const ativo = u.no_time;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--card2);border-radius:7px;margin-bottom:5px;">
      <div class="m-av" style="background:${cols[i%cols.length]};width:30px;height:30px;font-size:10px;">${init}</div>
      <div style="flex:1;min-width:0;">
        <div class="f12 fw5" style="color:var(--text);">${u.nome}</div>
        <div class="f10 cm">${u.cargo}</div>
      </div>
      <div class="tog ${ativo?'on':''}" onclick="toggleTimeCS('${u.email}',this)" title="${ativo?'Remover do Time CS':'Adicionar ao Time CS'}"></div>
      <span class="f10" style="color:${ativo?'var(--ok)':'var(--dim)'};min-width:40px;">${ativo?'Ativo':'Inativo'}</span>
    </div>`;
  }).join('');
}

function toggleTimeCS(email, togEl){
  const u = USERS.find(x=>x.email===email);
  if(!u) return;
  u.no_time = !u.no_time;
  togEl.classList.toggle('on');
  renderTimeCS();
  showToast(u.no_time ? u.nome.split(' ')[0]+' adicionada ao Time CS ✓' : u.nome.split(' ')[0]+' removida do Time CS');
}

function removerDoTime(email){
  const u = USERS.find(x=>x.email===email);
  if(!u) return;
  u.no_time = false;
  renderTimeCS();
  showToast(u.nome.split(' ')[0]+' removida do Time CS');
}


function renderCadList(){
  const list=document.getElementById('cad-list');if(!list)return;
  const cols=['linear-gradient(135deg,#7c5cfc,#00d4c8)','linear-gradient(135deg,#ec4899,#7c5cfc)','linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#10b981,#3b82f6)'];
  list.innerHTML=USERS.map((u,i)=>{
    const init=u.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
    const isM=u.nivel==='master';
    const onlyM=isM&&USERS.filter(x=>x.nivel==='master').length===1;
    return '<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;" id="cr-'+u.id+'">'+
      '<div class="fx ic gap10 mb10"><div class="m-av" style="background:'+cols[i%cols.length]+';width:34px;height:34px;font-size:11px;">'+init+'</div>'+
      '<div class="f1 mw0"><div class="f12 fw6" style="color:var(--text);">'+u.nome+'</div><div class="f10 cm">'+u.cargo+' · '+u.email+'</div></div>'+
      '<span class="tag '+(isM?'tag-p':'tag-c')+'">'+(isM?'⭐ Master':'Membro')+'</span></div>'+
      '<div class="fx gap6" id="vw-'+u.id+'">'+
      '<button class="btn" style="font-size:10px;" onclick="showEdit('+u.id+')">✏️ Editar</button>'+
      '<button class="btn" style="font-size:10px;" onclick="showPwd('+u.id+')">🔑 Senha</button>'+
      '<button class="btn" style="font-size:10px;color:var(--err);" onclick="delCad('+u.id+')" '+(onlyM?'disabled':'')+'>'+(onlyM?'🔒':'🗑️')+' Remover</button></div>'+
      '<div id="ed-'+u.id+'" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">'+
      '<div class="g3 mb8"><div><label class="lbl">Nome</label><input id="en-'+u.id+'" value="'+u.nome+'"></div><div><label class="lbl">Cargo</label><input id="ec-'+u.id+'" value="'+u.cargo+'"></div><div><label class="lbl">E-mail</label><input id="ee-'+u.id+'" value="'+u.email+'"></div></div>'+
      '<div class="mb8"><label class="lbl">Nível</label><select id="en2-'+u.id+'" '+(onlyM?'disabled':'')+'><option value="membro" '+(u.nivel==='membro'?'selected':'')+'>Membro</option><option value="master" '+(u.nivel==='master'?'selected':'')+'>Master</option></select></div>'+
      '<div class="fx gap6"><button class="btn-p" style="font-size:10px;" onclick="saveEdit('+u.id+')">✓ Salvar</button><button class="btn" style="font-size:10px;" onclick="cancelEdit('+u.id+')">✕ Cancelar</button></div></div>'+
      '<div id="pw-'+u.id+'" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">'+
      '<div class="g2 mb8"><div><label class="lbl">Nova senha</label><input type="password" id="np-'+u.id+'" placeholder="Mínimo 6 caracteres"></div><div><label class="lbl">Confirmar</label><input type="password" id="cp-'+u.id+'" placeholder="Repita a senha"></div></div>'+
      '<div class="fx gap6"><button class="btn-p" style="font-size:10px;" onclick="savePwd('+u.id+')">✓ Trocar senha</button><button class="btn" style="font-size:10px;" onclick="cancelPwd('+u.id+')">✕ Cancelar</button></div></div>'+
      '</div>';
  }).join('');
}
function showEdit(id){document.getElementById('ed-'+id).style.display='block';document.getElementById('pw-'+id).style.display='none';document.getElementById('vw-'+id).style.display='none';}
function cancelEdit(id){document.getElementById('ed-'+id).style.display='none';document.getElementById('vw-'+id).style.display='flex';}
function saveEdit(id){const u=USERS.find(x=>x.id===id);if(!u)return;const n=document.getElementById('en-'+id).value.trim(),c=document.getElementById('ec-'+id).value.trim(),e=document.getElementById('ee-'+id).value.trim(),nv=document.getElementById('en2-'+id).value;if(!n||!c||!e){alert('Preencha todos os campos.');return;}if(USERS.find(x=>x.id!==id&&x.email.toLowerCase()===e.toLowerCase())){alert('E-mail já em uso.');return;}u.nome=n;u.cargo=c;u.email=e;u.nivel=nv;renderCadList();}
function showPwd(id){document.getElementById('pw-'+id).style.display='block';document.getElementById('ed-'+id).style.display='none';document.getElementById('vw-'+id).style.display='none';}
function cancelPwd(id){document.getElementById('pw-'+id).style.display='none';document.getElementById('vw-'+id).style.display='flex';}
function savePwd(id){const u=USERS.find(x=>x.id===id);if(!u)return;const np=document.getElementById('np-'+id).value,cp=document.getElementById('cp-'+id).value;if(np.length<6){alert('Mínimo 6 caracteres.');return;}if(np!==cp){alert('Senhas não coincidem.');return;}u.senha=np;alert('Senha alterada com sucesso!');cancelPwd(id);}
function delCad(id){if(!confirm('Remover acesso deste colaborador?'))return;USERS=USERS.filter(u=>u.id!==id);renderCadList();}
async function saveCad(){
  const n=document.getElementById('cad-nome').value.trim(),
        e=document.getElementById('cad-email').value.trim(),
        c=document.getElementById('cad-cargo').value.trim(),
        s=document.getElementById('cad-senha').value,
        nv=document.getElementById('cad-nivel').value;
  if(!n||!e||!c||!s){alert('Preencha todos os campos.');return;}
  if(USERS.find(u=>u.email.toLowerCase()===e.toLowerCase())){alert('E-mail já cadastrado.');return;}
  if(s.length<6){alert('Senha precisa ter no mínimo 6 caracteres.');return;}
  const novoUser={id:Date.now(),nome:n,email:e,cargo:c,senha:s,nivel:nv};
  USERS.push(novoUser);
  renderCadList();
  // Salvar no Sheets
  await apiPost('salvarUsuario',{nome:n,email:e,cargo:c,senha:s,nivel:nv});
  // Atualizar seletor de designação
  atualizarSeletores();
  ['cad-nome','cad-email','cad-cargo','cad-senha'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cad-nivel').value='membro';
  document.getElementById('cad-form').style.display='none';
  showToast('Colaboradora cadastrada com sucesso! ✓');
}

// ── DADOS PDI POR USUÁRIO ──
const PDI_DATA = {
  'rose@cellfy.com.br': {
    nome: 'Roseane (Rose)',
    progresso: 68,
    objetivos: [
      {titulo:'Dominar SLA', meta:'100% das RAs em até 24h por 3 meses.', prazo:'30/06/2025', prog:75, cor:'var(--ok)'},
      {titulo:'Qualidade Audit CS', meta:'Score médio ≥ 8.5 por mês.', prazo:'31/07/2025', prog:55, cor:'var(--warn)'},
    ],
    notas: [
      {autor:'Rafa', tipo:'master', texto:'Rose está evoluindo muito bem no SLA! Foco: CSATs baixos.', data:'15/06/2025'},
      {autor:'Rose', tipo:'membro', texto:'Dificuldade com garantias complexas. Pedi apoio ao Victor.', data:'15/06/2025'},
    ],
    reunioes: [
      {data:'15/06/2025', tipo:'1:1 Mensal', notas:'Revisão PDI · SLA em evolução · Plano treino garantias', envolvidos:['Rose','Rafa']},
      {data:'01/06/2025', tipo:'Avaliação', notas:'Score 8.2 Audit CS · Melhoria: tempo WhatsApp', envolvidos:['Rose','Rafa']},
    ],
    feedbacks: [
      {tipo:'⭐ Positivo', texto:'Excelente evolução no SLA. Comunicação muito melhorou.', por:'Rafa Souza', data:'01/06/2025'},
      {tipo:'💬 Neutro', texto:'Boa condução. Registrar no SAC Backoffice antes de escalar.', por:'Rafa Souza', data:'15/06/2025'},
    ]
  },
  'larissa@cellfy.com.br': {
    nome: 'Larissa',
    progresso: 82,
    objetivos: [
      {titulo:'Excelência em Atendimento', meta:'Score Audit CS ≥ 9.0 por 2 meses.', prazo:'31/07/2025', prog:82, cor:'var(--ok)'},
    ],
    notas: [
      {autor:'Rafa', tipo:'master', texto:'Larissa está com desempenho excelente! Candidata a futura CS Lead.', data:'18/06/2025'},
    ],
    reunioes: [
      {data:'18/06/2025', tipo:'1:1 Mensal', notas:'Reconhecimento · Próximos objetivos · Plano de crescimento', envolvidos:['Larissa','Rafa']},
    ],
    feedbacks: [
      {tipo:'⭐ Positivo', texto:'Zero atrasos na semana. Gestão exemplar do volume de atendimentos.', por:'Rafa Souza', data:'18/06/2025'},
    ]
  },
  'sarah@cellfy.com.br': {
    nome: 'Sarah',
    progresso: 40,
    objetivos: [
      {titulo:'Documentação de Processos', meta:'Documentar 5 fluxos antes da saída.', prazo:'30/06/2025', prog:40, cor:'var(--warn)'},
    ],
    notas: [
      {autor:'Rafa', tipo:'master', texto:'Sarah em transição. Foco em passar o conhecimento para o time.', data:'10/06/2025'},
    ],
    reunioes: [
      {data:'10/06/2025', tipo:'Alinhamento', notas:'Plano de transição · Documentação de processos críticos', envolvidos:['Sarah','Rafa']},
    ],
    feedbacks: [
      {tipo:'💬 Neutro', texto:'Colaboração com a transição. Manter foco nos documentos pendentes.', por:'Rafa Souza', data:'10/06/2025'},
    ]
  },
  'rafa@cellfy.com.br': {
    nome: 'Rafa Souza',
    progresso: 90,
    objetivos: [
      {titulo:'Estruturação do Time CS', meta:'Time com PDI 100% definido e acompanhado.', prazo:'30/06/2025', prog:90, cor:'var(--ok)'},
      {titulo:'Automação de Relatórios', meta:'Relatório mensal em menos de 2h.', prazo:'30/06/2025', prog:75, cor:'var(--cyan)'},
    ],
    notas: [],
    reunioes: [],
    feedbacks: []
  }
};

function renderPdi() {
  const email = currentUser.email.toLowerCase();
  const isMaster = role === 'master';
  const data = PDI_DATA[email];
  const wrap = document.getElementById('pdi-obj-wrap');
  if(!wrap) return;

  if (!data) {
    wrap.innerHTML = `<div class="card" style="grid-column:1/-1;">
      <div class="f12 cm" style="text-align:center;padding:20px;">Nenhum PDI cadastrado ainda.</div>
      <div style="text-align:center;">
        <button class="btn-p" onclick="abrirNovoObjetivo()">➕ Adicionar primeiro objetivo</button>
      </div>
    </div>`;
    return;
  }

  // Calcular progresso geral
  const progGeral = data.objetivos.length > 0
    ? Math.round(data.objetivos.reduce((s,o)=>s+o.progresso,0)/data.objetivos.length)
    : 0;

  const objHtml = data.objetivos.length === 0
    ? '<div class="f11 cm" style="padding:12px;text-align:center;color:var(--dim);">Nenhum objetivo ainda.</div>'
    : data.objetivos.map((o,i) => `
    <div style="background:var(--card2);border-radius:8px;padding:12px;margin-bottom:10px;border-left:3px solid ${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};">
      <div class="fx ic jb mb6">
        <div class="f12 fw6" style="color:var(--text);">🎯 ${o.titulo}</div>
        <div class="fx gap5">
          <button onclick="editarObjetivo(${i})" style="background:rgba(0,212,200,.1);border:1px solid var(--cyan);color:var(--cyan);border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer;">✏️ Editar</button>
          <button onclick="excluirObjetivo(${i})" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:5px;padding:2px 8px;font-size:10px;cursor:pointer;">🗑</button>
        </div>
      </div>
      <div class="f11 cm mb8">${o.meta}</div>
      <div class="f10 cdim mb8">Prazo: ${o.prazo}</div>
      <div class="fx ic jb f10 mb5"><span class="cm">Progresso</span><span style="color:${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};">${o.progresso}%</span></div>
      <div class="prog"><div class="pf" style="width:${o.progresso}%;background:${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};"></div></div>
      <div id="edit-obj-${i}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
        <div class="g2 mb8">
          <div><label class="lbl">Título</label><input id="eot-${i}" value="${o.titulo}"></div>
          <div><label class="lbl">Prazo</label><input id="eop-${i}" value="${o.prazo}"></div>
        </div>
        <div class="mb8"><label class="lbl">Meta / descrição</label><textarea id="eom-${i}" style="height:50px;resize:none;">${o.meta}</textarea></div>
        <div class="mb10"><label class="lbl">Progresso: <span id="eopr-lbl-${i}">${o.progresso}%</span></label>
          <input type="range" id="eopr-${i}" min="0" max="100" value="${o.progresso}" oninput="document.getElementById('eopr-lbl-${i}').textContent=this.value+'%'" style="width:100%;accent-color:var(--cyan);">
        </div>
        <div class="fx gap6">
          <button class="btn-p" style="font-size:10px;" onclick="salvarObjetivo(${i})">💾 Salvar</button>
          <button class="btn" style="font-size:10px;" onclick="document.getElementById('edit-obj-${i}').style.display='none'">✕ Cancelar</button>
        </div>
      </div>
    </div>`).join('');

  const notasHtml = (data.notas||[]).map(n => `
    <div style="background:var(--card2);border-left:2px solid ${n.tipo==='master'?'var(--cyan)':'var(--purple)'};border-radius:0 6px 6px 0;padding:8px 10px;margin-bottom:6px;">
      <div class="f10 fw6" style="color:${n.tipo==='master'?'var(--cyan)':'var(--purple)'};">${n.autor} · ${n.data}</div>
      <div class="f11 cm" style="margin-top:3px;">${n.texto}</div>
    </div>`).join('') || '<div class="f11 cm">Sem anotações ainda.</div>';

  wrap.innerHTML = `
    <div class="card">
      <div class="ct">📋 PDI — ${data.nome}</div>
      <div class="mb10">
        <div class="fx jb f11 mb5"><span class="cm">Progresso geral</span><span class="cc">${progGeral}%</span></div>
        <div class="prog"><div class="pf" style="width:${progGeral}%;"></div></div>
      </div>
      ${objHtml}
      <button class="btn" style="width:100%;justify-content:center;margin-top:8px;font-size:11px;" onclick="abrirNovoObjetivo()">➕ Novo objetivo</button>

      <!-- Form novo objetivo -->
      <div id="form-novo-obj" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
        <div class="f11 fw6 cc mb8">Novo objetivo</div>
        <div class="g2 mb8">
          <div><label class="lbl">Título</label><input id="no-titulo" placeholder="Ex: Dominar SLA"></div>
          <div><label class="lbl">Prazo</label><input id="no-prazo" placeholder="Ex: 30/06/2025"></div>
        </div>
        <div class="mb8"><label class="lbl">Meta / descrição</label><textarea id="no-meta" style="height:50px;resize:none;" placeholder="Descreva o objetivo..."></textarea></div>
        <div class="mb10"><label class="lbl">Progresso inicial: <span id="no-prog-lbl">0%</span></label>
          <input type="range" id="no-prog" min="0" max="100" value="0" oninput="document.getElementById('no-prog-lbl').textContent=this.value+'%'" style="width:100%;accent-color:var(--cyan);">
        </div>
        <div class="fx gap6">
          <button class="btn-p" style="font-size:10px;" onclick="adicionarObjetivo()">✓ Adicionar</button>
          <button class="btn" style="font-size:10px;" onclick="document.getElementById('form-novo-obj').style.display='none'">✕ Cancelar</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="ct">📝 Anotações colaborativas</div>
      <div class="f10 cm mb8">${isMaster?'Você e '+data.nome+' podem adicionar notas':'Você e Rafa podem adicionar notas'}</div>
      ${notasHtml}
      <textarea id="pdi-new-note" placeholder="Adicione uma anotação..." style="height:55px;resize:none;margin-top:8px;margin-bottom:7px;"></textarea>
      <button class="btn-p" style="font-size:10px;" onclick="savePdiNote()">➕ Adicionar nota</button>
    </div>`;
}

function abrirNovoObjetivo() {
  const f = document.getElementById('form-novo-obj');
  if(f) f.style.display = f.style.display==='none'?'block':'none';
}

function adicionarObjetivo() {
  const email = currentUser.email.toLowerCase();
  if(!PDI_DATA[email]) PDI_DATA[email] = {nome:currentUser.nome,progresso:0,objetivos:[],notas:[],reunioes:[],feedbacks:[]};
  const titulo = document.getElementById('no-titulo').value.trim();
  const prazo = document.getElementById('no-prazo').value.trim();
  const meta = document.getElementById('no-meta').value.trim();
  const prog = parseInt(document.getElementById('no-prog').value);
  if(!titulo||!meta) {alert('Preencha título e meta.');return;}
  PDI_DATA[email].objetivos.push({titulo,meta,prazo,progresso:prog});
  renderPdi();
  apiPost('salvarPdiObjetivo',{usuario_email:email,titulo,meta,prazo,progresso:prog});
  showToast('Objetivo adicionado! ✓');
}

function editarObjetivo(i) {
  document.querySelectorAll('[id^="edit-obj-"]').forEach(el=>el.style.display='none');
  const f = document.getElementById('edit-obj-'+i);
  if(f) f.style.display='block';
}

function salvarObjetivo(i) {
  const email = currentUser.email.toLowerCase();
  const data = PDI_DATA[email];
  if(!data||!data.objetivos[i]) return;
  data.objetivos[i].titulo = document.getElementById('eot-'+i).value.trim();
  data.objetivos[i].prazo = document.getElementById('eop-'+i).value.trim();
  data.objetivos[i].meta = document.getElementById('eom-'+i).value.trim();
  data.objetivos[i].progresso = parseInt(document.getElementById('eopr-'+i).value);
  renderPdi();
  apiPost('salvarPdiObjetivo',{usuario_email:email,...data.objetivos[i],index:i});
  showToast('Objetivo atualizado! ✓');
}

function excluirObjetivo(i) {
  if(!confirm('Excluir este objetivo?')) return;
  const email = currentUser.email.toLowerCase();
  PDI_DATA[email].objetivos.splice(i,1);
  renderPdi();
  showToast('Objetivo excluído.');
}


function savePdiNote() {
  const txt = document.getElementById('pdi-new-note').value.trim();
  if (!txt) return;
  const email = currentUser.email.toLowerCase();
  if (!PDI_DATA[email]) return;
  PDI_DATA[email].notas.push({
    autor: currentUser.nome.split(' ')[0],
    tipo: role,
    texto: txt,
    data: new Date().toLocaleDateString('pt-BR')
  });
  document.getElementById('pdi-new-note').value = '';
  renderPdi();
}

function saveMeeting() {
  const email = currentUser.email.toLowerCase();
  if (!PDI_DATA[email]) return;
  const data = document.getElementById('pdi-11-date').value;
  const tipo = document.getElementById('pdi-11-tipo').value;
  const notas = document.getElementById('pdi-11-notes').value.trim();
  if (!data || !notas) { alert('Preencha data e anotações.'); return; }
  const [y,m,d2] = data.split('-');
  PDI_DATA[email].reunioes.unshift({
    data: `${d2}/${m}/${y}`,
    tipo,
    notas,
    envolvidos: [currentUser.nome.split(' ')[0], 'Rafa']
  });
  document.getElementById('pdi-11-notes').value = '';
  renderPdi();
  switchPdiTab(document.querySelector('#p-pdi .tab:nth-child(2)'), 'pdi-t2');
}

function saveFeedback() {
  const email = currentUser.email.toLowerCase();
  if (!PDI_DATA[email]) return;
  const tipo = document.getElementById('pdi-feed-tipo').value;
  const txt = document.getElementById('pdi-feed-text').value.trim();
  if (!txt) return;
  PDI_DATA[email].feedbacks.unshift({
    tipo,
    texto: txt,
    por: currentUser.nome,
    data: new Date().toLocaleDateString('pt-BR')
  });
  document.getElementById('pdi-feed-text').value = '';
  renderPdi();
}

// ── SISTEMA DE ALARMES ──



function initAudio() {
  // Inicializar AudioContext no primeiro gesto do usuário (obrigatório no Chrome)
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    console.log('[Audio] Contexto inicializado:', audioCtx.state);
  } catch(e) { console.warn('[Audio] Erro ao inicializar:', e); }
}

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playAlarmSound() {
  try {
    const ctx = getAudioCtx();
    // Garantir que o contexto está ativo
    if(ctx.state === 'suspended') ctx.resume();
    const notes = [523, 659, 784, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch(e) { console.warn('playAlarmSound erro:', e); }
}

function showAlarm(msg) {
  console.log('[ALARME]', new Date().toLocaleTimeString(), msg);

  // Remover popup anterior se existir
  const old = document.getElementById('alarm-popup');
  if(old) old.remove();

  // Criar popup direto no body - garantido aparecer
  const popup = document.createElement('div');
  popup.id = 'alarm-popup';
  popup.style.cssText = [
    'position:fixed', 'top:24px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:2147483647', 'background:linear-gradient(135deg,#7c5cfc,#00d4c8)',
    'border-radius:14px', 'padding:20px 24px', 'min-width:320px', 'max-width:90vw',
    'box-shadow:0 12px 40px rgba(0,0,0,.7)', 'font-family:system-ui,sans-serif',
    'animation:slideDown .3s ease'
  ].join(';');
  popup.innerHTML = `
    <style>@keyframes slideDown{from{transform:translateX(-50%) translateY(-20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}</style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:24px;">🔔</span>
        <span style="font-size:15px;font-weight:700;color:white;">Lembrete</span>
      </div>
      <button onclick="this.closest('#alarm-popup').remove()" style="background:rgba(255,255,255,.25);border:none;color:white;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>
    <div style="font-size:13px;color:rgba(255,255,255,.95);line-height:1.5;margin-bottom:14px;">${msg}</div>
    <button onclick="this.closest('#alarm-popup').remove()" style="width:100%;padding:9px;border-radius:8px;border:none;background:white;color:#7c5cfc;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">✓ Entendido</button>
  `;
  document.body.appendChild(popup);
  setTimeout(() => { if(popup.parentNode) popup.remove(); }, 30000);

  // Som
  try {
    const ctx = getAudioCtx();
    if(ctx.state === 'suspended') ctx.resume().then(()=>_playAlarmNotes(ctx));
    else _playAlarmNotes(ctx);
  } catch(e) {}

  // Notificação do browser
  dispararNotifBrowser(msg);

  // Sino
  try { addNotif('🔔 ' + msg, 'info'); } catch(e) {}
}

function _playAlarmNotes(ctx) {
  try {
    [523,659,784,659,784].forEach((freq,i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = 'sine';
      const t = ctx.currentTime + i*0.18;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(0.4,t+0.05);
      g.gain.linearRampToValueAtTime(0,t+0.15);
      o.start(t); o.stop(t+0.15);
    });
  } catch(e) {}
}


// ── NOTIFICAÇÃO DO BROWSER ──
function pedirPermissaoNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if(perm === 'granted') showToast('✓ Notificações ativadas! Você será avisada mesmo com o sistema minimizado.');
    });
  }
}

function dispararNotifBrowser(msg) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const notif = new Notification('🔔 CS Task Central — Cellfy', {
      body: msg,
      tag: 'alarme-cs',
      requireInteraction: true
    });
    notif.onclick = () => { window.focus(); notif.close(); };
  } catch(e) {}
}

// ── SISTEMA DE ALARMES ──
let ALARMS = [
  { id:'a1', hora:'08:30', msg:'Bom dia! Confira suas tarefas do dia.', ativo:true,  disparado:false },
  { id:'a2', hora:'12:00', msg:'Lembrete: verifique tarefas urgentes!',  ativo:true,  disparado:false },
  { id:'a3', hora:'17:00', msg:'Fechamento — atualize suas tarefas.',    ativo:false, disparado:false },
];

let alarmCheckInterval = null;
let audioCtx = null;

// initAudio já definida acima

// getAudioCtx já definida acima

function renderAlarms() {
  const wrap = document.getElementById('alarm-list');
  if(!wrap) return;
  if(ALARMS.length === 0) {
    wrap.innerHTML = '<div class="f11 cm" style="padding:8px;text-align:center;color:var(--dim);">Nenhum lembrete. Clique em "+ Novo lembrete".</div>';
    return;
  }
  wrap.innerHTML = ALARMS.map((a,i) => `
    <div style="background:var(--card2);border-radius:7px;padding:8px 10px;display:flex;align-items:center;gap:7px;margin-bottom:5px;">
      <input type="time" value="${a.hora}" id="alarm-time-${i}"
        style="width:85px;padding:4px 7px;font-size:12px;background:var(--card3,var(--card));border:1px solid var(--border2);border-radius:5px;color:var(--text);">
      <input type="text" value="${a.msg}" id="alarm-msg-${i}"
        style="flex:1;font-size:11px;padding:4px 8px;background:var(--card3,var(--card));border:1px solid var(--border2);border-radius:5px;color:var(--text);"
        placeholder="Mensagem do lembrete...">
      <div class="tog ${a.ativo?'on':''}" id="alarm-tog-${i}" onclick="toggleAlarm(${i})" title="${a.ativo?'Ativo':'Inativo'}"></div>
      <button onclick="saveAlarm(${i})" style="background:rgba(0,212,200,.12);border:1px solid var(--cyan);color:var(--cyan);border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;white-space:nowrap;font-family:inherit;">💾 Salvar</button>
      <button onclick="testAlarm(${i})" style="background:rgba(124,92,252,.12);border:1px solid var(--purple);color:#a78bfa;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;white-space:nowrap;font-family:inherit;">▶ Testar</button>
      <button onclick="removeAlarm(${i})" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:5px;padding:3px 7px;font-size:11px;cursor:pointer;font-family:inherit;">✕</button>
    </div>`).join('');
}

function addAlarm() {
  ALARMS.push({ id:'a'+Date.now(), hora:'09:00', msg:'Novo lembrete — edite aqui...', ativo:true, disparado:false });
  renderAlarms();
  // Focar no campo de texto do novo item
  const last = ALARMS.length - 1;
  setTimeout(() => {
    const el = document.getElementById('alarm-msg-'+last);
    if(el) { el.focus(); el.select(); }
  }, 100);
  showToast('Lembrete adicionado! Configure o horário e salve.');
}

function saveAlarm(i) {
  const h = document.getElementById('alarm-time-'+i);
  const m = document.getElementById('alarm-msg-'+i);
  if(!h||!m) return;
  ALARMS[i].hora = h.value;
  ALARMS[i].msg  = m.value;
  ALARMS[i].disparado = false;
  ALARMS[i].ativo = true;
  const tog = document.getElementById('alarm-tog-'+i);
  if(tog) tog.classList.add('on');
  // Salvar no Sheets
  apiPost('salvarAlarme', {
    id: ALARMS[i].id,
    hora: ALARMS[i].hora,
    mensagem: ALARMS[i].msg,
    ativo: true,
    email: currentUser.email
  });
  showToast('Lembrete salvo! ✓');renderBannerLembretes();
  checkAlarms();
}

function toggleAlarm(i) {
  ALARMS[i].ativo = !ALARMS[i].ativo;
  const tog = document.getElementById('alarm-tog-'+i);
  if(tog) tog.classList.toggle('on');
}

function removeAlarm(i) {
  if(!confirm('Remover este lembrete?')) return;
  ALARMS.splice(i, 1);
  renderAlarms();
}

function testAlarm(i) {
  initAudio();
  const msg = ALARMS[i] ? ALARMS[i].msg : 'Teste de lembrete!';
  showAlarm(msg);
}

function checkAlarms() {
  const now = new Date();
  const hh = now.getHours(), mm = now.getMinutes();
  if(hh===0 && mm===0) ALARMS.forEach(a => a.disparado = false);
  ALARMS.forEach(a => {
    if(!a.ativo || a.disparado) return;
    const parts = a.hora.split(':');
    if(parts.length < 2) return;
    const ah = parseInt(parts[0],10), am = parseInt(parts[1],10);
    if(isNaN(ah)||isNaN(am)) return;
    // Disparar no minuto exato
    if(hh===ah && mm===am) {
      a.disparado = true;
      showAlarm(a.msg);
      return;
    }
    // Janela de recuperação: até 3 minutos depois
    const diff = (hh*60+mm) - (ah*60+am);
    if(diff > 0 && diff <= 3) {
      a.disparado = true;
      showAlarm(a.msg);
    }
  });
}

function scheduleNextMinute() {
  const now = new Date();
  const msAteProx = (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 100;
  setTimeout(() => { checkAlarms(); scheduleNextMinute(); }, msAteProx);
}

function startAlarmSystem() {
  if(alarmCheckInterval) clearInterval(alarmCheckInterval);
  alarmCheckInterval = setInterval(checkAlarms, 10000);
  scheduleNextMinute();
  checkAlarms();
  console.log('[Alarmes] Sistema iniciado. Total:', ALARMS.length);
}


function showToast(msg){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:20px;right:20px;background:var(--ok);color:white;padding:8px 16px;border-radius:7px;font-size:12px;font-weight:600;z-index:9998;transition:opacity .3s;';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  setTimeout(()=>t.style.opacity='0',2500);
}

// testAlarm já definida acima

// addAlarm já definida acima

// ── DASHBOARD COMPLETA ──
function initDashboard() {
  // Popular select de colaboradoras (só master vê todas)
  const sel = document.getElementById('dash-filtro-pessoa');
  const wrap = document.getElementById('dash-filtro-pessoa-wrap');
  if(!sel) return;
  // Limpar opções existentes exceto "Minha visão"
  while(sel.options.length > 1) sel.remove(1);
  if(role === 'master') {
    if(wrap) wrap.style.display = 'flex';
    const opt0 = document.createElement('option');
    opt0.value = 'todos'; opt0.textContent = 'Todo o time';
    sel.appendChild(opt0);
    USERS.filter(u=>u.nivel==='membro').forEach(u=>{
      const opt = document.createElement('option');
      opt.value = u.email; opt.textContent = u.nome.split(' ')[0];
      sel.appendChild(opt);
    });
  } else {
    if(wrap) wrap.style.display = 'none';
  }
  renderDashboard();
}

function getDashPeriodo() {
  const p = document.getElementById('dash-filtro-periodo')?.value || 'semana';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fim = new Date(); fim.setHours(23,59,59,999);
  let inicio;
  if(p === 'hoje') inicio = new Date(hoje);
  else if(p === 'semana') { inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 7); }
  else if(p === 'mes') { inicio = new Date(hoje); inicio.setDate(1); }
  else inicio = new Date(2020,0,1);
  return {inicio, fim, label: {hoje:'Hoje',semana:'Últimos 7 dias',mes:'Este mês',tudo:'Todo o histórico'}[p]};
}

function getDashPessoa() {
  const v = document.getElementById('dash-filtro-pessoa')?.value || 'eu';
  if(v === 'eu') return {tipo:'eu', email:currentUser.email, nome:currentUser.nome};
  if(v === 'todos') return {tipo:'todos', email:null, nome:'Todo o time'};
  const u = USERS.find(x=>x.email===v);
  return {tipo:'pessoa', email:v, nome:u?u.nome:'—'};
}

function renderDashboard() {
  const content = document.getElementById('dash-content');
  if(!content) return;

  const periodo = getDashPeriodo();
  const pessoa = getDashPessoa();
  const showTarefas = document.getElementById('dash-show-tarefas')?.checked !== false;
  const showPdi = document.getElementById('dash-show-pdi')?.checked !== false;
  const showCanal = document.getElementById('dash-show-canal')?.checked !== false;
  const showFixas = document.getElementById('dash-show-fixas')?.checked !== false;

  // Filtrar tarefas por período e pessoa
  const todasTarefas = window.DASH_TAREFAS || [];
  const tarefasFiltradas = todasTarefas.filter(t => {
    const dCriado = new Date(t.criado_em);
    const noPeriodo = dCriado >= periodo.inicio && dCriado <= periodo.fim;
    if(!noPeriodo) return false;
    if(pessoa.tipo === 'eu') return t.usuario_email === pessoa.email || t.designado_para === pessoa.email;
    if(pessoa.tipo === 'pessoa') return t.usuario_email === pessoa.email || t.designado_para === pessoa.email;
    return true; // todos
  });

  const concluidas = tarefasFiltradas.filter(t=>t.status==='concluida');
  const pendentes = tarefasFiltradas.filter(t=>t.status==='pendente');
  const atrasadas = tarefasFiltradas.filter(t=>t.status!=='concluida' && t.urgencia==='urgente');
  const taxa = tarefasFiltradas.length > 0 ? Math.round((concluidas.length/tarefasFiltradas.length)*100) : 0;

  // Categorias mais usadas
  const catCount = {};
  tarefasFiltradas.forEach(t=>{ catCount[t.categoria]=(catCount[t.categoria]||0)+1; });
  const topCats = Object.entries(catCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // PDI do usuário
  const pdiEmail = pessoa.tipo==='eu'?currentUser.email:pessoa.email;
  const pdiData = pdiEmail ? PDI_DATA[pdiEmail.toLowerCase()] : null;
  const pdiProg = pdiData&&pdiData.objetivos.length>0
    ? Math.round(pdiData.objetivos.reduce((s,o)=>s+o.progresso,0)/pdiData.objetivos.length) : 0;

  let html = '';

  // ── CABEÇALHO ──
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <div>
      <div class="f13 fw6" style="color:var(--text);">${pessoa.nome}</div>
      <div class="f10 cm">${periodo.label}</div>
    </div>
    <div style="background:rgba(0,212,200,.1);border:1px solid var(--cyan);border-radius:8px;padding:6px 16px;text-align:center;">
      <div class="f10 cm">Taxa de conclusão</div>
      <div class="f14 fw6 cc">${taxa}%</div>
    </div>
  </div>`;

  // ── MÉTRICAS RÁPIDAS ──
  html += `<div class="g4 mb12">
    <div class="mc"><div class="ml">Total</div><div class="mv cc">${tarefasFiltradas.length}</div><div class="ms">tarefas</div></div>
    <div class="mc"><div class="ml">Concluídas</div><div class="mv cs">${concluidas.length}</div><div class="ms">${taxa}%</div></div>
    <div class="mc"><div class="ml">Pendentes</div><div class="mv cw">${pendentes.length}</div><div class="ms">em aberto</div></div>
    <div class="mc"><div class="ml">Urgentes</div><div class="mv cd">${atrasadas.length}</div><div class="ms">atenção</div></div>
  </div>`;

  // ── SEÇÃO TAREFAS ──
  if(showTarefas) {
    // Por categoria
    const catBars = topCats.length > 0
      ? topCats.map(([cat,n])=>{
          const pct = Math.round((n/tarefasFiltradas.length)*100);
          return `<div class="mb8">
            <div class="fx jb f11 mb5"><span class="cm">${cat||'Sem categoria'}</span><span style="color:var(--text);">${n} tarefa${n!==1?'s':''} (${pct}%)</span></div>
            <div class="prog"><div class="pf" style="width:${pct}%;background:var(--purple);"></div></div>
          </div>`;
        }).join('')
      : '<div class="f11 cm">Sem dados no período.</div>';

    // Últimas tarefas
    const ultimas = tarefasFiltradas.slice(-5).reverse();
    const ultimasHtml = ultimas.length > 0
      ? ultimas.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
          <div style="width:8px;height:8px;border-radius:50%;background:${t.status==='concluida'?'var(--ok)':t.urgencia==='urgente'?'var(--err)':'var(--warn)'};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;"><div class="f11 fw5" style="color:var(--text);">${t.titulo}</div><div class="f10 cm">${t.categoria||''} ${t.criado_em?'· '+new Date(t.criado_em).toLocaleDateString('pt-BR'):''}</div></div>
          <span class="tag ${t.status==='concluida'?'tag-d':t.urgencia==='urgente'?'tag-u':'tag-n'}">${t.status==='concluida'?'✓ Feita':t.urgencia==='urgente'?'Urgente':'Pendente'}</span>
        </div>`).join('')
      : '<div class="f11 cm">Sem tarefas no período.</div>';

    html += `<div class="g2 gap12 mb12">
      <div class="card"><div class="ct">📊 Por categoria</div>${catBars}</div>
      <div class="card"><div class="ct">📋 Últimas tarefas</div>${ultimasHtml}</div>
    </div>`;
  }

  // ── SEÇÃO PDI ──
  if(showPdi && (pessoa.tipo==='eu'||pessoa.tipo==='pessoa') && pdiData) {
    const objsHtml = pdiData.objetivos.map(o=>`
      <div style="margin-bottom:10px;">
        <div class="fx jb f11 mb5"><span class="fw5" style="color:var(--text);">🎯 ${o.titulo}</span><span style="color:${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};">${o.progresso}%</span></div>
        <div class="prog"><div class="pf" style="width:${o.progresso}%;background:${o.progresso>=75?'var(--ok)':o.progresso>=40?'var(--warn)':'var(--err)'};"></div></div>
        ${o.prazo?'<div class="f10 cdim mt8">Prazo: '+o.prazo+'</div>':''}
      </div>`).join('') || '<div class="f11 cm">Sem objetivos no PDI.</div>';

    html += `<div class="card mb12">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div class="ct" style="margin-bottom:0;">📋 PDI — ${pdiData.nome}</div>
        <div style="text-align:right;"><div class="f10 cm">Progresso geral</div><div class="f14 fw6 cc">${pdiProg}%</div></div>
      </div>
      <div class="prog mb12" style="height:6px;"><div class="pf" style="width:${pdiProg}%;"></div></div>
      ${objsHtml}
    </div>`;
  }

  // ── SEÇÃO DESEMPENHO DO TIME (só master, visão todos) ──
  if(showTarefas && role==='master' && pessoa.tipo==='todos') {
    const timeMembros = USERS.filter(u=>u.nivel==='membro');
    const timeRows = timeMembros.map(u=>{
      const mt = todasTarefas.filter(t=>(t.usuario_email===u.email||t.designado_para===u.email)&&new Date(t.criado_em)>=periodo.inicio);
      const mc = mt.filter(t=>t.status==='concluida').length;
      const mp = mt.filter(t=>t.status==='pendente').length;
      const taxa2 = mt.length>0?Math.round((mc/mt.length)*100):0;
      const init = u.nome.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
      return `<tr>
        <td style="padding:10px 12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;">${init}</div>
            <div><div class="f12 fw5" style="color:var(--text);">${u.nome.split(' ')[0]}</div><div class="f10 cm">${u.cargo}</div></div>
          </div>
        </td>
        <td style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:var(--ok);">${mc}</td>
        <td style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:var(--warn);">${mp}</td>
        <td style="padding:10px 12px;text-align:center;">
          <div style="font-size:12px;font-weight:700;color:${taxa2>=75?'var(--ok)':taxa2>=50?'var(--warn)':'var(--err)'};">${taxa2}%</div>
          <div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;margin-top:4px;"><div style="height:100%;width:${taxa2}%;border-radius:2px;background:${taxa2>=75?'var(--ok)':taxa2>=50?'var(--warn)':'var(--err)'};"></div></div>
        </td>
      </tr>`;
    }).join('');

    html += `<div class="card mb12">
      <div class="ct">👥 Desempenho do time — ${periodo.label}</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--dim);text-transform:uppercase;">Colaboradora</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:var(--dim);text-transform:uppercase;">✅ Feitas</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:var(--dim);text-transform:uppercase;">⏳ Pendentes</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:var(--dim);text-transform:uppercase;">Taxa</th>
          </tr>
        </thead>
        <tbody>${timeRows}</tbody>
      </table>
    </div>`;
  }

  // ── SEÇÃO CANAL CS ──
  if(showCanal) {
    const totalPosts = window.DASH_POSTS ? window.DASH_POSTS.filter(p=>{
      const d = new Date(p.criado_em);
      return d >= periodo.inicio && d <= periodo.fim;
    }).length : 0;
    html += `<div class="card mb12">
      <div class="ct">💬 Canal CS — ${periodo.label}</div>
      <div class="fx ic gap12">
        <div class="mc" style="flex:1;"><div class="ml">Posts publicados</div><div class="mv cc">${totalPosts}</div></div>
        <div class="mc" style="flex:1;"><div class="ml">Engajamento</div><div class="mv cp">—</div><div class="ms">em breve</div></div>
      </div>
    </div>`;
  }

  // ── MENSAGEM SE TUDO DESMARCADO ──
  if(!showTarefas && !showPdi && !showCanal && !showFixas) {
    html = '<div class="f12 cm" style="padding:40px;text-align:center;color:var(--dim);">Selecione pelo menos um item para exibir na dashboard.</div>';
  }

  content.innerHTML = html;
}

// Cache de dados para dashboard
window.DASH_TAREFAS = [];
window.DASH_POSTS = [];


function adicionarCat(){
  const input = document.getElementById('nova-cat');
  if(!input||!input.value.trim()) return;
  const list = document.getElementById('cats-list');
  if(list){
    const span = document.createElement('span');
    span.className='tag tag-p';
    span.textContent=input.value.trim();
    list.appendChild(span);
  }
  input.value='';
}
function trocarSenha(){
  const atual=document.getElementById('pwd-atual').value;
  const nova=document.getElementById('pwd-nova').value;
  const conf=document.getElementById('pwd-conf').value;
  const msg=document.getElementById('pwd-msg');
  if(!atual||!nova||!conf){showPwdMsg('Preencha todos os campos.','var(--warn)');return;}
  const user=USERS.find(u=>u.email.toLowerCase()===currentUser.email.toLowerCase());
  if(!user||user.senha!==atual){showPwdMsg('Senha atual incorreta.','var(--err)');return;}
  if(nova.length<6){showPwdMsg('Nova senha precisa ter no mínimo 6 caracteres.','var(--warn)');return;}
  if(nova!==conf){showPwdMsg('As senhas não coincidem.','var(--err)');return;}
  user.senha=nova;
  currentUser.senha=nova;
  ['pwd-atual','pwd-nova','pwd-conf'].forEach(id=>document.getElementById(id).value='');
  showPwdMsg('Senha alterada com sucesso! ✓','var(--ok)');
}
function showPwdMsg(txt,cor){
  const el=document.getElementById('pwd-msg');
  if(!el)return;
  el.textContent=txt;el.style.color=cor;el.style.display='block';
  setTimeout(()=>el.style.display='none',3500);
}
setTimeout(()=>{renderCadList();renderTimeCS();atualizarSeletores();},100);
