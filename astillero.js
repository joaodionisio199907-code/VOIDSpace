// --- CONFIGURACIÓN DE NAVES ---
const NAVES_DISPONIBLES = [
    { id: 'cazador_l', name: 'CAZADOR LIGERO', metal: 3000, silicio: 1000, time: 15, img: 'img/ships/interceptorarpía/interceptorarpía.png' },
    { id: 'carguero_p', name: 'CARGUERO PEQUEÑO', metal: 2000, silicio: 2000, time: 25, img: 'img/ships/interceptorarpía/johnscargo1.png' }
];

let shipQueue = [];
let shipTimerInterval = null;

// --- 1. RENDERIZAR INTERFAZ ---
function renderAstillero() {
    const container = document.getElementById('fleet-list-container');
    if (!container) return;
    
    container.innerHTML = NAVES_DISPONIBLES.map(ship => `
        <div class="ship-card-horizontal">
            <div class="ship-img-frame">
                <img src="${ship.img}" onerror="this.src='https://placehold.co/200x120?text=NAVE'">
            </div>
            <div class="ship-details">
                <div class="ship-header">
                    <h3>${ship.name}</h3>
                    <span class="ship-price">M: ${ship.metal} | S: ${ship.silicio}</span>
                </div>
                <div class="ship-actions">
                    <input type="number" id="qty-${ship.id}" value="1" min="1" class="ship-input">
                    <button class="build-btn" onclick="ordenarNave('${ship.id}')">
                        <i class="fas fa-hammer"></i> CONSTRUIR
                    </button>
                </div>
            </div>
        </div>`).join('');
}

// --- 2. ORDENAR CONSTRUCCIÓN (CON DOBLE COMPROBACIÓN) ---
async function ordenarNave(id) {
    const qty = parseInt(document.getElementById(`qty-${id}`).value);
    if (isNaN(qty) || qty <= 0) return;

    const ship = NAVES_DISPONIBLES.find(s => s.id === id);
    const costM = ship.metal * qty;
    const costS = ship.silicio * qty;

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Sincronizamos recursos reales antes de comprar
    const { data: player } = await supabaseClient.from('players').select('*').eq('id', user.id).single();

    if (player.metal >= costM && player.silicio >= costS) {
        // Restar recursos en BD
        await supabaseClient.from('players').update({
            metal: player.metal - costM,
            silicio: player.silicio - costS
        }).eq('id', user.id);

        // Actualizar visual inmediatamente
        userResources.metal -= costM;
        userResources.silicio -= costS;
        if (typeof animarResta === 'function') {
            animarResta('res-metal', costM);
            animarResta('res-silice', costS);
        }

        // Calcular tiempo de finalización
        let baseTime = Date.now();
        // Si ya hay naves en cola, la nueva empieza cuando termine la última
        if (shipQueue.length > 0) {
            const lastShip = shipQueue[shipQueue.length - 1];
            baseTime = new Date(lastShip.finish_at).getTime();
        }
        const finishAt = new Date(baseTime + (ship.time * qty * 1000)).toISOString();

        // Insertar en la tabla ship_queue
        await supabaseClient.from('ship_queue').insert([{
            user_id: user.id,
            ship_id: id,
            quantity: qty,
            finish_at: finishAt
        }]);

        syncShipQueueFromDB(); // Refrescar la lista de espera
    } else {
        alert("Recursos insuficientes en el servidor.");
    }
}

// --- 3. SINCRONIZAR COLA Y HANGAR ---
async function syncShipQueueFromDB() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Traer cola activa
    const { data: queue } = await supabaseClient.from('ship_queue')
        .select('*')
        .eq('user_id', user.id)
        .order('finish_at', { ascending: true });

    shipQueue = queue || [];
    renderShipQueue();
    if (shipQueue.length > 0) startShipTimer();
}

function renderShipQueue() {
    const container = document.getElementById('ship-queue-container'); // ASEGÚRATE DE TENER ESTE ID EN TU HTML
    if (!container) return;

    if (shipQueue.length === 0) {
        container.innerHTML = "<p style='opacity:0.5; font-size:0.8rem;'>No hay naves en construcción.</p>";
        return;
    }

    container.innerHTML = shipQueue.map(item => {
        const shipInfo = NAVES_DISPONIBLES.find(s => s.id === item.ship_id);
        return `
            <div style="background: rgba(0,242,255,0.05); padding: 10px; border-left: 3px solid var(--neon-blue); margin-bottom: 5px;">
                <div style="display:flex; justify-content:space-between;">
                    <span>${item.quantity}x ${shipInfo.name}</span>
                    <span id="timer-${item.id}" style="color:var(--neon-blue);">...</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- 4. RELOJ DE LA COLA ---
function startShipTimer() {
    if (shipTimerInterval) clearInterval(shipTimerInterval);

    shipTimerInterval = setInterval(async () => {
        if (shipQueue.length === 0) {
            clearInterval(shipTimerInterval);
            return;
        }

        const now = Date.now();
        const currentShip = shipQueue[0];
        const finishTime = new Date(currentShip.finish_at).getTime();
        const diff = Math.floor((finishTime - now) / 1000);

        const timerEl = document.getElementById(`timer-${currentShip.id}`);
        
        if (diff > 0) {
            if (timerEl) timerEl.innerText = diff + "s";
        } else {
            // ¡Nave terminada!
            clearInterval(shipTimerInterval);
            await finalizarNave(currentShip);
        }
    }, 1000);
}

async function finalizarNave(item) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    // 1. Ver si ya existe esta nave en el hangar (user_fleet)
    const { data: fleet } = await supabaseClient.from('user_fleet')
        .select('*')
        .eq('user_id', user.id)
        .eq('ship_id', item.ship_id)
        .single();

    if (fleet) {
        // Sumar a las existentes
        await supabaseClient.from('user_fleet')
            .update({ quantity: fleet.quantity + item.quantity })
            .eq('id', fleet.id);
    } else {
        // Insertar nuevas
        await supabaseClient.from('user_fleet').insert([{
            user_id: user.id,
            ship_id: item.ship_id,
            quantity: item.quantity
        }]);
    }

    // 2. Borrar de la cola
    await supabaseClient.from('ship_queue').delete().eq('id', item.id);

    // 3. Refrescar todo
    syncShipQueueFromDB();
    if (typeof loadHangar === 'function') loadHangar(); // Si tienes la función de mostrar el hangar
}

