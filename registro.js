// ============================================================
// registro.js — Lógica da tela de criação de conta (registro.html)
// Responsável por:
//   • Alternar entre CPF e RG no formulário
//   • Aplicar máscaras de formatação nos campos
//   • Consultar o endereço automaticamente pelo CEP (API ViaCEP)
//   • Validar o CPF com o algoritmo oficial
//   • Salvar o novo usuário no localStorage
// ============================================================


// 'DOMContentLoaded' garante que o JavaScript só rode depois que
// todo o HTML da página tiver sido carregado e montado pelo browser.
document.addEventListener('DOMContentLoaded', () => {

    // Inicializa a caixa de upload de foto do responsável
    initFotoUpload('regFotoBox', 'regFotoInput', 'regFotoPreview', 'regFotoPh', 'regFotoRm');

    // ── Referências aos elementos do HTML ──
    // document.getElementById() busca um elemento pelo seu atributo id=""
    const form     = document.getElementById('formRegistro');     // o formulário inteiro
    const tipoDoc  = document.getElementById('regTipoDoc');       // select CPF / RG
    const campoCPF = document.getElementById('campoCPF');         // div que envolve o campo CPF
    const campoRG  = document.getElementById('campoRG');          // div que envolve o campo RG
    const inputCPF = document.getElementById('regCPF');           // input do CPF
    const inputRG  = document.getElementById('regRG');            // input do RG
    const inputCEP = document.getElementById('regCEP');           // input do CEP
    const alerta   = document.getElementById('regAlerta');        // área de mensagens de erro/sucesso


    // ============================================================
    // ALTERNAR CPF ↔ RG
    // Quando o usuário muda o select de "CPF" para "RG" (ou vice-versa),
    // escondemos o campo desnecessário e ajustamos o atributo 'required'
    // para que apenas o campo visível seja obrigatório.
    // ============================================================
    tipoDoc.addEventListener('change', () => {
        const usaCPF = tipoDoc.value === 'cpf'; // true se selecionou CPF

        // classList.toggle(classe, condicao):
        //   adiciona a classe se condição for FALSE, remove se for TRUE
        // 'd-none' é uma classe do Bootstrap que oculta o elemento (display: none)
        campoCPF.classList.toggle('d-none', !usaCPF); // mostra CPF se usaCPF=true
        campoRG.classList.toggle('d-none', usaCPF);   // mostra RG  se usaCPF=false

        // Torna obrigatório apenas o campo que está visível
        inputCPF.required = usaCPF;
        inputRG.required  = !usaCPF;

        // Limpa os valores e erros do campo que ficou oculto
        inputCPF.value = '';
        inputRG.value  = '';
        inputCPF.setCustomValidity(''); // remove mensagem de erro customizada
        inputRG.setCustomValidity('');
    });


    // ============================================================
    // MÁSCARA DE CPF — formato: 000.000.000-00
    // Toda vez que o usuário digita no campo, formatamos o valor.
    // replace(/\D/g, '') remove tudo que não for dígito.
    // .slice(0, 11) limita a 11 dígitos (tamanho do CPF).
    // Os replace() com regex inserem os pontos e o traço nas posições certas.
    // ============================================================
    inputCPF.addEventListener('input', () => {
        let v = inputCPF.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');       // insere o 1º ponto após 3 dígitos
        v = v.replace(/(\d{3})(\d)/, '$1.$2');       // insere o 2º ponto após mais 3 dígitos
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2'); // insere o traço antes dos 2 últimos
        inputCPF.value = v;
    });


    // ============================================================
    // MÁSCARA DE RG — formato: 00.000.000-0
    // Funciona da mesma forma que a máscara do CPF, mas com 9 dígitos.
    // ============================================================
    inputRG.addEventListener('input', () => {
        let v = inputRG.value.replace(/\D/g, '').slice(0, 9);
        v = v.replace(/(\d{2})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        inputRG.value = v;
    });


    // ============================================================
    // MÁSCARA DE TELEFONE — formato: (00) 00000-0000 ou (00) 0000-0000
    // Limita a 11 dígitos. Usa 'function' (em vez de arrow function)
    // para poder usar 'this', que aponta para o próprio input.
    // O if/else decide se formata como celular (9 dígitos) ou fixo (8 dígitos).
    // ============================================================
    document.getElementById('regTelefone').addEventListener('input', function () {
        let v = this.value.replace(/\D/g, '').slice(0, 11);
        if (v.length <= 10) {
            // Telefone fixo: (XX) XXXX-XXXX
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            // Celular: (XX) XXXXX-XXXX
            v = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
        }
        this.value = v;
    });


    // ============================================================
    // MÁSCARA DE CEP — formato: 00000-000
    // Inserimos o traço automaticamente após os 5 primeiros dígitos.
    // ============================================================
    inputCEP.addEventListener('input', () => {
        let v = inputCEP.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
        inputCEP.value = v;
    });


    // ============================================================
    // BUSCA DE ENDEREÇO PELO CEP — API ViaCEP
    // O evento 'blur' dispara quando o usuário SAI do campo (clica em outro lugar).
    // Ao sair do campo CEP, fazemos uma requisição HTTP para a API pública ViaCEP.
    // Se o CEP existir, preenchemos os campos de endereço automaticamente.
    //
    // 'async/await' é a forma moderna de lidar com operações assíncronas
    // (como chamadas de rede) sem travar a página.
    // ============================================================
    inputCEP.addEventListener('blur', async () => {
        // Remove a formatação para obter apenas os 8 dígitos numéricos
        const cep     = inputCEP.value.replace(/\D/g, '');
        const erroEl  = document.getElementById('cepErro');
        const spinner = document.getElementById('cepSpinner'); // ícone de carregando

        // Esconde erro anterior
        erroEl.classList.add('d-none');

        // Só consulta se o CEP tiver exatamente 8 dígitos
        if (cep.length !== 8) return;

        // Exibe o spinner enquanto busca
        spinner.classList.remove('d-none');

        try {
            // fetch() faz uma requisição HTTP GET para a URL da API ViaCEP
            // A URL inclui o CEP digitado pelo usuário
            const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

            // .json() converte a resposta (texto) para um objeto JavaScript
            const data = await res.json();

            if (data.erro) {
                // A API retorna { erro: true } quando o CEP não existe
                erroEl.classList.remove('d-none');
            } else {
                // CEP encontrado! Preenche os campos com os dados retornados.
                // O operador '|| ""' garante que fique vazio se a API não retornar o campo.
                document.getElementById('regLogradouro').value = data.logradouro || '';
                document.getElementById('regBairro').value     = data.bairro     || '';
                document.getElementById('regCidade').value     = data.localidade || '';
                document.getElementById('regEstado').value     = data.uf         || '';

                // Move o foco para o campo "Número" para facilitar o preenchimento
                document.getElementById('regNumero').focus();
            }
        } catch {
            // O bloco catch captura erros de rede (ex: sem internet)
            erroEl.textContent = 'Erro ao consultar o CEP. Preencha manualmente.';
            erroEl.classList.remove('d-none');
        } finally {
            // O bloco finally sempre executa, com erro ou sem.
            // Usado aqui para esconder o spinner independentemente do resultado.
            spinner.classList.add('d-none');
        }
    });


    // ============================================================
    // VALIDAÇÃO DE CPF — Algoritmo oficial da Receita Federal
    // O CPF tem 11 dígitos. Os 2 últimos são "dígitos verificadores"
    // calculados matematicamente a partir dos 9 primeiros.
    // Esta função recalcula esses dígitos e compara com os informados.
    // Retorna true se o CPF for válido, false se não for.
    // ============================================================
    function validarCPF(cpf) {
        cpf = cpf.replace(/\D/g, ''); // remove pontos e traço

        // CPF deve ter 11 dígitos e não pode ser sequência repetida (ex: 111.111.111-11)
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

        let soma = 0, resto;

        // ── Cálculo do 1º dígito verificador ──
        // Multiplica cada um dos 9 primeiros dígitos por pesos de 10 a 2
        for (let i = 1; i <= 9; i++) soma += parseInt(cpf[i - 1]) * (11 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0; // regra especial da Receita
        if (resto !== parseInt(cpf[9])) return false; // compara com o 10º dígito

        // ── Cálculo do 2º dígito verificador ──
        soma = 0;
        for (let i = 1; i <= 10; i++) soma += parseInt(cpf[i - 1]) * (12 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        return resto === parseInt(cpf[10]); // compara com o 11º dígito
    }


    // ============================================================
    // ENVIO DO FORMULÁRIO — Criar conta
    // Ao clicar em "Criar conta", validamos todos os campos antes
    // de salvar o novo usuário.
    // ============================================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // impede o reload da página

        // Reseta o alerta de feedback
        alerta.className = 'alert d-none';

        // ── Validação do CPF (se CPF foi selecionado) ──
        if (tipoDoc.value === 'cpf') {
            // setCustomValidity('') = campo válido | setCustomValidity('mensagem') = inválido
            inputCPF.setCustomValidity(validarCPF(inputCPF.value) ? '' : 'CPF inválido');
        }

        // ── Validação do RG (se RG foi selecionado) ──
        if (tipoDoc.value === 'rg') {
            inputRG.setCustomValidity(inputRG.value.trim() ? '' : 'Informe o RG');
        }

        // ── Verificação se as senhas coincidem ──
        const senha     = document.getElementById('regSenha').value;
        const confSenha = document.getElementById('regConfSenha');
        confSenha.setCustomValidity(senha !== confSenha.value ? 'As senhas não coincidem' : '');

        // checkValidity() verifica todos os campos com 'required' e as validações customizadas
        if (!form.checkValidity()) {
            form.classList.add('was-validated'); // ativa estilos de erro do Bootstrap
            return;
        }

        // Converte o login para minúsculas para evitar duplicatas como "Admin" e "admin"
        const login = document.getElementById('regLogin').value.trim().toLowerCase();

        // Verifica se o login escolhido já está em uso
        const btnSubmit = form.querySelector('[type=submit]');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = '⏳ Salvando...'; }

        try {
            // Upload da foto (se houver)
            const fotoBase64 = getFotoUpload('regFotoPreview');
            let   foto_url   = null;
            if (fotoBase64) {
                foto_url = await uploadFoto(fotoBase64, 'perfis', `${gerarUUID()}.jpg`);
            }

            // Monta o objeto para inserir na tabela perfis
            const novoUsuario = {
                usuario:        login,
                senha:          document.getElementById('regSenha').value,
                perfil:         'usuario',
                nome:           document.getElementById('regNome').value.trim(),
                data_nascimento: document.getElementById('regNascimento').value || null,
                sexo:           document.getElementById('regSexo').value || null,
                tipo_doc:       tipoDoc.value,
                cpf:            tipoDoc.value === 'cpf' ? inputCPF.value : null,
                rg:             tipoDoc.value === 'rg'  ? inputRG.value  : null,
                telefone:       document.getElementById('regTelefone').value || null,
                email:          document.getElementById('regEmail').value.trim() || null,
                foto_url,
                end_cep:         inputCEP.value || null,
                end_logradouro:  document.getElementById('regLogradouro').value.trim() || null,
                end_numero:      document.getElementById('regNumero').value.trim() || null,
                end_complemento: document.getElementById('regComplemento').value.trim() || null,
                end_bairro:      document.getElementById('regBairro').value.trim() || null,
                end_cidade:      document.getElementById('regCidade').value.trim() || null,
                end_estado:      document.getElementById('regEstado').value.trim().toUpperCase() || null,
            };

            await dbInserirUsuario(novoUsuario);
            window.location.href = 'index.html';

        } catch (err) {
            console.error('Erro ao criar conta:', err);
            // Código 23505 = violação de unique constraint (login já existe)
            if (err?.code === '23505') {
                alerta.textContent = `⚠️ O login "${login}" já está em uso. Escolha outro.`;
                alerta.className   = 'alert alert-warning';
            } else {
                const msg = err?.message || JSON.stringify(err);
                alerta.textContent = `⚠️ Erro: ${msg}`;
                alerta.className   = 'alert alert-danger';
            }
        } finally {
            if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = '✅ Criar conta'; }
        }
    });
});

