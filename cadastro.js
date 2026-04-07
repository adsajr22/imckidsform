// ============================================================
// cadastro.js — Lógica da área do usuário comum (cadastro.html)
// Responsável por:
//   • Proteger a rota (bloqueia quem não está logado)
//   • Exibir os dados pessoais do responsável logado
//   • Listar os filhos já cadastrados com botão de remover
//   • Mostrar/ocultar o formulário de cadastro de filho
//   • Validar e salvar o cadastro de uma criança
// ============================================================


// ============================================================
// PROTEÇÃO DE ROTA
// Antes de qualquer coisa, verificamos se há uma sessão ativa.
// sessionStorage guarda dados temporários da aba atual.
// Se não houver sessão (usuário não fez login), redirecionamos
// imediatamente para a tela de login.
// Este código roda fora do DOMContentLoaded, portanto executa
// assim que o arquivo é carregado — isso impede que a página
// "apareça" antes de redirecionar.
// ============================================================
const _sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao') || 'null');
if (!_sessao) {
    window.location.href = 'index.html'; // redireciona se não estiver logado
}


// ============================================================
// CALCULAR TURMA PELA IDADE
// Kids: 3–6 anos | Juniores: 7–11 anos
// Retorna null se a idade estiver fora das faixas.
// ============================================================
function calcularTurma(dataNascimento) {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nasc = new Date(dataNascimento + 'T00:00:00');
    let idade   = hoje.getFullYear() - nasc.getFullYear();
    const m     = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    if (idade >= 3 && idade <= 6)  return 'Kids';
    if (idade >= 7 && idade <= 11) return 'Juniores';
    return null;
}


// ============================================================
// VALIDAÇÃO DE CPF — Algoritmo da Receita Federal
// Recalcula os dois dígitos verificadores e compara com os informados.
// Retorna true se válido, false caso contrário.
// CPF vazio retorna true porque o campo é opcional para a criança.
// ============================================================
function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, ''); // remove formatação

    if (cpf.length === 0) return true; // campo opcional: vazio é aceito

    // Deve ter exatamente 11 dígitos e não pode ser sequência (ex: 000.000.000-00)
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let soma = 0, resto;

    // Cálculo do 1º dígito verificador (posição 10)
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i - 1]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    // Cálculo do 2º dígito verificador (posição 11)
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i - 1]) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf[10]);
}


// ============================================================
// RENDERIZAR DADOS DO RESPONSÁVEL
// Exibe no card "Meus dados" as informações do usuário logado,
// que foram salvas no localStorage quando ele criou a conta.
// ============================================================
function renderResponsavel(perfil) {
    const el = document.getElementById('dadosResponsavel');
    if (!el) return;

    // Atualiza o avatar no cabeçalho do card
    const fotoEl = document.getElementById('fotoResponsavelDisplay');
    if (fotoEl) {
        fotoEl.innerHTML = perfil.foto_url
            ? `<img src="${perfil.foto_url}" class="rounded-circle" style="width:50px;height:50px;object-fit:cover;border:2px solid #dee2e6;" alt="Foto">`
            : `<div class="rounded-circle bg-light border d-flex align-items-center justify-content-center" style="width:50px;height:50px;font-size:1.3rem;">👤</div>`;
    }

    const end = perfil.end_logradouro
        ? `${perfil.end_logradouro}, ${perfil.end_numero}${perfil.end_complemento ? ' ' + perfil.end_complemento : ''} — ${perfil.end_bairro}, ${perfil.end_cidade}/${perfil.end_estado} — CEP ${perfil.end_cep}`
        : '—';

    // innerHTML insere HTML diretamente dentro do elemento.
    // Template literals (crase ``) permitem inserir variáveis com ${}.
    // O operador || '—' exibe um traço quando o campo não foi preenchido.
    el.innerHTML = `
        <div class="row g-2 small">
            <div class="col-sm-6"><strong>📝 Nome:</strong> ${perfil.nome || _sessao.usuario}</div>
            <div class="col-sm-6"><strong>🎂 Nasc.:</strong> ${perfil.data_nascimento ? new Date(perfil.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div>
            <div class="col-sm-6"><strong>📞 Telefone:</strong> ${perfil.telefone || '—'}</div>
            <div class="col-sm-6"><strong>📧 E-mail:</strong> ${perfil.email || '—'}</div>
            <div class="col-sm-6"><strong>🩹 Documento:</strong> ${perfil.tipo_doc === 'cpf' ? (perfil.cpf || '—') : (perfil.rg || '—')}</div>
            <div class="col-12"><strong>📍 Endereço:</strong> ${end}</div>
        </div>
    `;
}


// ============================================================
// RENDERIZAR LISTA DE FILHOS (agora async — usa Supabase)
// ============================================================
async function renderFilhos() {
    const container = document.getElementById('listaFilhos');
    const semFilhos = document.getElementById('semFilhos');
    if (!container) return;

    let todos;
    try {
        todos = await dbGetCriancasDoResponsavel(_sessao.id);
    } catch (err) {
        console.error('Erro ao carregar crianças:', err);
        return;
    }

    container.querySelectorAll('.filho-card').forEach(el => el.remove());

    if (todos.length === 0) {
        semFilhos.classList.remove('d-none');
        return;
    }
    semFilhos.classList.add('d-none');

    todos.forEach(c => {
        const nasc = c.data_nascimento
            ? new Date(c.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';

        const temSaude = c.saude_doencas || c.saude_alergias || c.saude_comorbidades
                      || c.saude_medicamentos || c.saude_observacoes;

        let tooltipSaude = '';
        if (c.saude_doencas)      tooltipSaude += `Doenças: ${c.saude_doencas}\n`;
        if (c.saude_alergias)     tooltipSaude += `Alergias: ${c.saude_alergias}\n`;
        if (c.saude_comorbidades) tooltipSaude += `Comorbidades: ${c.saude_comorbidades}\n`;
        if (c.saude_medicamentos) tooltipSaude += `Medicamentos: ${c.saude_medicamentos}\n`;
        if (c.saude_observacoes)  tooltipSaude += `Obs.: ${c.saude_observacoes}`;

        const card = document.createElement('div');
        card.className = 'filho-card card border rounded-3 p-3 mb-2';
        const sexoEmoji = c.sexo === 'Feminino' ? '♀️' : c.sexo === 'Masculino' ? '♂️' : '';
        const fotoAvatar = c.foto_url
            ? `<img src="${c.foto_url}" class="rounded-circle" style="width:42px;height:42px;object-fit:cover;border:2px solid #dee2e6;flex-shrink:0;" alt="">`
            : `<div class="rounded-circle bg-light border d-flex align-items-center justify-content-center" style="width:42px;height:42px;font-size:1.2rem;flex-shrink:0;">👦</div>`;
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center gap-2">
                    ${fotoAvatar}
                    <div>
                    <strong>${c.nome}</strong>
                    <span class="text-muted small ms-2">${sexoEmoji}</span>
                    <span class="text-muted small ms-2">🎂 ${nasc}</span>
                    ${c.cpf ? `<span class="text-muted small ms-2">🪖 ${c.cpf}</span>` : ''}
                    <span class="badge bg-secondary ms-2">${c.parentesco || ''}</span>
                    ${c.turma === 'Kids' ? `<span class="badge bg-success ms-2">👶 Kids</span>` : c.turma === 'Juniores' ? `<span class="badge bg-primary ms-2">🌟 Juniores</span>` : ''}
                    ${temSaude ? `<span class="badge bg-warning text-dark ms-2" title="${tooltipSaude.trim()}" style="cursor:pointer;" data-saude="${c.id}">🩺 Saúde</span>` : ''}
                    </div>
                </div>
                <div class="d-flex gap-2 ms-3">
                    <button class="btn btn-outline-primary btn-sm" data-edit="${c.id}">✏️ Editar</button>
                    <button class="btn btn-outline-danger btn-sm" data-id="${c.id}">Remover</button>
                </div>
            </div>
            ${temSaude ? `
            <div class="saude-detalhes d-none mt-3 pt-3 border-top" id="saude-${c.id}">
                <div class="row g-2 small text-muted">
                    ${c.saude_doencas       ? `<div class="col-12"><strong>🔴 Doenças:</strong> ${c.saude_doencas}</div>`               : ''}
                    ${c.saude_alergias      ? `<div class="col-12"><strong>⚠️ Alergias:</strong> ${c.saude_alergias}</div>`              : ''}
                    ${c.saude_comorbidades  ? `<div class="col-12"><strong>🟡 Comorbidades:</strong> ${c.saude_comorbidades}</div>`      : ''}
                    ${c.saude_medicamentos  ? `<div class="col-12"><strong>💊 Medicamentos:</strong> ${c.saude_medicamentos}</div>`      : ''}
                    ${c.saude_observacoes   ? `<div class="col-12"><strong>📝 Observações:</strong> ${c.saude_observacoes}</div>`   : ''}
                </div>
            </div>` : ''}
        `;

        // Adiciona o card ao container na página
        container.appendChild(card);

        // Ao clicar no badge 🩺, expande/recolhe os detalhes de saúde
        card.querySelector('[data-saude]')?.addEventListener('click', () => {
            const detalhes = document.getElementById(`saude-${c.id}`);
            detalhes?.classList.toggle('d-none');
        });

        card.querySelector('[data-edit]')?.addEventListener('click', () => {
            document.getElementById('editFilhoId').value              = c.id;
            document.getElementById('editFilhoNome').value            = c.nome;
            document.getElementById('editFilhoNasc').value            = c.data_nascimento || '';
            document.getElementById('editFilhoSexo').value            = c.sexo     || '';
            document.getElementById('editFilhoCPF').value             = c.cpf      || '';
            document.getElementById('editFilhoParentesco').value      = c.parentesco || '';
            document.getElementById('editFilhoDoencas').value         = c.saude_doencas      || '';
            document.getElementById('editFilhoAlergias').value        = c.saude_alergias     || '';
            document.getElementById('editFilhoComorbidades').value    = c.saude_comorbidades || '';
            document.getElementById('editFilhoMedicamentos').value    = c.saude_medicamentos || '';
            document.getElementById('editFilhoObs').value             = c.saude_observacoes  || '';
            setFotoUpload('editFilhoFotoPreview', 'editFilhoFotoPh', 'editFilhoFotoRm', c.foto_url || null);

            const formEF = document.getElementById('formEditarFilho');
            formEF.classList.remove('was-validated');
            document.getElementById('editFilhoCPF').setCustomValidity('');

            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEditarFilho')).show();
        });
    });

    container.querySelectorAll('[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const filho = todos.find(c => c.id === id);
            const nome = filho?.nome || 'este cadastro';
            confirmarExclusao(
                `Deseja realmente remover o cadastro de "${nome}"? Esta ação não pode ser desfeita.`,
                async () => {
                    try {
                        if (filho?.foto_url) await removerFoto(filho.foto_url);
                        await dbRemoverCrianca(id);
                        await renderFilhos();
                    } catch (err) { console.error('Erro ao remover criança:', err); }
                }
            );
        });
    });
}


// ============================================================
// INICIALIZAÇÃO DA PÁGINA
// Tudo que depende do HTML estar pronto fica aqui dentro.
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

    // Exibe o nome do usuário logado na barra de navegação
    const navEl = document.getElementById('nomeUsuarioNav');
    if (navEl) navEl.textContent = `👤 ${_sessao.usuario}`;

    // Inicializa os uploads de foto
    initFotoUpload('editFotoBox',       'editFotoInput',       'editFotoPreview',       'editFotoPh',       'editFotoRm');
    initFotoUpload('addFotoBox',        'addFotoInput',        'addFotoPreview',        'addFotoPh',        'addFotoRm');
    initFotoUpload('editFilhoFotoBox',  'editFilhoFotoInput',  'editFilhoFotoPreview',  'editFilhoFotoPh',  'editFilhoFotoRm');

    // Se for admin, exibe os botões de atalho para o painel
    if (_sessao.perfil === 'admin') {
        document.getElementById('btnVoltarAdmin')?.classList.remove('d-none');
        document.getElementById('btnAdminCadastros')?.classList.remove('d-none');
    }

    // Ajusta os textos do formulário de adicionar criança conforme o perfil
    const eCrianca = _sessao.perfil === 'admin' || _sessao.perfil === 'professora';
    const tituloListaEl = document.getElementById('tituloListaFilhos');
    if (tituloListaEl) {
        tituloListaEl.textContent = eCrianca ? '👦 Crianças cadastradas' : '👦 Meus filhos cadastrados';
    }
    const textoBtnEl    = document.getElementById('textoBtnAdicionar');
    const tituloFormEl  = document.getElementById('tituloFormFilho');
    const subtituloEl   = document.getElementById('subtituloFormFilho');
    if (eCrianca) {
        if (textoBtnEl)   textoBtnEl.textContent   = 'Adicionar Criança';
        if (tituloFormEl) tituloFormEl.textContent  = '➕ Adicionar Criança';
        if (subtituloEl)  subtituloEl.textContent   = 'Preencha os dados da criança a ser cadastrada.';
    } else {
        if (textoBtnEl)   textoBtnEl.textContent   = 'Adicionar Filho';
        if (tituloFormEl) tituloFormEl.textContent  = '➕ Adicionar Filho';
        if (subtituloEl)  subtituloEl.textContent   = 'Os dados do responsável são preenchidos automaticamente com o seu perfil.';
    }

    // Busca o perfil completo do usuário logado para exibir seus dados
    try {
        const perfil = await dbGetUsuario(_sessao.usuario) || {};
        renderResponsavel(perfil);
    } catch (err) { console.error('Erro ao carregar perfil:', err); }

    // Renderiza a lista de filhos já cadastrados
    await renderFilhos();


    // ==========================================================
    // EDITAR PERFIL — botão "Editar dados"
    // ==========================================================

    const cardEditar    = document.getElementById('cardEditarPerfil');
    const btnEditar     = document.getElementById('btnEditarPerfil');
    const btnCancelarEd = document.getElementById('btnCancelarEdicao');
    const formEditar    = document.getElementById('formEditarPerfil');
    const editAlerta    = document.getElementById('editAlerta');

    const editTipoDoc  = document.getElementById('editTipoDoc');
    const editCampoCPF = document.getElementById('editCampoCPF');
    const editCampoRG  = document.getElementById('editCampoRG');
    const editCPF      = document.getElementById('editCPF');
    const editRG       = document.getElementById('editRG');
    const editCEP      = document.getElementById('editCEP');

    btnEditar?.addEventListener('click', async () => {
        // Busca o perfil atual para preencher os campos
        const p = await dbGetUsuario(_sessao.usuario) || {};

        // Preenche os campos com os dados salvos do perfil
        document.getElementById('editNome').value       = p.nome        || '';
        document.getElementById('editNascimento').value = p.data_nascimento || '';
        document.getElementById('editSexo').value       = p.sexo        || '';
        document.getElementById('editTelefone').value   = p.telefone    || '';
        document.getElementById('editEmail').value      = p.email       || '';

        // Carrega a foto salva na caixa de upload
        setFotoUpload('editFotoPreview', 'editFotoPh', 'editFotoRm', p.foto_url || null);

        // Define o tipo de documento e preenche o campo correto
        editTipoDoc.value = p.tipo_doc || 'cpf';
        if (p.tipo_doc === 'rg') {
            editCampoCPF.classList.add('d-none');
            editCampoRG.classList.remove('d-none');
            editCPF.required = false;
            editRG.required  = true;
            editRG.value     = p.rg  || '';
        } else {
            editCampoCPF.classList.remove('d-none');
            editCampoRG.classList.add('d-none');
            editCPF.required = true;
            editRG.required  = false;
            editCPF.value    = p.cpf || '';
        }

        // Preenche os campos de endereço
        document.getElementById('editCEP').value         = p.end_cep         || '';
        document.getElementById('editLogradouro').value  = p.end_logradouro  || '';
        document.getElementById('editNumero').value      = p.end_numero      || '';
        document.getElementById('editComplemento').value = p.end_complemento || '';
        document.getElementById('editBairro').value      = p.end_bairro      || '';
        document.getElementById('editCidade').value      = p.end_cidade      || '';
        document.getElementById('editEstado').value      = p.end_estado      || '';

        // Limpa campos de senha
        document.getElementById('editNovaSenha').value = '';
        document.getElementById('editConfSenha').value = '';

        // Remove estado de validação anterior
        formEditar.classList.remove('was-validated');
        editAlerta.className = 'alert d-none';

        // Exibe o card de edição e rola até ele
        cardEditar.classList.remove('d-none');
        cardEditar.scrollIntoView({ behavior: 'smooth' });
    });

    // Ao clicar em "Cancelar": esconde o formulário
    btnCancelarEd?.addEventListener('click', () => {
        cardEditar.classList.add('d-none');
    });

    // ── Alternar CPF ↔ RG no formulário de edição ──
    editTipoDoc?.addEventListener('change', () => {
        const usaCPF = editTipoDoc.value === 'cpf';
        editCampoCPF.classList.toggle('d-none', !usaCPF);
        editCampoRG.classList.toggle('d-none', usaCPF);
        editCPF.required = usaCPF;
        editRG.required  = !usaCPF;
        editCPF.value = '';
        editRG.value  = '';
        editCPF.setCustomValidity('');
        editRG.setCustomValidity('');
    });

    // ── Máscara CPF ──
    editCPF?.addEventListener('input', () => {
        let v = editCPF.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        editCPF.value = v;
    });

    // ── Máscara RG ──
    editRG?.addEventListener('input', () => {
        let v = editRG.value.replace(/\D/g, '').slice(0, 9);
        v = v.replace(/(\d{2})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        editRG.value = v;
    });

    // ── Máscara Telefone ──
    document.getElementById('editTelefone')?.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '').slice(0, 11);
        if (v.length <= 10) {
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
        }
        this.value = v;
    });

    // ── Máscara CEP ──
    editCEP?.addEventListener('input', () => {
        let v = editCEP.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
        editCEP.value = v;
    });

    // ── ViaCEP no formulário de edição ──
    editCEP?.addEventListener('blur', async () => {
        const cep     = editCEP.value.replace(/\D/g, '');
        const erroEl  = document.getElementById('editCepErro');
        const spinner = document.getElementById('editCepSpinner');
        erroEl.classList.add('d-none');
        if (cep.length !== 8) return;

        spinner.classList.remove('d-none');
        try {
            const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) {
                erroEl.classList.remove('d-none');
            } else {
                document.getElementById('editLogradouro').value = data.logradouro || '';
                document.getElementById('editBairro').value     = data.bairro     || '';
                document.getElementById('editCidade').value     = data.localidade || '';
                document.getElementById('editEstado').value     = data.uf         || '';
                document.getElementById('editNumero').focus();
            }
        } catch {
            erroEl.textContent = 'Erro ao consultar o CEP. Preencha manualmente.';
            erroEl.classList.remove('d-none');
        } finally {
            spinner.classList.add('d-none');
        }
    });

    formEditar?.addEventListener('submit', async (e) => {
        e.preventDefault();
        editAlerta.className = 'alert d-none';

        // Valida CPF se selecionado
        if (editTipoDoc.value === 'cpf') {
            editCPF.setCustomValidity(validarCPF(editCPF.value) ? '' : 'CPF inválido');
        } else {
            editCPF.setCustomValidity('');
            editRG.setCustomValidity(editRG.value.trim() ? '' : 'Informe o RG');
        }

        // Valida nova senha somente se foi preenchida
        const novaSenha  = document.getElementById('editNovaSenha').value;
        const confSenha  = document.getElementById('editConfSenha');
        if (novaSenha) {
            confSenha.setCustomValidity(novaSenha !== confSenha.value ? 'As senhas não coincidem' : '');
        } else {
            confSenha.setCustomValidity('');
        }

        if (!formEditar.checkValidity()) {
            formEditar.classList.add('was-validated');
            return;
        }

        // Pega a foto salva (se houver)
        const fotoBase64 = getFotoUpload('editFotoPreview');
        let   foto_url   = null;

        const btnSubmitEd = formEditar.querySelector('[type=submit]');
        if (btnSubmitEd) { btnSubmitEd.disabled = true; }

        try {
            if (fotoBase64 && fotoBase64.startsWith('data:')) {
                foto_url = await uploadFoto(fotoBase64, 'perfis', `${_sessao.id}.jpg`);
            }

            const campos = {
                nome:           document.getElementById('editNome').value.trim(),
                data_nascimento: document.getElementById('editNascimento').value || null,
                sexo:           document.getElementById('editSexo').value || null,
                telefone:       document.getElementById('editTelefone').value || null,
                email:          document.getElementById('editEmail').value.trim() || null,
                tipo_doc:       editTipoDoc.value,
                cpf:            editTipoDoc.value === 'cpf' ? editCPF.value : null,
                rg:             editTipoDoc.value === 'rg'  ? editRG.value  : null,
                end_cep:         editCEP.value || null,
                end_logradouro:  document.getElementById('editLogradouro').value.trim() || null,
                end_numero:      document.getElementById('editNumero').value.trim() || null,
                end_complemento: document.getElementById('editComplemento').value.trim() || null,
                end_bairro:      document.getElementById('editBairro').value.trim() || null,
                end_cidade:      document.getElementById('editCidade').value.trim() || null,
                end_estado:      document.getElementById('editEstado').value.trim().toUpperCase() || null,
                foto_url,
            };
            if (novaSenha) campos.senha = novaSenha;

            await dbAtualizarUsuario(_sessao.id, campos);

            // Atualiza o card "Meus dados"
            renderResponsavel({ ...campos, usuario: _sessao.usuario });
            cardEditar.classList.add('d-none');

            const toastEl = document.createElement('div');
            toastEl.className = 'alert alert-success mt-3 mb-0';
            toastEl.textContent = '✅ Dados atualizados com sucesso!';
            document.getElementById('dadosResponsavel').after(toastEl);
            setTimeout(() => toastEl.remove(), 3000);
        } catch (err) {
            console.error('Erro ao atualizar perfil:', err);
            editAlerta.textContent = '⚠️ Erro ao salvar. Tente novamente.';
            editAlerta.className   = 'alert alert-danger';
        } finally {
            if (btnSubmitEd) btnSubmitEd.disabled = false;
        }
    });


    // ============================================================
    // MODAL EDITAR FILHO
    // ============================================================

    // Máscara de CPF no modal de edição
    const editFilhoCPF = document.getElementById('editFilhoCPF');
    editFilhoCPF?.addEventListener('input', () => {
        let v = editFilhoCPF.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        editFilhoCPF.value = v;
    });

    // Ao clicar "Salvar alterações" no modal: valida e persiste
    document.getElementById('btnSalvarEdicaoFilho')?.addEventListener('click', async () => {
        const formEF = document.getElementById('formEditarFilho');

        // Valida CPF se preenchido
        if (editFilhoCPF.value && !validarCPF(editFilhoCPF.value)) {
            editFilhoCPF.setCustomValidity('CPF inválido');
        } else {
            editFilhoCPF.setCustomValidity('');
        }

        if (!formEF.checkValidity()) {
            formEF.classList.add('was-validated');
            return;
        }

        const id    = document.getElementById('editFilhoId').value; // UUID string

        const nascEd = document.getElementById('editFilhoNasc').value;
        const fotoBase64Ed = getFotoUpload('editFilhoFotoPreview');

        try {
            // Upload da nova foto, se houver
            let foto_url = null;
            if (fotoBase64Ed && fotoBase64Ed.startsWith('data:')) {
                foto_url = await uploadFoto(fotoBase64Ed, 'criancas', `${id}.jpg`);
            } else if (!fotoBase64Ed) {
                // Sem foto selecionada — manter a existente
                const criancaAtual = await dbGetCrianca(id);
                foto_url = criancaAtual?.foto_url || null;
            }

            await dbAtualizarCrianca(id, {
                nome:             document.getElementById('editFilhoNome').value.trim(),
                data_nascimento:  nascEd || null,
                sexo:             document.getElementById('editFilhoSexo').value || null,
                cpf:              editFilhoCPF.value || null,
                parentesco:       document.getElementById('editFilhoParentesco').value,
                turma:            calcularTurma(nascEd),
                foto_url,
                saude_doencas:        document.getElementById('editFilhoDoencas').value.trim()      || null,
                saude_alergias:       document.getElementById('editFilhoAlergias').value.trim()     || null,
                saude_comorbidades:   document.getElementById('editFilhoComorbidades').value.trim() || null,
                saude_medicamentos:   document.getElementById('editFilhoMedicamentos').value.trim() || null,
                saude_observacoes:    document.getElementById('editFilhoObs').value.trim()          || null,
            });

            bootstrap.Modal.getInstance(document.getElementById('modalEditarFilho')).hide();
            await renderFilhos();
        } catch (err) {
            console.error('Erro ao salvar filho:', err);
            alert('⚠️ Erro ao salvar. Tente novamente.');
        }
    });

    // Limpa estado de validação quando o modal é fechado
    document.getElementById('modalEditarFilho')?.addEventListener('hidden.bs.modal', () => {
        const formEF = document.getElementById('formEditarFilho');
        formEF.classList.remove('was-validated');
        editFilhoCPF.setCustomValidity('');
    });


    // ── Referências para mostrar/ocultar o formulário de filho ──
    const cardForm     = document.getElementById('cardFormFilho');   // o card com o formulário
    const btnAdicionar = document.getElementById('btnAdicionarFilho'); // botão "+ Adicionar filho"
    const btnCancelar  = document.getElementById('btnCancelarFilho');  // botão "Cancelar"

    // Ao clicar em "+ Adicionar filho": mostra o formulário e esconde o botão
    btnAdicionar?.addEventListener('click', () => {
        cardForm.classList.remove('d-none');       // exibe o card do formulário
        btnAdicionar.classList.add('d-none');      // esconde o botão de adicionar
        cardForm.scrollIntoView({ behavior: 'smooth' }); // rola a página até o formulário
    });

    // Ao clicar em "Cancelar": esconde o formulário e restaura o botão
    btnCancelar?.addEventListener('click', () => {
        cardForm.classList.add('d-none');          // oculta o formulário
        btnAdicionar.classList.remove('d-none');   // mostra o botão de adicionar novamente
        form.reset();                              // limpa todos os campos
        form.classList.remove('was-validated');    // remove os estilos de validação
        document.getElementById('avisoFaixaEtaria')?.classList.add('d-none');
    });


    // ── Máscara de CPF da criança ──
    // Formata o campo enquanto o usuário digita (mesmo padrão do registro.js)
    const inputCPF = document.getElementById('cpfCrianca');
    inputCPF?.addEventListener('input', () => {
        let v = inputCPF.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        inputCPF.value = v;
    });

    // ── Aviso de faixa etária ──
    document.getElementById('dataNascimento')?.addEventListener('change', () => {
        const aviso = document.getElementById('avisoFaixaEtaria');
        aviso?.classList.toggle('d-none', calcularTurma(document.getElementById('dataNascimento').value) !== null);
    });

    // ── Formulário de cadastro do filho ──
    const form = document.getElementById('formCadastro');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault(); // impede reload da página

        const alertaSucesso = document.getElementById('alertaSucesso');
        const alertaErro    = document.getElementById('alertaErro');

        // Oculta alertas anteriores
        alertaSucesso.classList.add('d-none');
        alertaErro.classList.add('d-none');

        // Valida o CPF da criança (campo opcional — só valida se preenchido)
        if (inputCPF.value && !validarCPF(inputCPF.value)) {
            inputCPF.setCustomValidity('CPF inválido');
        } else {
            inputCPF.setCustomValidity(''); // remove erro se estiver vazio ou válido
        }

        // Verifica todos os campos obrigatórios
        if (!form.checkValidity()) {
            form.classList.add('was-validated'); // ativa estilos de erro do Bootstrap
            alertaErro.classList.remove('d-none');
            return;
        }

        // ── Monta o objeto que será salvo no Supabase ──
        const nascValue   = document.getElementById('dataNascimento').value;
        const fotoBase64  = getFotoUpload('addFotoPreview');
        let   foto_url    = null;
        if (fotoBase64 && fotoBase64.startsWith('data:')) {
            foto_url = await uploadFoto(fotoBase64, 'criancas', `${gerarUUID()}.jpg`);
        }

        const novaCrianca = {
            responsavel_id:  _sessao.id,
            parentesco:      document.getElementById('parentesco').value,
            turma:           calcularTurma(nascValue),
            nome:            document.getElementById('nomeCompleto').value.trim(),
            data_nascimento: nascValue || null,
            sexo:            document.getElementById('sexoCrianca').value || null,
            cpf:             inputCPF.value || null,
            foto_url,
            saude_doencas:       document.getElementById('doencas').value.trim()           || null,
            saude_alergias:      document.getElementById('alergias').value.trim()          || null,
            saude_comorbidades:  document.getElementById('comorbidades').value.trim()      || null,
            saude_medicamentos:  document.getElementById('medicamentos').value.trim()      || null,
            saude_observacoes:   document.getElementById('observacoesSaude').value.trim()  || null,
        };

        try {
            await dbInserirCrianca(novaCrianca);

            form.reset();
            form.classList.remove('was-validated');
            document.getElementById('avisoFaixaEtaria')?.classList.add('d-none');
            setFotoUpload('addFotoPreview', 'addFotoPh', 'addFotoRm', null);
            alertaSucesso.classList.remove('d-none');
            await renderFilhos();
        } catch (err) {
            console.error('Erro ao cadastrar criança:', err);
            alertaErro.classList.remove('d-none');
        }
    });
});


