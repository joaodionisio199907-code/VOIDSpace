// game.js - Comando Central de VOID ECHOS

// 1. DEFINICIÓN VISUAL (Lo que se ve en las tarjetas)
const DATA_VISUAL_EDIFICIOS = [
    { id: 'minaFe', section: 'resources', name: 'Mina de Ferrum', lore: 'Extractor de mineral ferroso para estructuras.', img: 'img/minaferrum/lv1/lv1.png' },
    { id: 'minaSi', section: 'resources', name: 'Sintetizador de Sílice', lore: 'Procesa arena estelar para componentes electrónicos.', img: 'img/SILICE/sintesili.png' },
    { id: 'minaH3', section: 'resources', name: 'Colector de Isótopo-H3', lore: 'Extrae Deuterio atmosférico para combustible.', img: 'img/isotopoh3/ih3recolector.png' }
];

// 2. CONFIGURACIÓN DE BALANCEO (Dificultad y Producción)
const STATS_EDIFICIOS = {
    "mina_metal": {
        costoBase: 100,
        crecimiento: 1.5, // 1.5 significa que el costo sube un 50% por nivel
        tiempoBase: 10,  // Segundos extra por nivel
        prodBase: 10     // Metal producido cada 8 segundos por nivel
    },
    "mina_silicio": {
        costoBase: 150,
        crecimiento: 1.6,
        tiempoBase: 15,
        prodBase: 5
    },
    "mina_deuterio": {
        costoBase: 200,
        crecimiento: 1.8,
        tiempoBase: 30,
        prodBase: 2
    }
};

// --- LÓGICA DE RENDERIZADO (Dibuja las tarjetas en el HTML) ---

function renderList(section) {
    const container = document.getElementById(section + '-list');
    if (!container) return;
    container.innerHTML = '<p class="loading">Cargando sistemas...</p>';
    
    let htmlContent = '';

    DATA_VISUAL_EDIFICIOS.filter(b => b.section === section).forEach(b => {
        const dbType = mapBuildingId(b.id);
        // Buscamos el nivel real en la base de datos (o nivel 1 si no existe)
        const dbB = dbBuildingsCache.find(db => db.building_type === dbType) || { level: 1 };
        
        const costoProximo = calcularCosto(dbType, dbB.level + 1);

        htmlContent += `
            <div class="building-card animate__animated animate__fadeIn">
                <img src="${b.img}" class="building-img" onerror="this.src='https://placehold.co/300x160/0a0b10/00f2ff?text=${b.name}'">
                <div class="building-info">
                    <div class="building-header">
                        <span class="building-lvl">LVL ${dbB.level}</span>
                        <h3 class="building-name">${b.name}</h3>
                    </div>
                    <p class="building-lore">${b.lore}</p>
                    <button class="btn-upgrade" id="btn-upgrade-${dbType}" onclick="mejorarEdificio('${b.id}')">
                        <i class="fas fa-arrow-up"></i> MEJORAR (${costoProximo} Fe)
                    </button>
                </div>
            </div>`;
    });

    container.innerHTML = htmlContent;
}

// --- LÓGICA DE CÁLCULOS ---

function calcularCosto(type, nivel) {
    const stat = STATS_EDIFICIOS[type] || { costoBase: 100, crecimiento: 1.5 };
    return Math.floor(stat.costoBase * Math.pow(stat.crecimiento, nivel - 1));
}

function calcularTiempo(type, nivel) {
    const stat = STATS_EDIFICIOS[type] || { tiempoBase: 10 };
    return nivel * stat.tiempoBase;
}

function calcularProduccion(type, nivel) {
    const stat = STATS_EDIFICIOS[type] || { prodBase: 0 };
    return nivel * stat.prodBase;
}

// --- FUNCIONES DE BASE DE DATOS ---

async function actualizarRecursosDesdeBD() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: player } = await supabaseClient.from('players').select('*').eq('id', user.id).single();
    
    if (player) {
        let plusMetal = 0, plusSilicio = 0, plusDeuterio = 0;

        dbBuildingsCache.forEach(edificio => {
            const tipo = edificio.building_type;
            const lvl = edificio.level;
            if (tipo === "mina_metal") plusMetal = calcularProduccion(tipo, lvl);
            if (tipo === "mina_silicio") plusSilicio = calcularProduccion(tipo, lvl);
            if (tipo === "mina_deuterio") plusDeuterio = calcularProduccion(tipo, lvl);
        });

        const nuevosRecursos = {
            metal: player.metal + plusMetal,
            silicio: player.silicio + plusSilicio,
            deuterio: player.deuterio + plusDeuterio
        };

        await supabaseClient.from('players').update(nuevosRecursos).eq('id', user.id);

        userResources = nuevosRecursos;
        document.getElementById('res-metal').innerText = Math.floor(nuevosRecursos.metal);
        document.getElementById('res-silice').innerText = Math.floor(nuevosRecursos.silicio);
        document.getElementById('res-deuterio').innerText = Math.floor(nuevosRecursos.deuterio);
    }
}

async function mejorarEdificio(gameId) {
    const dbType = mapBuildingId(gameId);
    const { data: { user } } = await supabaseClient.auth.getUser();
    const edificioData = dbBuildingsCache.find(db => db.building_type === dbType) || { level: 1 };
    
    const nivelActual = edificioData.level;
    const costo = calcularCosto(dbType, nivelActual + 1);
    const tiempo = calcularTiempo(dbType, nivelActual + 1);
    const btn = document.getElementById(`btn-upgrade-${dbType}`);

    if (userResources.metal < costo) {
        btn.classList.add('shake'); // Efecto visual opcional
        setTimeout(() => btn.classList.remove('shake'), 500);
        return alert(`Necesitas ${costo} de Ferrum para esta mejora.`);
    }

    btn.disabled = true;
    await supabaseClient.from('players').update({ metal: userResources.metal - costo }).eq('id', user.id);

    let restante = tiempo;
    const timer = setInterval(() => {
        btn.innerHTML = `<i class="fas fa-hourglass-half"></i> ${restante}s`;
        restante--;

        if (restante < 0) {
            clearInterval(timer);
            finalizarMejora(user.id, dbType, nivelActual + 1, gameId);
        }
    }, 1000);
}

async function finalizarMejora(userId, dbType, nuevoNivel, gameId) {
    await supabaseClient.from('buildings').upsert({ 
        user_id: userId, 
        building_type: dbType, 
        level: nuevoNivel 
    }, { onConflict: 'user_id, building_type' });

    await syncBuildingsFromSupabase();
    renderList('resources'); // Re-dibujamos para actualizar nivel y nuevo precio
}
