
// game.js - Comando Central de VOID ECHOS

/**
 * CONFIGURACIÓN MAESTRA DE BALANCEO
 * Aquí puedes ajustar edificio por edificio.
 * - costoBase: Lo que cuesta nivel 1.
 * - crecimiento: Multiplicador de dificultad (1.5 = +50% cada nivel).
 * - tiempoBase: Segundos que tarda el nivel 1.
 * - prodBase: Lo que genera el edificio por cada nivel.
 */
const STATS_EDIFICIOS = {
    "mina_metal": {
        nombre: "Mina de Ferrum",
        costoBase: 100,
        crecimiento: 1.5,
        tiempoBase: 10, // 10s, 20s, 30s...
        prodBase: 10    // Produce 10, 20, 30...
    },
    "mina_silicio": {
        nombre: "Sintetizador de Sílice",
        costoBase: 150,
        crecimiento: 1.6, // Un poco más difícil que el metal
        tiempoBase: 15,
        prodBase: 5
    },
    "mina_deuterio": {
        nombre: "Colector Isótopo-H3",
        costoBase: 200,
        crecimiento: 1.8,
        tiempoBase: 30,
        prodBase: 2
    },
    "planta_solar": {
        nombre: "Matriz Solar",
        costoBase: 80,
        crecimiento: 1.3,
        tiempoBase: 5,
        prodBase: 0 // La energía podría tener otra lógica luego
    },
    "laboratorio": {
        nombre: "Laboratorio Tech",
        costoBase: 500,
        crecimiento: 2.0,
        tiempoBase: 60,
        prodBase: 0
    }
};

// --- LÓGICA DE CÁLCULOS (No tocar a menos que quieras cambiar la fórmula matemática) ---

function calcularCosto(type, nivel) {
    const stat = STATS_EDIFICIOS[type];
    return Math.floor(stat.costoBase * Math.pow(stat.crecimiento, nivel - 1));
}

function calcularTiempo(type, nivel) {
    return nivel * STATS_EDIFICIOS[type].tiempoBase;
}

function calcularProduccion(type, nivel) {
    return nivel * STATS_EDIFICIOS[type].prodBase;
}

// --- FUNCIONES DE SISTEMA ---

async function actualizarRecursosDesdeBD() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // 1. Obtener datos actuales del jugador
    const { data: player } = await supabaseClient.from('players').select('*').eq('id', user.id).single();
    
    if (player) {
        // 2. Calcular producción sumada de todas las minas basándonos en el caché de edificios
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

        // 3. Guardar en Supabase
        await supabaseClient.from('players').update(nuevosRecursos).eq('id', user.id);

        // 4. Actualizar Interfaz
        userResources = nuevosRecursos; // Sincroniza variable global
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

    // Validación de recursos (Ferrum como moneda principal de construcción)
    if (userResources.metal < costo) {
        btn.style.borderColor = "#ff4444";
        setTimeout(() => btn.style.borderColor = "", 1000);
        return alert(`Recursos insuficientes. Necesitas ${costo} de Ferrum.`);
    }

    // Cobrar e iniciar proceso
    btn.disabled = true;
    await supabaseClient.from('players').update({ metal: userResources.metal - costo }).eq('id', user.id);

    // Cuenta atrás
    let restante = tiempo;
    const timer = setInterval(() => {
        btn.innerHTML = `<i class="fas fa-tools animate__animated animate__flash"></i> ${restante}s`;
        restante--;

        if (restante < 0) {
            clearInterval(timer);
            finalizarMejora(user.id, dbType, nivelActual + 1, gameId);
        }
    }, 1000);
}

async function finalizarMejora(userId, dbType, nuevoNivel, gameId) {
    const { error } = await supabaseClient.from('buildings').upsert({ 
        user_id: userId, 
        building_type: dbType, 
        level: nuevoNivel 
    }, { onConflict: 'user_id, building_type' });

    if (!error) {
        await syncBuildingsFromSupabase();
        // Feedback visual de éxito
        const btn = document.getElementById(`btn-upgrade-${dbType}`);
        if(btn) btn.classList.add('btn-completar');
    }
}