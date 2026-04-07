// ============================================================
// admin.js — Lógica do painel administrativo (admin.html)
// Responsável por:
//   • Proteger a rota (apenas administradores podem acessar)
//   • Listar todos os usuários com botão de remover
//   • Criar novos logins (usuário comum ou admin)
//   • Listar todos os cadastros de crianças do sistema
// ============================================================


// ============================================================
// PROTEÇÃO DE ROTA — Somente administradores
// Esta função anônima é executada imediatamente (IIFE).
// A sintaxe (function(){ ... })() cria e já chama a função,
// sem precisar de um nome para chamá-la depois.
// Isso garante que o redirecionamento aconteça antes de
// qualquer outra coisa na página.
// ============================================================
(function protegerRotaAdmin() {
    // Lê a sessão salva no sessionStorage (salva no login em script.js)
    const sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao') || 'null');

    // Se não há sessão OU o perfil não é 'admin', redireciona ao login
    if (!sessao || sessao.perfil !== 'admin') {
        window.location.href = 'index.html';
    } else {
        // Exibe o nome do admin logado na navbar
        const el = document.getElementById('nomeAdminNav');
        if (el) el.textContent = `👤 ${sessao.usuario}`;
    }
})();


// ============================================================
// RENDERIZAR TABELA DE USUÁRIOS (agora async — usa Supabase)
// ============================================================
async function renderUsuarios() {
    const tbody = document.querySelector('#tabelaUsuarios tbody');
    tbody.innerHTML = '';

    let usuarios;
    try {
        usuarios = await dbGetUsuarios();
    } catch (err) {
        console.error('Erro ao carregar usuários:', err);
        return;
    }

    usuarios.forEach((u, i) => {
        const tr = document.createElement('tr');
        const perfilLabel = { admin: 'Admin', usuario: 'Usuário comum', professora: 'Professora' };
        const perfilCor   = { admin: 'bg-danger', usuario: 'bg-primary', professora: 'bg-success' };
        tr.innerHTML = `
            <td>${u.usuario}</td>
            <td>
                <span class="badge ${perfilCor[u.perfil] || 'bg-secondary'}">
                    ${perfilLabel[u.perfil] || u.perfil}
                </span>
            </td>
            <td class="text-end">
                <button class="btn btn-outline-danger btn-sm" data-id="${u.id}">Remover</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao'));
            const u  = usuarios.find(x => x.id === id);

            if (u.usuario === sessao?.usuario) {
                alert('Você não pode remover o próprio usuário.');
                return;
            }

            confirmarExclusao(
                `Deseja realmente remover o usuário "${u.usuario}"? Esta ação não pode ser desfeita.`,
                async () => {
                    try {
                        await dbRemoverUsuario(id);
                        renderUsuarios();
                    } catch (err) { console.error('Erro ao remover usuário:', err); }
                }
            );
        });
    });
}


// ============================================================
// RENDERIZAR CADASTROS SEPARADOS POR TURMA (agora async)
// ============================================================
async function renderCadastros() {
    const busca = (document.getElementById('campoBusca')?.value || '').toLowerCase().trim();

    let criancas;
    let perfis;
    try {
        criancas = await dbGetTodasCriancas();
        perfis = await dbGetUsuarios();
    } catch (err) {
        console.error('Erro ao carregar cadastros:', err);
        return;
    }

    // Filtra por busca
    const lista = criancas.filter(c => !busca
        || c.nome.toLowerCase().includes(busca)
        || (perfis.find(p => p.id === c.responsavel_id)?.nome || '').toLowerCase().includes(busca));

    function calcularTurma(dataNascimento) {
        if (!dataNascimento) return null;
        const hoje = new Date();
        const nasc = new Date(dataNascimento + 'T00:00:00');
        let idade  = hoje.getFullYear() - nasc.getFullYear();
        const m    = hoje.getMonth() - nasc.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
        if (idade >= 3 && idade <= 6)  return 'Kids';
        if (idade >= 7 && idade <= 11) return 'Juniores';
        return null;
    }

    const kids     = lista.filter(c => calcularTurma(c.data_nascimento) === 'Kids');
    const juniores = lista.filter(c => calcularTurma(c.data_nascimento) === 'Juniores');
    const outros   = lista.filter(c => calcularTurma(c.data_nascimento) === null);

    document.getElementById('badgeKids').textContent     = kids.length;
    document.getElementById('badgeJuniores').textContent = juniores.length;
    document.getElementById('badgeForaFaixa').textContent = outros.length;
    document.getElementById('cardForaFaixa').style.display = outros.length > 0 ? '' : 'none';

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

            const rowId      = `detalhe-${c.id}`;
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
                <td>${c.cpf || '—'}</td>
                <td>${c.parentesco || '—'}</td>
                <td>${nomeResp}<br><small class="text-muted">${responsavel?.usuario || '—'}</small></td>
                <td>${wppBtn}</td>
                <td>${saudeTxt}</td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" data-remover="${c.id}" onclick="event.stopPropagation()" title="Excluir criança">🗑️</button>
                </td>
            `;

            const trDetalhe = document.createElement('tr');
            trDetalhe.id = rowId;
            trDetalhe.classList.add('d-none', 'table-light');
            trDetalhe.innerHTML = `
                <td colspan="9" class="small ps-4 py-2">
                    <strong>🩺 Saúde:</strong> ${detalheSaude}
                    ${c.data_registro ? `<span class="ms-4 text-muted">Cadastrado em: ${new Date(c.data_registro).toLocaleDateString('pt-BR')}</span>` : ''}
                </td>
            `;

            tbody.appendChild(tr);
            tbody.appendChild(trDetalhe);

            tr.addEventListener('click', () => trDetalhe.classList.toggle('d-none'));

            tr.querySelector('[data-remover]').addEventListener('click', async (e) => {
                e.stopPropagation();
                confirmarExclusao(
                    `Deseja realmente excluir o cadastro de "${c.nome}"? Esta ação não pode ser desfeita.`,
                    async () => {
                        try {
                            if (c.foto_url) await removerFoto(c.foto_url);
                            await dbRemoverCrianca(c.id);
                            renderCadastros();
                        } catch (err) { console.error('Erro ao remover criança:', err); }
                    }
                );
            });
        });
    }

    renderGrupo(kids,     '#tabelaKids',      'semKids');
    renderGrupo(juniores, '#tabelaJuniores',  'semJuniores');
    renderGrupo(outros,   '#tabelaForaFaixa', 'semForaFaixa');
}


// ============================================================
// EXPORTAR TODOS OS CADASTROS COMO CSV (agora async)
// ============================================================
async function exportarCSV() {
    let criancas, perfis;
    try {
        criancas = await dbGetTodasCriancas();
        perfis = await dbGetUsuarios();
    } catch (err) {
        console.error('Erro ao exportar CSV:', err);
        return;
    }

    const cabecalho = ['Nome', 'Sexo', 'Nascimento', 'CPF', 'Parentesco',
                       'Responsavel', 'Telefone', 'Email', 'Turma',
                       'Doencas', 'Alergias', 'Comorbidades', 'Medicamentos', 'Observacoes'];

    const esc = v => `"${(v || '').toString().replace(/"/g, '""')}"`;

    const linhas = criancas.map(c => {
        const resp = perfis.find(p => p.id === c.responsavel_id);
        const nasc = c.data_nascimento
            ? new Date(c.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR')
            : '';
        return [
            esc(c.nome),
            esc(c.sexo),
            esc(nasc),
            esc(c.cpf),
            esc(c.parentesco),
            esc(resp?.nome || ''),
            esc(resp?.telefone),
            esc(resp?.email),
            esc(c.turma || 'Fora da faixa'),
            esc(c.saude_doencas),
            esc(c.saude_alergias),
            esc(c.saude_comorbidades),
            esc(c.saude_medicamentos),
            esc(c.saude_observacoes),
        ].join(',');
    });

    const csv  = '\uFEFF' + [cabecalho.join(','), ...linhas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `imckids_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}


// ============================================================
// INICIALIZAÇÃO DO PAINEL (agora async)
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

    // Preenche as duas tabelas ao abrir a página
    await renderUsuarios();
    await renderCadastros();

    // ── Busca de cadastros ──
    document.getElementById('campoBusca')?.addEventListener('input', () => renderCadastros());
    document.getElementById('btnLimparBusca')?.addEventListener('click', () => {
        document.getElementById('campoBusca').value = '';
        renderCadastros();
    });

    // ── Exportar CSV ──
    document.getElementById('btnExportarCSV')?.addEventListener('click', exportarCSV);

    // Botão atualizar cadastros
    document.getElementById('btnAtualizarCadastros')?.addEventListener('click', () => {
        renderCadastros();
    });

    // ──────────────────────────────────────────────────────────
    // CRIAR NOVO USUÁRIO — modal completo
    // ──────────────────────────────────────────────────────────
    initFotoUpload('nUFotoBox', 'nUFotoInput', 'nUFotoPreview', 'nUFotoPh', 'nUFotoRm');

    // ── Máscara telefone ──
    document.getElementById('nUTelefone')?.addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '').slice(0, 11);
        if (v.length <= 10) {
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
        }
        this.value = v;
    });

    // ── Máscara CPF ──
    document.getElementById('nUCPF')?.addEventListener('input', () => {
        const el = document.getElementById('nUCPF');
        let v = el.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        el.value = v;
    });

    // ── Máscara RG ──
    document.getElementById('nURG')?.addEventListener('input', () => {
        const el = document.getElementById('nURG');
        let v = el.value.replace(/\D/g, '').slice(0, 9);
        v = v.replace(/(\d{2})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        el.value = v;
    });

    // ── Alternar CPF ↔ RG ──
    document.getElementById('nUTipoDoc')?.addEventListener('change', () => {
        const usaCPF = document.getElementById('nUTipoDoc').value === 'cpf';
        document.getElementById('nUCampoCPF').classList.toggle('d-none', !usaCPF);
        document.getElementById('nUCampoRG').classList.toggle('d-none', usaCPF);
        document.getElementById('nUCPF').value = '';
        document.getElementById('nURG').value  = '';
        document.getElementById('nUCPF').setCustomValidity('');
    });

    // ── Máscara CEP ──
    document.getElementById('nUCEP')?.addEventListener('input', () => {
        const el = document.getElementById('nUCEP');
        let v = el.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
        el.value = v;
    });

    // ── ViaCEP ──
    document.getElementById('nUCEP')?.addEventListener('blur', async () => {
        const cep     = document.getElementById('nUCEP').value.replace(/\D/g, '');
        const erroEl  = document.getElementById('nUCepErro');
        const spinner = document.getElementById('nUCepSpinner');
        erroEl.classList.add('d-none');
        if (cep.length !== 8) return;
        spinner.classList.remove('d-none');
        try {
            const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (data.erro) {
                erroEl.classList.remove('d-none');
            } else {
                document.getElementById('nULogradouro').value = data.logradouro || '';
                document.getElementById('nUBairro').value     = data.bairro     || '';
                document.getElementById('nUCidade').value     = data.localidade || '';
                document.getElementById('nUEstado').value     = data.uf         || '';
                document.getElementById('nUNumero').focus();
            }
        } catch {
            erroEl.textContent = 'Erro ao consultar o CEP. Preencha manualmente.';
            erroEl.classList.remove('d-none');
        } finally {
            spinner.classList.add('d-none');
        }
    });

    // ── Salvar novo usuário ──
    document.getElementById('btnSalvarNovoUsuario')?.addEventListener('click', async () => {
        const form   = document.getElementById('formNovoUsuario');
        const alerta = document.getElementById('alertaUsuario');
        alerta.className = 'alert d-none';

        // Valida CPF se preenchido
        const cpfEl   = document.getElementById('nUCPF');
        const tipoDoc = document.getElementById('nUTipoDoc').value;
        if (tipoDoc === 'cpf' && cpfEl.value) {
            const cpf = cpfEl.value.replace(/\D/g, '');
            let valido = cpf.length === 11 && !/^(\d)\1+$/.test(cpf);
            if (valido) {
                let soma = 0;
                for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i - 1]) * (11 - i);
                let resto = (soma * 10) % 11;
                if (resto === 10 || resto === 11) resto = 0;
                valido = resto === parseInt(cpf[9]);
                if (valido) {
                    soma = 0;
                    for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i - 1]) * (12 - i);
                    resto = (soma * 10) % 11;
                    if (resto === 10 || resto === 11) resto = 0;
                    valido = resto === parseInt(cpf[10]);
                }
            }
            cpfEl.setCustomValidity(valido ? '' : 'CPF inválido');
        } else {
            cpfEl.setCustomValidity('');
        }

        // Valida confirmação de senha
        const senhaEl = document.getElementById('novaSenha');
        const confEl  = document.getElementById('novoConfSenha');
        confEl.setCustomValidity(senhaEl.value !== confEl.value ? 'As senhas não coincidem' : '');

        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const login  = document.getElementById('novoLogin').value.trim().toLowerCase();
        const perfil = document.getElementById('novoPerfil').value;

        try {
            const existe = await dbGetUsuario(login);
            if (existe) {
                alerta.textContent = `⚠️ Login "${login}" já existe.`;
                alerta.className   = 'alert alert-warning';
                return;
            }

            const fotoBase64 = getFotoUpload('nUFotoPreview');
            const foto_url   = fotoBase64 ? await uploadFoto(fotoBase64) : null;

            await dbInserirUsuario({
                usuario:         login,
                senha:           senhaEl.value,
                perfil,
                nome:            document.getElementById('nUNome').value.trim()           || null,
                data_nascimento: document.getElementById('nUNasc').value                  || null,
                sexo:            document.getElementById('nUSexo').value                  || null,
                telefone:        document.getElementById('nUTelefone').value              || null,
                tipo_doc:        tipoDoc,
                cpf:             tipoDoc === 'cpf' ? cpfEl.value                          : null,
                rg:              tipoDoc === 'rg'  ? document.getElementById('nURG').value : null,
                email:           document.getElementById('nUEmail').value.trim()          || null,
                foto_url,
                end_cep:         document.getElementById('nUCEP').value                   || null,
                end_logradouro:  document.getElementById('nULogradouro').value.trim()     || null,
                end_numero:      document.getElementById('nUNumero').value.trim()         || null,
                end_complemento: document.getElementById('nUComplemento').value.trim()   || null,
                end_bairro:      document.getElementById('nUBairro').value.trim()         || null,
                end_cidade:      document.getElementById('nUCidade').value.trim()         || null,
                end_estado:      document.getElementById('nUEstado').value.trim().toUpperCase() || null,
            });

            await renderUsuarios();
            bootstrap.Modal.getInstance(document.getElementById('modalCriarUsuario')).hide();

        } catch (err) {
            console.error('Erro ao criar usuário:', err);
            alerta.textContent = err?.code === '23505'
                ? `⚠️ O login "${login}" já está em uso.`
                : '⚠️ Erro ao criar usuário. Tente novamente.';
            alerta.className   = 'alert alert-danger';
        }
    });

    // ── Reset do modal ao fechar ──
    document.getElementById('modalCriarUsuario')?.addEventListener('hidden.bs.modal', () => {
        const form = document.getElementById('formNovoUsuario');
        form.reset();
        form.classList.remove('was-validated');
        document.getElementById('alertaUsuario').className = 'alert d-none';
        document.getElementById('nUCampoCPF').classList.remove('d-none');
        document.getElementById('nUCampoRG').classList.add('d-none');
        document.getElementById('nUCPF').setCustomValidity('');
        document.getElementById('novoConfSenha').setCustomValidity('');
        setFotoUpload('nUFotoPreview', 'nUFotoPh', 'nUFotoRm', null);
    });

    // ──────────────────────────────────────────────────────────
    // EDIÇÃO DE PERFIL DO ADMIN
    // ──────────────────────────────────────────────────────────
    initFotoUpload('adminFotoBox', 'adminFotoInput', 'adminFotoPreview', 'adminFotoPh', 'adminFotoRm');

    const modalAdmin = document.getElementById('modalEditarPerfilAdmin');

    // Preenche campos ao abrir o modal
    modalAdmin?.addEventListener('show.bs.modal', async () => {
        const sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao'));
        const p      = await dbGetUsuario(sessao?.usuario) || {};

        document.getElementById('adminEditNome').value        = p.nome           || '';
        document.getElementById('adminEditNascimento').value  = p.data_nascimento || '';
        document.getElementById('adminEditTelefone').value    = p.telefone       || '';
        document.getElementById('adminEditEmail').value       = p.email          || '';
        document.getElementById('adminEditNovaSenha').value   = '';
        document.getElementById('adminEditConfSenha').value   = '';

        setFotoUpload('adminFotoPreview', 'adminFotoPh', 'adminFotoRm', p.foto_url || null);
    });

    // Salva as alterações
    document.getElementById('btnSalvarPerfilAdmin')?.addEventListener('click', async () => {
        const alertaAdmin = document.getElementById('adminEditAlerta');
        alertaAdmin.className = 'alert d-none';

        const novaSenha = document.getElementById('adminEditNovaSenha').value;
        const confSenha = document.getElementById('adminEditConfSenha');
        if (novaSenha && novaSenha !== confSenha.value) {
            alertaAdmin.textContent = '⚠️ As senhas não coincidem.';
            alertaAdmin.className   = 'alert alert-warning';
            return;
        }

        const sessao = JSON.parse(sessionStorage.getItem('imcKids_sessao'));

        try {
            const fotoBase64 = getFotoUpload('adminFotoPreview');
            let   foto_url   = null;
            if (fotoBase64 && fotoBase64.startsWith('data:')) {
                foto_url = await uploadFoto(fotoBase64, 'perfis', `${sessao.id}.jpg`);
            } else {
                const p = await dbGetUsuario(sessao?.usuario);
                foto_url = p?.foto_url || null;
            }

            const campos = {
                nome:           document.getElementById('adminEditNome').value.trim(),
                data_nascimento: document.getElementById('adminEditNascimento').value || null,
                telefone:       document.getElementById('adminEditTelefone').value || null,
                email:          document.getElementById('adminEditEmail').value.trim() || null,
                foto_url,
            };
            if (novaSenha) campos.senha = novaSenha;

            await dbAtualizarUsuario(sessao.id, campos);

            alertaAdmin.textContent = '✅ Dados atualizados com sucesso!';
            alertaAdmin.className   = 'alert alert-success';
            setTimeout(() => bootstrap.Modal.getInstance(modalAdmin).hide(), 1500);
        } catch (err) {
            console.error('Erro ao atualizar perfil:', err);
            alertaAdmin.textContent = '⚠️ Erro ao atualizar. Tente novamente.';
            alertaAdmin.className   = 'alert alert-danger';
        }
    });

    // Limpa o modal ao fechar
    modalAdmin?.addEventListener('hidden.bs.modal', () => {
        document.getElementById('formEditarPerfilAdmin').classList.remove('was-validated');
        document.getElementById('adminEditAlerta').className = 'alert d-none';
        document.getElementById('adminEditNovaSenha').value = '';
        document.getElementById('adminEditConfSenha').value = '';
        setFotoUpload('adminFotoPreview', 'adminFotoPh', 'adminFotoRm', null);
    });
});
