// --- VARIABLES GLOBALES DE ESTADO ---
let dbBuildingsCache = [];
let userResources = { metal: 0, silicio: 0, deuterio: 0 };

// 1. DEFINICIÓN VISUAL
const DATA_VISUAL_EDIFICIOS = [
    { id: 'minaFe', section: 'resources', name: 'Mina de Ferrum', lore: 'Extractor de mineral ferroso.', img: 'img/minaferrum/lv1/lv1.png' },
    { id: 'minaSi', section: 'resources', name: 'Sintetizador de Sílice', lore: 'Procesa arena estelar.', img: 'img/SILICE/sintesili.png' },
    { id: 'minaH3', section: 'resources', name: 'Colector de Isótopo-H3', lore: 'Extrae Deuterio atmosférico.', img: 'img/isotopoh3/ih3recolector.png' },
    { id: 'labInvestigacion', section: 'research', name: 'Laboratorio Alfa', lore: 'Desbloquea nuevas tecnologías.', img: 'img/lab.png' }
];

// 2. CONFIGURACIÓN DE BALANCEO
const STATS_EDIFICIOS = {
    "mina_metal": { costoBase: 100, crecimiento: 1.5, tiempoBase: 10, prodBase: 10 },
    "mina_silicio": { costoBase: 150, crecimiento: 1.6, tiempoBase: 15, prodBase: 5 },
    "mina_deuterio": { costoBase: 200, crecimiento: 1.8, tiempoBase: 30, prodBase: 2 },
    "laboratorio": { costoBase: 500, crecimiento: 2.0, tiempoBase: 60, prodBase: 0 }
};

// --- UTILIDADES ---
function mapBuildingId(gameId) {
    const mapping = {
        'minaFe': 'mina_metal',
        'minaSi': 'mina_silicio',
        'minaH3': 'mina_deuterio',
        'labInvestigacion': 'laboratorio'
    };
    return mapping[gameId] || gameId;
}

async function syncBuildingsFromSupabase() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    const { data } = await supabaseClient.from('buildings').select('*').eq('user_id', user.id);
    dbBuildingsCache = data || [];
}

// --- LÓGICA DE INTERFAZ (UI) ---
function renderList(section) {
    const container = document.getElementById(section + '-list');
    if (!container) return;
    
    let htmlContent = '';
    DATA_VISUAL_EDIFICIOS.filter(b => b.section === section).forEach(b => {
        const dbType = mapBuildingId(b.id);
        const edificioData = dbBuildingsCache.find(db => db.building_type === dbType) || { level: 0 };
        const costoProximo = calcularCosto(dbType, edificioData.level + 1);

        htmlContent += `
            <div class="building-card animate__animated animate__fadeIn" style="background: var(--card-bg); border: 1px solid rgba(0,242,255,0.1); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                <img src="${b.img}" style="width: 100%; border-radius: 8px;" onerror="this.src='https://placehold.co/300x160/0a0b10/00f2ff?text=${b.name}'">
                <div class="building-info">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                        <h3 style="color:var(--neon-blue); font-size:1rem;">${b.name}</h3>
                        <span style="background:rgba(0,242,255,0.1); padding:2px 8px; border-radius:4px; font-size:0.8rem;">LVL ${edificioData.level}</span>
                    </div>
                    <p style="font-size:0.8rem; opacity:0.7; margin: 10px 0;">${b.lore}</p>
                    <button class="nav-btn" id="btn-upgrade-${dbType}" onclick="mejorarEdificio('${b.id}')" style="width:100%; text-align:center;">
                        <i class="fas fa-arrow-up"></i> MEJORAR (${costoProximo} Fe)
                    </button>
                </div>
            </div>`;
    });
    container.innerHTML = htmlContent;
}

function mostrarAnimacionRecursos(idContenedor, cantidad) {
    const el = document.getElementById(idContenedor);
    if (!el) return;
    const span = document.createElement("span");
    span.classList.add("recurso-flotante");
    span.innerText = `+${Math.floor(cantidad)}`;
    el.parentElement.style.position = "relative";
    el.parentElement.appendChild(span);
    setTimeout(() => span.remove(), 2000);
}

// --- LÓGICA DE CÁLCULOS ---
function calcularCosto(type, nivel) {
    const stat = STATS_EDIFICIOS[type] || { costoBase: 100, crecimiento: 1.5 };
    return Math.floor(stat.costoBase * Math.pow(stat.crecimiento, nivel > 0 ? nivel - 1 : 0));
}

function calcularTiempo(type, nivel) {
    const stat = STATS_EDIFICIOS[type] || { tiempoBase: 10 };
    return (nivel || 1) * stat.tiempoBase;
}

function calcularProduccion(type, nivel) {
    const stat = STATS_EDIFICIOS[type] || { prodBase: 0 };
    return (nivel || 0) * stat.prodBase;
}

// --- COMUNICACIÓN SUPABASE (TABLA PLAYERS) ---
async function actualizarRecursosDesdeBD() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Apuntamos a 'players'
    const { data: player } = await supabaseClient.from('players').select('*').eq('id', user.id).single();
    
    if (player) {
        let plusMetal = 0, plusSilicio = 0, plusDeuterio = 0;
        dbBuildingsCache.forEach(ed => {
            if (ed.building_type === "mina_metal") plusMetal = calcularProduccion(ed.building_type, ed.level);
            if (ed.building_type === "mina_silicio") plusSilicio = calcularProduccion(ed.building_type, ed.level);
            if (ed.building_type === "mina_deuterio") plusDeuterio = calcularProduccion(ed.building_type, ed.level);
        });

        const nuevosRecursos = {
            metal: player.metal + plusMetal,
            silicio: player.silicio + plusSilicio, // Usamos 'silicio' con O
            deuterio: player.deuterio + plusDeuterio
        };

        await supabaseClient.from('players').update(nuevosRecursos).eq('id', user.id);
        
        if (plusMetal > 0) mostrarAnimacionRecursos('res-metal', plusMetal);
        
        userResources = nuevosRecursos;
        document.getElementById('res-metal').innerText = Math.floor(nuevosRecursos.metal);
        document.getElementById('res-silice').innerText = Math.floor(nuevosRecursos.silicio);
        document.getElementById('res-deuterio').innerText = Math.floor(nuevosRecursos.deuterio);
    }
}

async function mejorarEdificio(gameId) {
    const dbType = mapBuildingId(gameId);
    const { data: { user } } = await supabaseClient.auth.getUser();
    const edificioData = dbBuildingsCache.find(db => db.building_type === dbType) || { level: 0 };
    
    const costo = calcularCosto(dbType, edificioData.level + 1);
    const tiempo = calcularTiempo(dbType, edificioData.level + 1);
    const btn = document.getElementById(`btn-upgrade-${dbType}`);

    if (userResources.metal < costo) {
        btn.style.borderColor = "red";
        setTimeout(() => btn.style.borderColor = "", 500);
        return alert("Recursos insuficientes.");
    }

    btn.disabled = true;
    // Descontamos de 'players'
    await supabaseClient.from('players').update({ metal: userResources.metal - costo }).eq('id', user.id);

    let restante = tiempo;
    const timer = setInterval(() => {
        btn.innerHTML = `<i class="fas fa-hourglass-half"></i> ${restante}s`;
        restante--;
        if (restante < 0) {
            clearInterval(timer);
            finalizarMejora(user.id, dbType, edificioData.level + 1);
        }
    }, 1000);
}

async function finalizarMejora(userId, dbType, nuevoNivel) {
    await supabaseClient.from('buildings').upsert({ 
        user_id: userId, building_type: dbType, level: nuevoNivel 
    }, { onConflict: 'user_id, building_type' });

    await syncBuildingsFromSupabase();
    renderList('resources');
    renderList('research');
}

function loadChatRealtime() { console.log("Chat inicializado..."); }
