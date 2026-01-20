// supabase-game-sync.js
// SIN tocar tu HTML ni tu lógica existente
// Requiere:
// - supabaseClient (ya creado en el <head>)
// - game (objeto global del juego)

async function crearJugadorSiNoExiste() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data } = await supabaseClient
        .from('players')
        .select('id')
        .eq('id', user.id)
        .single();

    if (!data) {
        await supabaseClient.from('players').insert({
            id: user.id,
            metal: 500,
            silicio: 300,
            deuterio: 0,
            nivel: 1,
            xp: 0
        });
        console.log('[Supabase] Jugador creado');
    }
}

async function cargarJugador() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('players')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error || !data) return;

    game.resources.ferrum = data.metal;
    game.resources.silice = data.silicio;
    game.resources.h3 = data.deuterio;

    actualizarUIRecursos();
}

async function guardarJugador() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    await supabaseClient
        .from('players')
        .update({
            metal: Math.floor(game.resources.ferrum),
            silicio: Math.floor(game.resources.silice),
            deuterio: Math.floor(game.resources.h3)
        })
        .eq('id', user.id);
}

function actualizarUIRecursos() {
    document.getElementById('res-ferrum').innerText =
        Math.floor(game.resources.ferrum).toLocaleString();
    document.getElementById('res-silice').innerText =
        Math.floor(game.resources.silice).toLocaleString();
    document.getElementById('res-h3').innerText =
        Math.floor(game.resources.h3).toLocaleString();
}

// Arranque automático
window.addEventListener('load', async () => {
    await crearJugadorSiNoExiste();
    await cargarJugador();
    setInterval(guardarJugador, 5000);
});
