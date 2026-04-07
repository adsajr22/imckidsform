// ============================================================
// script.js — Funções globais compartilhadas por todas as páginas
// Autenticação e login agora usam o Supabase (_db definido em supabase.js).
// ============================================================


// ============================================================
// LÓGICA DA TELA DE LOGIN (index.html)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

    const form         = document.getElementById('formLogin');
    const inputSenha   = document.getElementById('inputSenha');
    const mensagemErro = document.getElementById('mensagemErro');
    const btnLogin     = document.getElementById('btnLogin');

    if (!form) return; // este arquivo roda em todas as páginas; sai se não for o login

    // Limpa qualquer sessão anterior ao abrir a tela de login
    sessionStorage.removeItem('imcKids_sessao');

    // ── Enter nos campos dispara o submit ──
    ['inputUsuario', 'inputSenha'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
        });
    });

    // ── Submit do formulário ──
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        mensagemErro.classList.add('d-none');

        if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

        const usuario = document.getElementById('inputUsuario').value.trim().toLowerCase();
        const senha   = inputSenha.value;

        // Desabilita o botão para evitar cliques duplos
        if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = '⏳ Entrando...'; }

        try {
            const conta = await dbAutenticar(usuario, senha);

            if (conta) {
                // Salva a sessão com id UUID para uso nas outras páginas
                sessionStorage.setItem('imcKids_sessao', JSON.stringify({
                    id:      conta.id,
                    usuario: conta.usuario,
                    perfil:  conta.perfil,
                }));

                if (conta.perfil === 'admin')      window.location.href = 'admin.html';
                else if (conta.perfil === 'professora') window.location.href = 'professoras.html';
                else                               window.location.href = 'cadastro.html';
            } else {
                mensagemErro.classList.remove('d-none');
            }
        } catch (err) {
            console.error('Erro no login:', err);
            mensagemErro.textContent = '⚠️ Erro ao conectar. Verifique sua internet.';
            mensagemErro.classList.remove('d-none');
        } finally {
            if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = '🔐 Entrar'; }
        }
    });

    // ============================================================
    // ESQUECI MINHA SENHA
    // ============================================================
    const modalEl       = document.getElementById('modalEsqueciSenha');
    const passo1        = document.getElementById('esqueciPasso1');
    const passo2        = document.getElementById('esqueciPasso2');
    const passo3        = document.getElementById('esqueciPasso3');
    const erroEl1       = document.getElementById('esqueciErro1');
    const erroEl2       = document.getElementById('esqueciErro2');
    const infoTelEl     = document.getElementById('esqueciInfoTel');

    if (modalEl) {
        // Reseta o modal toda vez que é aberto
        modalEl.addEventListener('show.bs.modal', () => {
            passo1.classList.remove('d-none');
            passo2.classList.add('d-none');
            passo3.classList.add('d-none');
            erroEl1.classList.add('d-none');
            erroEl2.classList.add('d-none');
            document.getElementById('esqueciLogin').value    = '';
            document.getElementById('esqueciNovaSenha').value  = '';
            document.getElementById('esqueciConfSenha').value  = '';
        });

        // Passo 1 → avançar: localiza o usuário e mostra o telefone masCarado
        document.getElementById('btnEsqueciAvancar')?.addEventListener('click', async () => {
            erroEl1.classList.add('d-none');
            const login = document.getElementById('esqueciLogin').value.trim().toLowerCase();
            if (!login) { erroEl1.textContent = 'Informe o usuário.'; erroEl1.classList.remove('d-none'); return; }

            const perfil = await dbGetUsuario(login);

            if (!perfil) {
                erroEl1.textContent = '❌ Usuário não encontrado.';
                erroEl1.classList.remove('d-none');
                return;
            }

            const tel = (perfil.telefone || '').replace(/\D/g, '');
            if (!tel) {
                erroEl1.textContent = '⚠️ Este usuário não tem telefone cadastrado. Peça ao administrador para redefinir sua senha.';
                erroEl1.classList.remove('d-none');
                return;
            }

            // Guarda o login encontrado para usar no passo 2
            modalEl.dataset.login = login;

            // Exibe telefone mascarado: (XX) *****-1234
            const mascarado = tel.length >= 4
                ? tel.slice(0, 2).replace(/./g, '*') + ' *****-' + tel.slice(-4)
                : '****';
            infoTelEl.textContent = `📱 Enviaremos para o número terminado em ${tel.slice(-4)} (${mascarado})`;

            passo1.classList.add('d-none');
            passo2.classList.remove('d-none');
        });

        // Passo 2 → salva senha e abre WhatsApp
        document.getElementById('btnEsqueciWhatsapp')?.addEventListener('click', async () => {
            erroEl2.classList.add('d-none');

            const novaSenha = document.getElementById('esqueciNovaSenha').value;
            const confSenha = document.getElementById('esqueciConfSenha').value;

            if (novaSenha.length < 6) {
                erroEl2.textContent = '⚠️ A senha deve ter pelo menos 6 caracteres.';
                erroEl2.classList.remove('d-none');
                return;
            }
            if (novaSenha !== confSenha) {
                erroEl2.textContent = '⚠️ As senhas não coincidem.';
                erroEl2.classList.remove('d-none');
                return;
            }

            const login  = modalEl.dataset.login;
            const perfil = await dbGetUsuario(login);
            if (!perfil) { erroEl2.textContent = '❌ Usuário não encontrado.'; erroEl2.classList.remove('d-none'); return; }

            // Salva a nova senha
            await dbAtualizarUsuario(perfil.id, { senha: novaSenha });

            // Monta o link wa.me com mensagem pré-digitada
            const tel    = perfil.telefone.replace(/\D/g, '');
            const numero = tel.startsWith('55') ? tel : '55' + tel;
            const msg    = encodeURIComponent(
                `✅ *IMC Kids — Redefinição de senha*\n\nOlá, ${perfil.nome || login}! Sua senha foi redefinida com sucesso.\n\nNova senha: *${novaSenha}*\n\nGuarde esta mensagem em local seguro.`
            );

            window.open(`https://wa.me/${numero}?text=${msg}`, '_blank');

            passo2.classList.add('d-none');
            passo3.classList.remove('d-none');
        });
    }
});


// Toggle genérico de visibilidade de senha.
// Funciona para qualquer botão com classe "btn-toggle-senha" e
// atributo data-target="<id do input>".
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-toggle-senha');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const visivel = input.type === 'text';
    input.type = visivel ? 'password' : 'text';
    btn.textContent = visivel ? '👁️' : '🙈';
});

// Atalhos de teclado para selects de sexo e perfil.
// Sexo:  M → Masculino | F → Feminino | O → Outro
// Perfil: U → Usuário comum | P → Professora | A → Administrador
document.addEventListener('keydown', (e) => {
    if (e.target.tagName !== 'SELECT') return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const mapa = {
        m: 'Masculino', f: 'Feminino', o: 'Outro',
        u: 'usuario',   p: 'professora', a: 'admin',
    };
    const valor = mapa[e.key.toLowerCase()];
    if (!valor) return;
    const opt = [...e.target.options].find(o => o.value === valor);
    if (opt) {
        e.preventDefault();
        e.target.value = valor;
        e.target.dispatchEvent(new Event('change'));
    }
});

// Faz logout: limpa a sessão ativa e redireciona para a tela de login.
// Usado em todas as páginas autenticadas via onclick="logout()".
function logout() {
    sessionStorage.removeItem('imcKids_sessao');
    window.location.href = 'index.html';
}

// Exibe o modal de confirmação de exclusão centralizado.
// mensagem: texto exibido no corpo do modal
// onConfirmar: função executada se o usuário clicar em "Sim, excluir"
function confirmarExclusao(mensagem, onConfirmar) {
    const modalEl = document.getElementById('modalConfirmarExclusao');
    if (!modalEl) {
        // Fallback caso o modal não exista na página
        if (window.confirm(mensagem)) onConfirmar();
        return;
    }
    document.getElementById('modalExclusaoMensagem').textContent = mensagem;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    // Remove listener anterior para evitar chamadas duplicadas
    const btnConfirmar = document.getElementById('btnConfirmarExclusao');
    const novoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.replaceWith(novoBtn);

    novoBtn.addEventListener('click', () => {
        modal.hide();
        onConfirmar();
    }, { once: true });
}


// ============================================================
// UTILITÁRIOS DE UPLOAD DE FOTO
// Redimensiona via canvas (máx. 400 px), armazena como base64.
// ============================================================

// Redimensiona um File de imagem e devolve base64 via callback.
function _resizeFoto(file, maxPx, callback) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxPx || h > maxPx) {
                if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
                else        { w = Math.round(w * maxPx / h); h = maxPx; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

// Inicializa uma caixa de upload de foto.
// boxId: contêiner clicável | inputId: <input type="file"> | previewId: <img>
// placeholderId: div do placeholder | removerId: botão de remover
function initFotoUpload(boxId, inputId, previewId, placeholderId, removerId) {
    const box         = document.getElementById(boxId);
    const input       = document.getElementById(inputId);
    const preview     = document.getElementById(previewId);
    const placeholder = placeholderId ? document.getElementById(placeholderId) : null;
    const remover     = removerId     ? document.getElementById(removerId)     : null;
    if (!box || !input) return;

    box.addEventListener('click', (e) => {
        if (remover && (e.target === remover || remover.contains(e.target))) return;
        input.click();
    });

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Imagem muito grande. Máximo permitido: 5 MB.');
            input.value = '';
            return;
        }
        _resizeFoto(file, 400, (base64) => {
            if (preview)     { preview.src = base64; preview.classList.remove('d-none'); }
            if (placeholder) placeholder.classList.add('d-none');
            if (remover)     remover.classList.remove('d-none');
        });
    });

    remover?.addEventListener('click', (e) => {
        e.stopPropagation();
        input.value = '';
        if (preview)     { preview.src = ''; preview.classList.add('d-none'); }
        if (placeholder) placeholder.classList.remove('d-none');
        if (remover)     remover.classList.add('d-none');
    });
}

// Carrega uma foto salva numa caixa de upload (ao abrir formulário de edição).
function setFotoUpload(previewId, placeholderId, removerId, src) {
    const preview     = document.getElementById(previewId);
    const placeholder = placeholderId ? document.getElementById(placeholderId) : null;
    const remover     = removerId     ? document.getElementById(removerId)     : null;
    if (!preview) return;
    if (src) {
        preview.src = src;
        preview.classList.remove('d-none');
        placeholder?.classList.add('d-none');
        remover?.classList.remove('d-none');
    } else {
        preview.src = '';
        preview.classList.add('d-none');
        placeholder?.classList.remove('d-none');
        remover?.classList.add('d-none');
    }
}

// Retorna o base64 da foto selecionada, ou null se não houver foto.
function getFotoUpload(previewId) {
    const preview = document.getElementById(previewId);
    if (!preview || preview.classList.contains('d-none') || !preview.src) return null;
    return preview.src.startsWith('data:') ? preview.src : null;
}
