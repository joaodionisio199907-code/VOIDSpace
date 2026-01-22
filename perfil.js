// perfil.js

// Abrir el modal de ajustes
function abrirAjustesPerfil() {
    const modal = document.getElementById('modal-perfil');
    if (modal) modal.style.display = 'flex';
}

// Cerrar el modal
function cerrarAjustesPerfil() {
    const modal = document.getElementById('modal-perfil');
    if (modal) modal.style.display = 'none';
}

// Guardar los cambios en Supabase
async function guardarPerfil() {
    const nickInput = document.getElementById('edit-nickname');
    const nick = nickInput.value.trim();

    if (!nick) {
        alert("El nickname no puede estar vacío.");
        return;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        const { error } = await supabaseClient
            .from('players')
            .update({ nickname: nick })
            .eq('id', user.id);

        if (error) throw error;

        alert("Identidad actualizada correctamente, Operativo.");
        
        // Opcional: Si tienes un elemento que muestre el nombre en la UI, actualízalo aquí
        // document.getElementById('display-nickname').innerText = nick;
        
        cerrarAjustesPerfil();
        nickInput.value = ""; // Limpiar input
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        alert("Error en la conexión con el Comando Central.");
    }
}