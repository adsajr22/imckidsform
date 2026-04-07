// ============================================================
// professoras.js — Lógica da área das Professoras (professoras.html)
// Responsável por:
//   • Proteger a rota (apenas perfil 'professora' pode acessar)
//   • Exibir as turmas Kids e Juniores em modo somente leitura
//   • Filtrar crianças por nome ou responsável
// ============================================================


// ============================================================
// PROTEÇÃO DE ROTA — Somente professoras
// Executa imediatamente ao carregar o arquivo, antes do HTML
// estar disponível. Redireciona qualquer outro perfil.
// ============================================================
(function protegerRotaProfessora() {
    const sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao') || 'null');

    if (!sessao || sessao.perfil !== 'professora') {
        window.location.href = 'index.html';
    } else {
        const el = document.getElementById('nomeProfNav');
        if (el) el.textContent = `👩‍🏫 ${sessao.usuario}`;
    }
})();


// ============================================================
// CALCULAR TURMA PELA IDADE (mesma lógica do cadastro.js)
// Kids: 3–6 anos | Juniores: 7–11 anos
// ============================================================
function calcularTurmaProf(dataNascimento) {
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
// RENDERIZAR TURMAS (agora async — usa Supabase)
// Monta as tabelas Kids e Juniores em modo somente leitura.
// ============================================================
async function renderTurmas() {
    const busca = (document.getElementById('campoBuscaProf')?.value || '').toLowerCase().trim();

    let criancas, perfis;
    try {
        criancas = await dbGetTodasCriancas();
        perfis = await dbGetUsuarios();
    } catch (err) {
        console.error('Erro ao carregar turmas:', err);
        return;
    }

    const todos = criancas.filter(c => !busca
        || c.nome.toLowerCase().includes(busca)
        || (perfis.find(p => p.id === c.responsavel_id)?.nome || '').toLowerCase().includes(busca));

    const kids     = todos.filter(c => calcularTurmaProf(c.data_nascimento) === 'Kids');
    const juniores = todos.filter(c => calcularTurmaProf(c.data_nascimento) === 'Juniores');

    document.getElementById('badgeKidsProf').textContent     = kids.length;
    document.getElementById('badgeJunioresProf').textContent = juniores.length;

    function renderGrupo(grupo, tbodySelector, semId) {
        const tbody = document.querySelector(`${tbodySelector} tbody`);
        const sem   = document.getElementById(semId);
        tbody.innerHTML = '';

        if (grupo.length === 0) {
            sem.classList.remove('d-none');
            return;
        }
        sem.classList.add('d-none');

        grupo.forEach(c => {
            const nasc = c.data_nascimento
                ? new Date(c.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')
                : '—';

            const responsavel = perfis.find(p => p.id === c.responsavel_id);
            const nomeResp    = responsavel?.nome || '—';
            const telRaw      = responsavel?.telefone || '';
            const telNumeros  = telRaw.replace(/\D/g, '');
            const telWpp      = telNumeros ? '55' + telNumeros : null;
            const wppBtn      = telWpp
                ? `<a href="https://wa.me/${telWpp}" target="_blank" rel="noopener noreferrer" class="btn btn-success btn-sm px-2 py-1" title="${telRaw}" onclick="event.stopPropagation()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="vertical-align:middle"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg></a>`
                : '<span class="text-muted small">—</span>';

            const itensSaude = [
                c.saude_doencas       ? `🔴 ${c.saude_doencas}`       : '',
                c.saude_alergias      ? `⚠️ ${c.saude_alergias}`      : '',
                c.saude_comorbidades  ? `🟡 ${c.saude_comorbidades}`  : '',
                c.saude_medicamentos  ? `💊 ${c.saude_medicamentos}`  : '',
                c.saude_observacoes   ? `📝 ${c.saude_observacoes}`   : '',
            ].filter(Boolean);

            const saudeTxt = itensSaude.length
                ? `<span title="${itensSaude.join(' | ')}" style="cursor:default">🩺 Sim</span>`
                : '<span class="text-muted">—</span>';

            const sexoEmoji = c.sexo === 'Feminino'  ? '♀️ Feminino'
                            : c.sexo === 'Masculino' ? '♂️ Masculino' : '—';

            const rowId       = `detProf-${c.id}`;
            const detalheSaude = itensSaude.length
                ? itensSaude.map(i => `<div>${i}</div>`).join('')
                : '<span class="text-muted">Nenhuma informação de saúde.</span>';

            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.title = 'Clique para ver detalhes de saúde';
            tr.innerHTML = `
                <td><strong>${c.nome}</strong></td>
                <td>${sexoEmoji}</td>
                <td>${nasc}</td>
                <td>${c.parentesco || '—'}</td>
                <td>${nomeResp}<br><small class="text-muted">${responsavel?.usuario || '—'}</small></td>
                <td>${wppBtn}</td>
                <td>${saudeTxt}</td>
            `;

            const trDetalhe = document.createElement('tr');
            trDetalhe.id = rowId;
            trDetalhe.classList.add('d-none', 'table-light');
            trDetalhe.innerHTML = `
                <td colspan="7" class="small ps-4 py-2">
                    <strong>🩺 Saúde:</strong> ${detalheSaude}
                    ${c.data_registro ? `<span class="ms-4 text-muted">Cadastrado em: ${new Date(c.data_registro).toLocaleDateString('pt-BR')}</span>` : ''}
                </td>
            `;

            tbody.appendChild(tr);
            tbody.appendChild(trDetalhe);

            tr.addEventListener('click', () => trDetalhe.classList.toggle('d-none'));
        });
    }

    renderGrupo(kids,     '#tabelaKidsProf',     'semKidsProf');
    renderGrupo(juniores, '#tabelaJunioresProf', 'semJunioresProf');
}


// ============================================================
// VALIDAÇÃO DE CPF (mesma lógica do cadastro.js)
// ============================================================
function validarCPFProf(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i - 1]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i - 1]) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf[10]);
}


// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await renderTurmas();

    initFotoUpload('profFotoBox', 'profFotoInput', 'profFotoPreview', 'profFotoPh', 'profFotoRm');

    document.getElementById('campoBuscaProf')?.addEventListener('input', async () => {
        await renderTurmas();
    });
    document.getElementById('btnLimparBuscaProf')?.addEventListener('click', async () => {
        document.getElementById('campoBuscaProf').value = '';
        await renderTurmas();
    });


    // ── Referências do modal de edição ──
    const modal        = document.getElementById('modalEditarPerfilProf');
    const form         = document.getElementById('formEditarPerfilProf');
    const tipoDoc      = document.getElementById('profEditTipoDoc');
    const campoCPF     = document.getElementById('profEditCampoCPF');
    const campoRG      = document.getElementById('profEditCampoRG');
    const inputCPF     = document.getElementById('profEditCPF');
    const inputRG      = document.getElementById('profEditRG');
    const inputCEP     = document.getElementById('profEditCEP');
    const alerta       = document.getElementById('profEditAlerta');

    // Preenche o formulário com os dados atuais ao abrir o modal
    modal?.addEventListener('show.bs.modal', async () => {
        const sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao'));
        let p;
        try {
            p = await dbGetUsuario(sessao?.usuario) || {};
        } catch (err) {
            console.error('Erro ao carregar perfil:', err);
            p = {};
        }

        document.getElementById('profEditNome').value        = p.nome            || '';
        document.getElementById('profEditNascimento').value  = p.data_nascimento  || '';
        document.getElementById('profEditSexo').value        = p.sexo            || '';
        document.getElementById('profEditTelefone').value    = p.telefone        || '';
        document.getElementById('profEditEmail').value       = p.email           || '';
        document.getElementById('profEditNovaSenha').value   = '';
        document.getElementById('profEditConfSenha').value   = '';

        // Carrega a foto salva na caixa de upload
        setFotoUpload('profFotoPreview', 'profFotoPh', 'profFotoRm', p.foto_url || null);

        tipoDoc.value = p.tipo_doc || 'cpf';
        if (p.tipo_doc === 'rg') {
            campoCPF.classList.add('d-none');
            campoRG.classList.remove('d-none');
            inputCPF.required = false;
            inputRG.required  = true;
            inputRG.value     = p.rg  || '';
            inputCPF.value    = '';
        } else {
            campoCPF.classList.remove('d-none');
            campoRG.classList.add('d-none');
            inputCPF.required = true;
            inputRG.required  = false;
            inputCPF.value    = p.cpf || '';
            inputRG.value     = '';
        }

        document.getElementById('profEditCEP').value         = p.end_cep         || '';
        document.getElementById('profEditLogradouro').value  = p.end_logradouro  || '';
        document.getElementById('profEditNumero').value      = p.end_numero      || '';
        document.getElementById('profEditComplemento').value = p.end_complemento || '';
        document.getElementById('profEditBairro').value      = p.end_bairro      || '';
        document.getElementById('profEditCidade').value      = p.end_cidade      || '';
        document.getElementById('profEditEstado').value      = p.end_estado      || '';

        form.classList.remove('was-validated');
        alerta.className = 'alert d-none';
        inputCPF.setCustomValidity('');
        inputRG.setCustomValidity('');
    });

    // ── Alternar CPF ↔ RG ──
    tipoDoc?.addEventListener('change', () => {
        const usaCPF = tipoDoc.value === 'cpf';
        campoCPF.classList.toggle('d-none', !usaCPF);
        campoRG.classList.toggle('d-none', usaCPF);
        inputCPF.required = usaCPF;
        inputRG.required  = !usaCPF;
        inputCPF.value    = '';
        inputRG.value     = '';
        inputCPF.setCustomValidity('');
        inputRG.setCustomValidity('');
    });

    // ── Máscara CPF ──
    inputCPF?.addEventListener('input', () => {
        let v = inputCPF.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        inputCPF.value = v;
    });

    // ── Máscara RG ──
    inputRG?.addEventListener('input', () => {
        let v = inputRG.value.replace(/\D/g, '').slice(0, 9);
        v = v.replace(/(\d{2})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        inputRG.value = v;
    });

    // ── Máscara Telefone ──
    document.getElementById('profEditTelefone')?.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '').slice(0, 11);
        if (v.length <= 10) {
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
        }
        this.value = v;
    });

    // ── Máscara CEP + ViaCEP ──
    inputCEP?.addEventListener('input', () => {
        let v = inputCEP.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
        inputCEP.value = v;
    });

    inputCEP?.addEventListener('blur', async () => {
        const cep     = inputCEP.value.replace(/\D/g, '');
        const erroEl  = document.getElementById('profEditCepErro');
        const spinner = document.getElementById('profEditCepSpinner');
        erroEl.classList.add('d-none');
        if (cep.length !== 8) return;
        spinner.classList.remove('d-none');
        try {
            const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) {
                erroEl.classList.remove('d-none');
            } else {
                document.getElementById('profEditLogradouro').value = data.logradouro || '';
                document.getElementById('profEditBairro').value     = data.bairro     || '';
                document.getElementById('profEditCidade').value     = data.localidade || '';
                document.getElementById('profEditEstado').value     = data.uf         || '';
                document.getElementById('profEditNumero').focus();
            }
        } catch {
            erroEl.textContent = 'Erro ao consultar o CEP. Preencha manualmente.';
            erroEl.classList.remove('d-none');
        } finally {
            spinner.classList.add('d-none');
        }
    });

    // ── Salvar alterações ──
    document.getElementById('btnSalvarPerfilProf')?.addEventListener('click', async () => {
        alerta.className = 'alert d-none';

        if (tipoDoc.value === 'cpf') {
            inputCPF.setCustomValidity(validarCPFProf(inputCPF.value) ? '' : 'CPF inválido');
        } else {
            inputCPF.setCustomValidity('');
            inputRG.setCustomValidity(inputRG.value.trim() ? '' : 'Informe o RG');
        }

        const novaSenha = document.getElementById('profEditNovaSenha').value;
        const confSenha = document.getElementById('profEditConfSenha');
        if (novaSenha) {
            confSenha.setCustomValidity(novaSenha !== confSenha.value ? 'As senhas não coincidem' : '');
        } else {
            confSenha.setCustomValidity('');
        }

        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao'));

        // Get current photo or upload new one
        const fotoBase64 = getFotoUpload('profFotoPreview');
        let fotoUrl = null;
        if (fotoBase64) {
            try {
                fotoUrl = await uploadFoto(fotoBase64, 'perfis', `${sessao.id}.jpg`);
            } catch (err) {
                console.error('Erro ao fazer upload da foto:', err);
                alerta.textContent = '❌ Erro ao fazer upload da foto.';
                alerta.className   = 'alert alert-danger';
                return;
            }
        }

        const updateObj = {
            nome:           document.getElementById('profEditNome').value.trim(),
            data_nascimento: document.getElementById('profEditNascimento').value,
            sexo:           document.getElementById('profEditSexo').value,
            telefone:       document.getElementById('profEditTelefone').value,
            email:          document.getElementById('profEditEmail').value.trim(),
            tipo_doc:       tipoDoc.value,
            cpf:            tipoDoc.value === 'cpf' ? inputCPF.value : null,
            rg:             tipoDoc.value === 'rg'  ? inputRG.value  : null,
            end_cep:        inputCEP.value,
            end_logradouro: document.getElementById('profEditLogradouro').value.trim(),
            end_numero:     document.getElementById('profEditNumero').value.trim(),
            end_complemento: document.getElementById('profEditComplemento').value.trim(),
            end_bairro:     document.getElementById('profEditBairro').value.trim(),
            end_cidade:     document.getElementById('profEditCidade').value.trim(),
            end_estado:     document.getElementById('profEditEstado').value.trim().toUpperCase(),
        };

        if (novaSenha) updateObj.senha = novaSenha;
        if (fotoUrl) updateObj.foto_url = fotoUrl;

        try {
            await dbAtualizarUsuario(sessao.id, updateObj);

            // Exibe confirmação e fecha o modal após 1,5 s
            alerta.textContent = '✅ Dados atualizados com sucesso!';
            alerta.className   = 'alert alert-success';
            setTimeout(() => {
                bootstrap.Modal.getInstance(modal).hide();
            }, 1500);
        } catch (err) {
            console.error('Erro ao atualizar perfil:', err);
            alerta.textContent = '❌ Erro ao atualizar os dados.';
            alerta.className   = 'alert alert-danger';
        }
    });

    // Limpa estado de validação ao fechar
    modal?.addEventListener('hidden.bs.modal', () => {
        form.classList.remove('was-validated');
        alerta.className = 'alert d-none';
        inputCPF.setCustomValidity('');
        inputRG.setCustomValidity('');
        document.getElementById('profEditNovaSenha').value = '';
        document.getElementById('profEditConfSenha').value = '';
        setFotoUpload('profFotoPreview', 'profFotoPh', 'profFotoRm', null);
    });
});
