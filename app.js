// ==========================================
// CONFIGURACIÓN DE CONEXIÓN A SUPABASE
// ==========================================
const SUPABASE_URL = 'https://xdhvdjitiuazdsfjkyvk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkaHZkaml0aXVhemRzZmpreXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NjE4NDksImV4cCI6MjExMTAzNzg0OX0.U0wnB39je724nWXIOMfqhxuSJgst-CXnzoM1Q2NUoLQ';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
const INSTANCIAS_PLAYOFFS = [
  { key: 'octavos',       label: 'Octavos de Final',             max: 16, pts: 2 },
  { key: 'cuartos',       label: 'Cuartos de Final',             max: 8,  pts: 4 },
  { key: 'semis',         label: 'Semifinales',                  max: 4,  pts: 7 },
  { key: 'final',         label: 'Finalistas (Juegan el Oro)',   max: 2,  pts: 10 },
  { key: 'campeon',       label: 'Campeón del Mundo (1°)',       max: 1,  pts: 15 },
  { key: 'tercero',       label: '3° Puesto (Bronce)',           max: 1,  pts: 8 },
  { key: 'quinto',        label: '5° Puesto (Placement 5°–8°)',  max: 1,  pts: 6 },
  { key: 'noveno',        label: '9° Puesto (Placement 9°–16°)', max: 1,  pts: 5 },
  { key: 'decimoseptimo', label: '17° Puesto (Placement 17°+)',  max: 1,  pts: 5 }
];

let state = {
  config: {},
  cierreDate: null,
  isClosed: false,
  categorias: [],
  equipos: {},
  equiposCategorias: [],
  partidos: [],
  resultadosPlayoffs: [],
  user: null,
  boletas: [],
  activeBoletaId: null,
  activePelota: 'FOAM',
  activeCategoriaId: 'foam_mens',
  activeSubTab: 'grupos',
  myGroupPicks: {},
  myPlayoffPicks: [],
  leaderboard: [],
  onlyPaidFilter: true,
  adminPin: null,
  adminTab: 'pagos',
  adminCatFilter: 'foam_mens'
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (SUPABASE_URL.includes('TU-PROYECTO') || SUPABASE_ANON_KEY.includes('TU-CLAVE')) {
    const errEl = document.getElementById('auth-error');
    if (errEl) {
      errEl.textContent = 'Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en el archivo app.js de GitHub.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  await loadBaseData();
  startCountdown();

  const savedUser = localStorage.getItem('prode_user');
  if (savedUser) {
    state.user = JSON.parse(savedUser);
    await initPlayerSession();
  }
  await loadLeaderboard();
});

async function loadBaseData() {
  const [cfgRes, catRes, eqRes, eqCatRes, partRes, resPoRes] = await Promise.all([
    sb.from('config').select('*'),
    sb.from('categorias').select('*').order('orden'),
    sb.from('equipos').select('*'),
    sb.from('equipos_categorias').select('*'),
    sb.from('partidos').select('*').order('fecha_hora'),
    sb.from('resultados_playoffs').select('*')
  ]);

  (cfgRes.data || []).forEach(r => state.config[r.clave] = r.valor);
  if (state.config.torneo_nombre) {
    document.getElementById('torneo-titulo').textContent = state.config.torneo_nombre;
  }
  if (state.config.alias_pago) {
    document.getElementById('alias-text').textContent = state.config.alias_pago;
  }
  if (state.config.logo_url) {
    const logoEl = document.getElementById('torneo-logo');
    logoEl.src = state.config.logo_url;
    logoEl.style.display = 'block';
  }
  if (state.config.cierre_prode) {
    state.cierreDate = new Date(state.config.cierre_prode);
    state.isClosed = new Date() >= state.cierreDate;
  }

  state.categorias = catRes.data || [];
  (eqRes.data || []).forEach(e => state.equipos[e.id] = e);
  state.equiposCategorias = eqCatRes.data || [];
  state.partidos = partRes.data || [];
  state.resultadosPlayoffs = resPoRes.data || [];
}

function startCountdown() {
  const timerEl = document.getElementById('countdown-timer');
  const labelEl = document.getElementById('countdown-label');

  const tick = () => {
    if (!state.cierreDate) return;
    const diff = state.cierreDate - new Date();
    if (diff <= 0) {
      state.isClosed = true;
      labelEl.textContent = 'Estado:';
      timerEl.textContent = 'PRODE CERRADO';
      timerEl.className = 'text-sm font-bold text-rose-400';
      return;
    }
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    timerEl.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };
  tick();
  setInterval(tick, 1000);
}

// ==========================================
// NAVEGACIÓN ENTRE VISTAS
// ==========================================
function switchTab(tab) {
  ['pronosticos', 'tabla', 'reglas', 'admin'].forEach(t => {
    document.getElementById(`view-${t}`).classList.toggle('hidden', t !== tab);
    const btn = document.getElementById(`nav-${t}`);
    if (t === tab) {
      btn.classList.add('border-amber-400', 'text-amber-400');
      btn.classList.remove('border-transparent', 'text-slate-400');
    } else {
      btn.classList.remove('border-amber-400', 'text-amber-400');
      btn.classList.add('border-transparent', 'text-slate-400');
    }
  });
  if (tab === 'tabla') loadLeaderboard();
}

// ==========================================
// AUTENTICACIÓN (INGRESAR VS REGISTRARME)
// ==========================================
function switchAuthMode(mode) {
  const isLogin = mode === 'login';
  document.getElementById('auth-error').classList.add('hidden');

  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-register').classList.toggle('hidden', isLogin);

  const tabLogin = document.getElementById('authtab-login');
  const tabReg = document.getElementById('authtab-register');

  if (isLogin) {
    tabLogin.className = 'py-3.5 text-sm font-bold text-amber-400 border-b-2 border-amber-400 bg-slate-900 transition';
    tabReg.className = 'py-3.5 text-sm font-bold text-slate-400 border-b-2 border-transparent hover:text-white transition';
  } else {
    tabReg.className = 'py-3.5 text-sm font-bold text-emerald-400 border-b-2 border-emerald-400 bg-slate-900 transition';
    tabLogin.className = 'py-3.5 text-sm font-bold text-slate-400 border-b-2 border-transparent hover:text-white transition';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const origText = btn.textContent;
  const email = document.getElementById('login-email').value;
  const pin = document.getElementById('login-pin').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  try {
    const { data, error } = await sb.rpc('login_participante', {
      p_email: email,
      p_pin: pin
    });

    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('No se recibió respuesta del servidor.');

    state.user = data[0];
    localStorage.setItem('prode_user', JSON.stringify(state.user));
    await initPlayerSession();
  } catch (err) {
    errEl.textContent = err.message || 'No se pudo iniciar sesión. Verificá tus datos.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const origText = btn.textContent;
  const nombre = document.getElementById('reg-nombre').value;
  const email = document.getElementById('reg-email').value;
  const pin = document.getElementById('reg-pin').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  btn.disabled = true;
  btn.textContent = 'Creando cuenta...';

  try {
    const { data, error } = await sb.rpc('registrar_participante', {
      p_email: email,
      p_nombre: nombre,
      p_pin: pin
    });

    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('No se recibió respuesta del servidor.');

    state.user = data[0];
    localStorage.setItem('prode_user', JSON.stringify(state.user));
    await initPlayerSession();
  } catch (err) {
    errEl.textContent = err.message || 'No se pudo completar el registro.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function handleLogout() {
  localStorage.removeItem('prode_user');
  state.user = null;
  state.boletas = [];
  state.activeBoletaId = null;
  document.getElementById('auth-box').classList.remove('hidden');
  document.getElementById('player-panel').classList.add('hidden');
}

async function initPlayerSession() {
  document.getElementById('auth-box').classList.add('hidden');
  document.getElementById('player-panel').classList.remove('hidden');
  document.getElementById('user-display-name').textContent = state.user.nombre_mostrar;

  await loadUserBoletas();
  renderRamaTabs();
}

async function loadUserBoletas() {
  const { data } = await sb
    .from('boletas')
    .select('*')
    .eq('participante_id', state.user.id)
    .order('created_at');

  state.boletas = data || [];

  if (state.boletas.length === 0 && !state.isClosed) {
    const { data: nueva } = await sb
      .from('boletas')
      .insert({ participante_id: state.user.id, nombre_boleta: 'Boleta #1' })
      .select()
      .single();
    if (nueva) state.boletas = [nueva];
  }

  const sel = document.getElementById('boleta-selector');
  sel.innerHTML = state.boletas
    .map(b => `<option value="${b.id}">${b.nombre_boleta} ${b.pagada ? '(Pagada ✓)' : '(Pendiente)'}</option>`)
    .join('');

  if (state.boletas.length > 0) {
    const targetId = state.activeBoletaId || state.boletas[0].id;
    await selectBoleta(targetId);
  }
}

async function crearNuevaBoleta() {
  if (state.isClosed) return alert('El tiempo de carga ya cerró.');
  const num = state.boletas.length + 1;
  const nombre = prompt('Nombre para esta nueva boleta:', `Boleta #${num}`);
  if (!nombre) return;

  const { data, error } = await sb
    .from('boletas')
    .insert({ participante_id: state.user.id, nombre_boleta: nombre.trim() })
    .select()
    .single();

  if (error) return alert('No se pudo crear la boleta: ' + error.message);
  state.activeBoletaId = data.id;
  await loadUserBoletas();
}

async function selectBoleta(boletaId) {
  state.activeBoletaId = boletaId;
  document.getElementById('boleta-selector').value = boletaId;

  const boleta = state.boletas.find(b => b.id === boletaId);
  const badge = document.getElementById('boleta-pago-badge');
  if (boleta?.pagada) {
    badge.textContent = 'Confirmada ✓';
    badge.className = 'inline-block mt-0.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
  } else {
    badge.textContent = 'Pendiente de pago';
    badge.className = 'inline-block mt-0.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40';
  }

  await loadBoletaPicks(boletaId);
  renderActiveCategoryContent();
}

async function loadBoletaPicks(boletaId) {
  const tablaGrupos = state.isClosed ? 'vista_pronosticos_publicos' : 'pronosticos_partidos';
  const tablaPlayoffs = state.isClosed ? 'vista_playoffs_publicos' : 'pronosticos_playoffs';

  const [gRes, pRes] = await Promise.all([
    sb.from(tablaGrupos).select('*').eq('boleta_id', boletaId),
    sb.from(tablaPlayoffs).select('*').eq('boleta_id', boletaId)
  ]);

  state.myGroupPicks = {};
  (gRes.data || []).forEach(r => {
    state.myGroupPicks[r.partido_id] = { pred_local: r.pred_local, pred_visitante: r.pred_visitante };
  });
  state.myPlayoffPicks = pRes.data || [];
}

function copiarAlias() {
  const alias = document.getElementById('alias-text').textContent;
  navigator.clipboard.writeText(alias);
  showToast('Alias copiado ✓');
}

function showToast(msg = 'Guardado ✓') {
  const el = document.getElementById('save-toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
}

// ==========================================
// SELECTORES DE PELOTA, RAMA Y SUB-TABS
// ==========================================
function selectPelota(pelota) {
  state.activePelota = pelota;
  ['FOAM', 'CLOTH'].forEach(p => {
    const btn = document.getElementById(`pelota-${p}`);
    if (p === pelota) {
      btn.className = 'flex-1 py-2.5 rounded-xl font-extrabold text-sm tracking-wide border transition bg-amber-500 text-slate-950 border-amber-400';
    } else {
      btn.className = 'flex-1 py-2.5 rounded-xl font-extrabold text-sm tracking-wide border transition bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700';
    }
  });

  const firstCat = state.categorias.find(c => c.pelota === pelota);
  if (firstCat) state.activeCategoriaId = firstCat.id;
  renderRamaTabs();
  renderActiveCategoryContent();
}

function renderRamaTabs() {
  const cats = state.categorias.filter(c => c.pelota === state.activePelota);
  const container = document.getElementById('rama-tabs');
  container.innerHTML = cats.map(c => {
    const active = c.id === state.activeCategoriaId;
    return `
      <button onclick="selectCategoria('${c.id}')"
        class="py-2 px-3 rounded-xl text-xs sm:text-sm font-bold border transition ${
          active
            ? 'bg-slate-800 text-amber-400 border-amber-400/60'
            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
        }">
        ${c.rama}
      </button>
    `;
  }).join('');
}

function selectCategoria(catId) {
  state.activeCategoriaId = catId;
  renderRamaTabs();
  renderActiveCategoryContent();
}

function selectSubTab(sub) {
  state.activeSubTab = sub;
  document.getElementById('grupos-container').classList.toggle('hidden', sub !== 'grupos');
  document.getElementById('playoffs-container').classList.toggle('hidden', sub !== 'playoffs');

  document.getElementById('subtab-grupos').className = sub === 'grupos'
    ? 'flex-1 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white transition'
    : 'flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-white transition';
  document.getElementById('subtab-playoffs').className = sub === 'playoffs'
    ? 'flex-1 py-2 text-sm font-bold rounded-lg bg-slate-800 text-white transition'
    : 'flex-1 py-2 text-sm font-bold rounded-lg text-slate-400 hover:text-white transition';
}

function renderActiveCategoryContent() {
  renderGrupos();
  renderPlayoffs();
}

function flagImg(equipoId) {
  const eq = state.equipos[equipoId];
  if (!eq || !eq.codigo_iso) return '';
  return `<img src="https://flagcdn.com/w40/${eq.codigo_iso.toLowerCase()}.png" alt="${eq.id}" class="w-6 h-4 object-cover rounded-sm inline-block shrink-0" />`;
}

// ==========================================
// RENDER FASE DE GRUPOS Y AUTO-GUARDADO
// ==========================================
function renderGrupos() {
  const container = document.getElementById('grupos-container');
  const matches = state.partidos.filter(p => p.categoria_id === state.activeCategoriaId);

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
        Todavía no se cargaron los partidos de fase de grupos para esta categoría.
      </div>`;
    return;
  }

  const byGroup = {};
  matches.forEach(m => {
    if (!byGroup[m.grupo]) byGroup[m.grupo] = [];
    byGroup[m.grupo].push(m);
  });

  container.innerHTML = Object.entries(byGroup).map(([grupo, list]) => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div class="bg-slate-800/70 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
        <h3 class="font-bold text-sm text-amber-400 uppercase tracking-wider">${grupo}</h3>
        <span class="text-xs text-slate-400">${list.length} partidos</span>
      </div>
      <div class="divide-y divide-slate-800/80">
        ${list.map(m => renderMatchRow(m)).join('')}
      </div>
    </div>
  `).join('');
}

function renderMatchRow(m) {
  const loc = state.equipos[m.equipo_local_id] || { id: m.equipo_local_id, nombre: m.equipo_local_id };
  const vis = state.equipos[m.equipo_visitante_id] || { id: m.equipo_visitante_id, nombre: m.equipo_visitante_id };
  const pick = state.myGroupPicks[m.id] || { pred_local: '', pred_visitante: '' };
  const fechaLocal = new Date(m.fecha_hora).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  const isArg = m.equipo_local_id === 'ARG' || m.equipo_visitante_id === 'ARG';
  const disabled = state.isClosed ? 'disabled' : '';

  return `
    <div class="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isArg ? 'bg-sky-950/20' : ''}">
      <div class="flex items-center justify-between sm:justify-start gap-2 text-xs text-slate-400">
        <span>${fechaLocal} hs</span>
        ${isArg ? '<span class="bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded font-bold text-[10px]">ARG +2 PTS</span>' : ''}
        ${m.finalizado ? `<span class="bg-slate-800 text-slate-200 px-2 py-0.5 rounded font-mono font-bold">Real: ${m.sets_local}-${m.sets_visitante}</span>` : ''}
      </div>

      <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
        <div class="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
          <span class="font-semibold text-sm text-white truncate max-w-[110px] sm:max-w-[140px]">${loc.nombre}</span>
          ${flagImg(loc.id)}
        </div>

        <div class="flex items-center gap-1.5">
          <input type="number" min="0" max="50" ${disabled}
            id="pred-loc-${m.id}"
            value="${pick.pred_local}"
            onchange="saveMatchPick(${m.id})"
            placeholder="-"
            class="w-12 h-10 text-center font-mono font-bold text-base bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400 disabled:opacity-60" />
          <span class="text-slate-500 font-bold">:</span>
          <input type="number" min="0" max="50" ${disabled}
            id="pred-vis-${m.id}"
            value="${pick.pred_visitante}"
            onchange="saveMatchPick(${m.id})"
            placeholder="-"
            class="w-12 h-10 text-center font-mono font-bold text-base bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-400 disabled:opacity-60" />
        </div>

        <div class="flex items-center gap-2 flex-1 sm:flex-initial justify-start">
          ${flagImg(vis.id)}
          <span class="font-semibold text-sm text-white truncate max-w-[110px] sm:max-w-[140px]">${vis.nombre}</span>
        </div>
      </div>
    </div>
  `;
}

async function saveMatchPick(partidoId) {
  if (state.isClosed || !state.activeBoletaId) return;
  const locVal = document.getElementById(`pred-loc-${partidoId}`).value;
  const visVal = document.getElementById(`pred-vis-${partidoId}`).value;

  if (locVal === '' || visVal === '') return;
  const pred_local = parseInt(locVal, 10);
  const pred_visitante = parseInt(visVal, 10);
  if (isNaN(pred_local) || isNaN(pred_visitante) || pred_local < 0 || pred_visitante < 0) return;

  state.myGroupPicks[partidoId] = { pred_local, pred_visitante };

  const { error } = await sb.from('pronosticos_partidos').upsert({
    boleta_id: state.activeBoletaId,
    partido_id: partidoId,
    pred_local,
    pred_visitante,
    updated_at: new Date().toISOString()
  }, { onConflict: 'boleta_id,partido_id' });

  if (!error) showToast('Guardado ✓');
}

// ==========================================
// RENDER PLAYOFFS Y PLACEMENTS
// ==========================================
function renderPlayoffs() {
  const container = document.getElementById('playoffs-container');
  const catTeamsIds = state.equiposCategorias
    .filter(ec => ec.categoria_id === state.activeCategoriaId)
    .map(ec => ec.equipo_id);

  if (catTeamsIds.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
        Todavía no se cargaron las selecciones participantes para esta categoría.
      </div>`;
    return;
  }

  const teams = catTeamsIds
    .map(id => state.equipos[id] || { id, nombre: id })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  container.innerHTML = INSTANCIAS_PLAYOFFS.map(inst => {
    const selected = state.myPlayoffPicks
      .filter(p => p.categoria_id === state.activeCategoriaId && p.instancia === inst.key)
      .map(p => p.equipo_id);

    const complete = selected.length === inst.max;

    return `
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-white text-sm sm:text-base">${inst.label}</h3>
            <span class="text-xs text-amber-400 font-semibold">${inst.pts} pts por acierto</span>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full ${
            complete
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }">
            ${selected.length} / ${inst.max} elegidos
          </span>
        </div>

        <div class="flex flex-wrap gap-2">
          ${teams.map(t => {
            const isSel = selected.includes(t.id);
            return `
              <button onclick="togglePlayoffPick('${inst.key}', '${t.id}', ${inst.max})"
                ${state.isClosed ? 'disabled' : ''}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isSel
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                } disabled:opacity-60">
                ${flagImg(t.id)}
                <span>${t.nombre}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function togglePlayoffPick(instancia, equipoId, maxAllowed) {
  if (state.isClosed || !state.activeBoletaId) return;

  const existingIdx = state.myPlayoffPicks.findIndex(
    p => p.categoria_id === state.activeCategoriaId && p.instancia === instancia && p.equipo_id === equipoId
  );

  if (existingIdx >= 0) {
    state.myPlayoffPicks.splice(existingIdx, 1);
    renderPlayoffs();
    const { error } = await sb
      .from('pronosticos_playoffs')
      .delete()
      .match({
        boleta_id: state.activeBoletaId,
        categoria_id: state.activeCategoriaId,
        instancia,
        equipo_id: equipoId
      });
    if (!error) showToast('Guardado ✓');
  } else {
    const currentCount = state.myPlayoffPicks.filter(
      p => p.categoria_id === state.activeCategoriaId && p.instancia === instancia
    ).length;

    if (currentCount >= maxAllowed) {
      return alert(`Ya elegiste el máximo permitido (${maxAllowed}) para esta instancia. Desmarcá uno primero.`);
    }

    state.myPlayoffPicks.push({
      boleta_id: state.activeBoletaId,
      categoria_id: state.activeCategoriaId,
      instancia,
      equipo_id: equipoId
    });
    renderPlayoffs();

    const { error } = await sb.from('pronosticos_playoffs').insert({
      boleta_id: state.activeBoletaId,
      categoria_id: state.activeCategoriaId,
      instancia,
      equipo_id: equipoId
    });
    if (!error) showToast('Guardado ✓');
  }
}

// ==========================================
// TABLA DE POSICIONES EN VIVO Y MODO ESPÍA
// ==========================================
async function loadLeaderboard() {
  const { data } = await sb.from('tabla_posiciones').select('*');
  state.leaderboard = data || [];
  renderLeaderboard();
}

function toggleFiltroPagas(onlyPaid) {
  state.onlyPaidFilter = onlyPaid;
  document.getElementById('filter-pagas').className = onlyPaid
    ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
    : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700';
  document.getElementById('filter-todas').className = !onlyPaid
    ? 'px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40'
    : 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700';
  renderLeaderboard();
}

function renderLeaderboard() {
  const tbody = document.getElementById('tabla-body');
  const rows = state.onlyPaidFilter
    ? state.leaderboard.filter(r => r.pagada)
    : state.leaderboard;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No hay boletas para mostrar en esta vista.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r, idx) => `
    <tr onclick="openSpyModal('${r.boleta_id}')" class="hover:bg-slate-800/60 cursor-pointer transition">
      <td class="py-3 px-3 font-mono font-bold text-slate-400">${idx + 1}</td>
      <td class="py-3 px-3">
        <div class="font-bold text-white">${r.participante}</div>
        <div class="text-xs text-slate-400 flex items-center gap-1.5">
          <span>${r.nombre_boleta}</span>
          ${r.pagada
            ? '<span class="text-[10px] text-emerald-400 font-bold">● PAGA</span>'
            : '<span class="text-[10px] text-amber-400 font-bold">● PENDIENTE</span>'}
        </div>
      </td>
      <td class="py-3 px-3 text-center font-mono font-extrabold text-base text-amber-400">${r.puntos_totales}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-300">${r.puntos_grupos}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-300">${r.puntos_playoffs}</td>
      <td class="py-3 px-3 text-center font-mono text-emerald-400">${r.plenos}</td>
      <td class="py-3 px-3 text-center font-mono text-sky-400">${r.campeones_acertados}</td>
    </tr>
  `).join('');
}

async function openSpyModal(boletaId) {
  const row = state.leaderboard.find(r => r.boleta_id === boletaId);
  if (!row) return;

  const modal = document.getElementById('spy-modal');
  const title = document.getElementById('spy-modal-title');
  const subtitle = document.getElementById('spy-modal-subtitle');
  const body = document.getElementById('spy-modal-body');

  title.textContent = `${row.participante} — ${row.nombre_boleta}`;
  subtitle.textContent = `Total: ${row.puntos_totales} pts (${row.puntos_grupos} grupos / ${row.puntos_playoffs} playoffs)`;
  modal.classList.remove('hidden');

  if (!state.isClosed) {
    body.innerHTML = `
      <div class="bg-slate-800/80 border border-slate-700 rounded-xl p-6 text-center space-y-2">
        <p class="text-amber-400 font-bold text-base">Pronósticos ocultos hasta el cierre</p>
        <p class="text-slate-400 text-xs">Por seguridad, las jugadas de los demás participantes se desbloquean automáticamente cuando arranque el Mundial.</p>
      </div>`;
    return;
  }

  body.innerHTML = `<p class="text-center text-slate-400 py-6">Cargando pronósticos...</p>`;

  const [gRes, pRes] = await Promise.all([
    sb.from('vista_pronosticos_publicos').select('*').eq('boleta_id', boletaId),
    sb.from('vista_playoffs_publicos').select('*').eq('boleta_id', boletaId)
  ]);

  const gPicks = gRes.data || [];
  const pPicks = pRes.data || [];

  const campeonesHtml = pPicks
    .filter(p => p.instancia === 'campeon')
    .map(p => {
      const cat = state.categorias.find(c => c.id === p.categoria_id);
      const eq = state.equipos[p.equipo_id];
      return `<div class="flex justify-between py-1 border-b border-slate-800">
        <span class="text-slate-400">${cat?.nombre || p.categoria_id}</span>
        <strong class="text-amber-400">${eq?.nombre || p.equipo_id}</strong>
      </div>`;
    }).join('') || '<p class="text-slate-500 text-xs">Sin campeones elegidos.</p>';

  const partidosHtml = gPicks.map(gp => {
    const m = state.partidos.find(x => x.id === gp.partido_id);
    if (!m) return '';
    return `<div class="flex items-center justify-between py-1.5 border-b border-slate-800/70 text-xs">
      <span class="text-slate-300">${m.equipo_local_id} vs ${m.equipo_visitante_id} <span class="text-slate-500">(${m.categoria_id})</span></span>
      <div class="font-mono">
        <span class="text-white font-bold">Pron: ${gp.pred_local}-${gp.pred_visitante}</span>
        ${m.finalizado ? `<span class="text-slate-400 ml-2">Real: ${m.sets_local}-${m.sets_visitante}</span>` : ''}
      </div>
    </div>`;
  }).join('') || '<p class="text-slate-500 text-xs">Sin partidos cargados.</p>';

  body.innerHTML = `
    <div>
      <h4 class="font-bold text-white mb-2">Campeones pronosticados</h4>
      <div class="bg-slate-800/50 rounded-xl p-3">${campeonesHtml}</div>
    </div>
    <div>
      <h4 class="font-bold text-white mb-2">Pronósticos de Grupos (${gPicks.length})</h4>
      <div class="bg-slate-800/50 rounded-xl p-3 max-h-64 overflow-y-auto">${partidosHtml}</div>
    </div>
  `;
}

function closeSpyModal() {
  document.getElementById('spy-modal').classList.add('hidden');
}

// ==========================================
// PANEL DE ADMINISTRACIÓN
// ==========================================
function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('admin-pin-input').value.trim();
  if (!pin) return;
  state.adminPin = pin;
  document.getElementById('admin-login-box').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.remove('hidden');
  switchAdminTab('pagos');
}

async function switchAdminTab(tab) {
  state.adminTab = tab;
  ['pagos', 'resultados', 'playoffs'].forEach(t => {
    const btn = document.getElementById(`admtab-${t}`);
    btn.className = t === tab
      ? 'px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 text-slate-950'
      : 'px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-slate-800';
  });

  if (tab === 'pagos') await renderAdminPagos();
  if (tab === 'resultados') await renderAdminResultados();
  if (tab === 'playoffs') await renderAdminPlayoffs();
}

async function renderAdminPagos() {
  const container = document.getElementById('admin-content');
  const { data } = await sb
    .from('boletas')
    .select('id, nombre_boleta, pagada, created_at, participantes(nombre_mostrar, email)')
    .order('created_at', { ascending: false });

  const list = data || [];
  container.innerHTML = `
    <h3 class="font-bold text-white mb-3">Boletas registradas (${list.length})</h3>
    <div class="divide-y divide-slate-800">
      ${list.map(b => `
        <div class="py-3 flex items-center justify-between gap-3">
          <div>
            <div class="font-bold text-sm text-white">${b.participantes?.nombre_mostrar} — ${b.nombre_boleta}</div>
            <div class="text-xs text-slate-400">${b.participantes?.email}</div>
          </div>
          <button onclick="adminTogglePago('${b.id}', ${!b.pagada})"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              b.pagada
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-amber-400 border border-amber-500/40'
            }">
            ${b.pagada ? 'Pagada ✓' : 'Marcar Pagada'}
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

async function adminTogglePago(boletaId, nuevoEstado) {
  const { error } = await sb.rpc('admin_toggle_pago', {
    p_admin_pin: state.adminPin,
    p_boleta_id: boletaId,
    p_pagada: nuevoEstado
  });
  if (error) return alert(error.message);
  showToast('Pago actualizado ✓');
  await renderAdminPagos();
}

async function renderAdminResultados() {
  const container = document.getElementById('admin-content');
  const matches = state.partidos.filter(p => p.categoria_id === state.adminCatFilter);

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h3 class="font-bold text-white">Cargar Resultados Reales</h3>
      <select onchange="state.adminCatFilter = this.value; renderAdminResultados()"
        class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white">
        ${state.categorias.map(c => `<option value="${c.id}" ${c.id === state.adminCatFilter ? 'selected' : ''}>${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="divide-y divide-slate-800">
      ${matches.map(m => `
        <div class="py-3 flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-white">
            <span class="text-xs text-slate-400 mr-2">[${m.grupo}]</span>
            ${m.equipo_local_id} vs ${m.equipo_visitante_id}
          </div>
          <div class="flex items-center gap-2">
            <input type="number" id="adm-loc-${m.id}" value="${m.sets_local ?? ''}" placeholder="L"
              class="w-12 h-9 text-center bg-slate-800 border border-slate-700 rounded text-white font-mono" />
            <span>-</span>
            <input type="number" id="adm-vis-${m.id}" value="${m.sets_visitante ?? ''}" placeholder="V"
              class="w-12 h-9 text-center bg-slate-800 border border-slate-700 rounded text-white font-mono" />
            <label class="flex items-center gap-1 text-xs text-slate-300 ml-1">
              <input type="checkbox" id="adm-fin-${m.id}" ${m.finalizado ? 'checked' : ''} /> Fin
            </label>
            <button onclick="adminSaveMatch(${m.id})" class="bg-amber-500 text-slate-950 font-bold text-xs px-3 py-2 rounded-lg">
              Guardar
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function adminSaveMatch(partidoId) {
  const loc = parseInt(document.getElementById(`adm-loc-${partidoId}`).value, 10);
  const vis = parseInt(document.getElementById(`adm-vis-${partidoId}`).value, 10);
  const fin = document.getElementById(`adm-fin-${partidoId}`).checked;

  const { error } = await sb.rpc('admin_guardar_resultado', {
    p_admin_pin: state.adminPin,
    p_partido_id: partidoId,
    p_local: isNaN(loc) ? null : loc,
    p_visitante: isNaN(vis) ? null : vis,
    p_finalizado: fin
  });
  if (error) return alert(error.message);

  await loadBaseData();
  showToast('Resultado guardado ✓');
}

async function renderAdminPlayoffs() {
  const container = document.getElementById('admin-content');
  const teamsIds = state.equiposCategorias
    .filter(ec => ec.categoria_id === state.adminCatFilter)
    .map(ec => ec.equipo_id);

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h3 class="font-bold text-white">Clasificados Reales de Playoffs</h3>
      <select onchange="state.adminCatFilter = this.value; renderAdminPlayoffs()"
        class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white">
        ${state.categorias.map(c => `<option value="${c.id}" ${c.id === state.adminCatFilter ? 'selected' : ''}>${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="space-y-4">
      ${INSTANCIAS_PLAYOFFS.map(inst => {
        const activeTeams = state.resultadosPlayoffs
          .filter(r => r.categoria_id === state.adminCatFilter && r.instancia === inst.key)
          .map(r => r.equipo_id);

        return `
          <div class="border border-slate-800 rounded-xl p-3">
            <div class="text-xs font-bold text-amber-400 uppercase mb-2">${inst.label} (${activeTeams.length}/${inst.max})</div>
            <div class="flex flex-wrap gap-1.5">
              ${teamsIds.map(eqId => {
                const isOn = activeTeams.includes(eqId);
                return `
                  <button onclick="adminTogglePlayoff('${inst.key}', '${eqId}', ${!isOn})"
                    class="px-2.5 py-1 rounded text-xs font-bold border ${
                      isOn ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }">
                    ${eqId}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function adminTogglePlayoff(instancia, equipoId, activo) {
  const { error } = await sb.rpc('admin_toggle_playoff', {
    p_admin_pin: state.adminPin,
    p_categoria_id: state.adminCatFilter,
    p_instancia: instancia,
    p_equipo_id: equipoId,
    p_activo: activo
  });
  if (error) return alert(error.message);

  await loadBaseData();
  showToast('Playoff actualizado ✓');
  await renderAdminPlayoffs();
}
