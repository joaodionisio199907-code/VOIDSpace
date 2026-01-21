// ===============================
// FORO ESTELAR - foro.js
// ===============================

let currentTopicId = null;

// -------------------------------
// CARGAR TEMAS
// -------------------------------
async function cargarTemasForo() {
    const { data, error } = await supabaseClient
        .from('forum_topics')
        .select('id, title, author_name, created_at')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const container = document.getElementById('topics-container');
    if (!container) return;

    container.innerHTML = data.map(t => `
        <div class="forum-topic-card" onclick="verDetalleTema('${t.id}')">
            <h4>${t.title}</h4>
            <small>
                Por: ${t.author_name ?? 'Sistema'} |
                ${new Date(t.created_at).toLocaleDateString()}
            </small>
        </div>
    `).join('');
}

// -------------------------------
// CREAR TEMA
// -------------------------------
function mostrarCrearTema() {
    document.getElementById('forum-list-view').style.display = 'none';
    document.getElementById('modal-new-topic').style.display = 'block';
}

async function guardarNuevoTema() {
    const title = document.getElementById('topic-title-input').value.trim();
    const body = document.getElementById('topic-body-input').value.trim();

    if (!title || !body) {
        alert('Título y mensaje obligatorios');
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return alert('No autenticado');

    const { data: p } = await supabaseClient
        .from('players')
        .select('nickname')
        .eq('id', user.id)
        .single();

    const { error } = await supabaseClient
        .from('forum_topics')
        .insert({
            title,
            body,
            author_name: p?.nickname || 'Piloto Desconocido'
        });

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    cerrarDetalleTema();
    cargarTemasForo();
}

// -------------------------------
// VER DETALLE
// -------------------------------
async function verDetalleTema(id) {
    currentTopicId = id;

    const { data: topic, error } = await supabaseClient
        .from('forum_topics')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    document.getElementById('forum-list-view').style.display = 'none';
    document.getElementById('view-topic-detail').style.display = 'block';

    document.getElementById('topic-content-full').innerHTML = `
        <h2 style="color:var(--neon-blue)">${topic.title}</h2>
        <p style="margin:15px 0; border-bottom:1px solid #333; padding-bottom:10px;">
            ${topic.body}
        </p>
    `;

    cargarRespuestas(id);
}

// -------------------------------
// RESPUESTAS
// -------------------------------
async function cargarRespuestas(topicId) {
    const { data } = await supabaseClient
        .from('forum_replies')
        .select('*')
        .eq('topic_id', topicId)
        .order('created_at');

    const container = document.getElementById('replies-container');
    if (!container) return;

    container.innerHTML = (data || []).map(r => `
        <div style="background:rgba(255,255,255,0.05); padding:10px; margin-bottom:5px; border-radius:5px;">
            <b style="color:var(--neon-purple)">
                ${r.author_name ?? 'Anónimo'}:
            </b> ${r.content}
        </div>
    `).join('');
}

async function enviarRespuesta() {
    const content = document.getElementById('reply-text').value.trim();
    if (!content || !currentTopicId) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data: p } = await supabaseClient
        .from('players')
        .select('nickname')
        .eq('id', user.id)
        .single();

    await supabaseClient
        .from('forum_replies')
        .insert({
            topic_id: currentTopicId,
            content,
            author_name: p?.nickname || 'Anónimo'
        });

    document.getElementById('reply-text').value = '';
    cargarRespuestas(currentTopicId);
}

// -------------------------------
// CERRAR VISTAS
// -------------------------------
function cerrarDetalleTema() {
    document.getElementById('view-topic-detail').style.display = 'none';
    document.getElementById('modal-new-topic').style.display = 'none';
    document.getElementById('forum-list-view').style.display = 'block';
}
