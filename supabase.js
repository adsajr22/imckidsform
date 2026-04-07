// ============================================================
// supabase.js — Cliente Supabase compartilhado por todas as páginas
// ============================================================

const SUPABASE_URL  = 'https://wijkfgophdffvpydmumo.supabase.co';
const SUPABASE_ANON = 'sb_publishable_OzAu6h3O_ASZpBV4QNkuFg_iW9PnEXb';

// Cria o cliente Supabase e expõe como _db para todo o sistema
const _db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);


// ============================================================
// UTILITÁRIO — gera UUID v4 simples (para nomes de arquivo)
// ============================================================
function gerarUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}


// ============================================================
// HELPERS DE FOTO — Supabase Storage (bucket: "fotos")
// ============================================================

/** Converte base64 para Blob para enviar ao Storage. */
function _base64ToBlob(base64) {
    const [header, data] = base64.split(',');
    const mime   = header.match(/:(.*?);/)[1];
    const binary = atob(data);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

/**
 * Faz upload de uma foto (base64) para o Supabase Storage.
 * Retorna a URL pública ou null em caso de erro.
 * @param {string} base64  - data:image/...;base64,...
 * @param {string} pasta   - "perfis" | "criancas"
 * @param {string} nomeArq - nome único do arquivo, ex: uuid.jpg
 */
async function uploadFoto(base64, pasta, nomeArq) {
    if (!base64 || !base64.startsWith('data:')) return null;
    try {
        const blob = _base64ToBlob(base64);
        const path = `${pasta}/${nomeArq}`;
        const { error } = await _db.storage
            .from('fotos')
            .upload(path, blob, { upsert: true, contentType: blob.type });
        if (error) { console.error('uploadFoto:', error.message); return null; }
        const { data } = _db.storage.from('fotos').getPublicUrl(path);
        return data.publicUrl;
    } catch (e) {
        console.error('uploadFoto exception:', e);
        return null;
    }
}

/** Remove uma foto do Storage dado o path ou URL pública. */
async function removerFoto(pathOuUrl) {
    if (!pathOuUrl) return;
    const path = pathOuUrl.includes('/fotos/')
        ? pathOuUrl.split('/fotos/')[1]
        : pathOuUrl;
    await _db.storage.from('fotos').remove([path]);
}


// ============================================================
// HELPERS DE DADOS — Perfis (usuários)
// ============================================================

/** Retorna todos os perfis ordenados por usuário. */
async function dbGetUsuarios() {
    const { data, error } = await _db.from('perfis').select('*').order('usuario');
    if (error) throw error;
    return data;
}

/** Busca um perfil pelo campo "usuario" (login). */
async function dbGetUsuario(login) {
    const { data, error } = await _db
        .from('perfis').select('*').eq('usuario', login).maybeSingle();
    if (error) throw error;
    return data;
}

/** Autentica: busca perfil por login + senha. Retorna o objeto ou null. */
async function dbAutenticar(login, senha) {
    const { data, error } = await _db
        .from('perfis').select('*')
        .eq('usuario', login).eq('senha', senha)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** Insere um novo perfil. Lança erro se o login já existir. */
async function dbInserirUsuario(obj) {
    const { data, error } = await _db.from('perfis').insert(obj).select().single();
    if (error) throw error;
    return data;
}

/** Atualiza campos de um perfil pelo id UUID. */
async function dbAtualizarUsuario(id, campos) {
    const { error } = await _db.from('perfis').update(campos).eq('id', id);
    if (error) throw error;
}

/** Remove um perfil pelo id UUID. */
async function dbRemoverUsuario(id) {
    const { error } = await _db.from('perfis').delete().eq('id', id);
    if (error) throw error;
}


// ============================================================
// HELPERS DE DADOS — Crianças
// ============================================================

/** Retorna todas as crianças ordenadas por nome. */
async function dbGetTodasCriancas() {
    const { data, error } = await _db
        .from('criancas').select('*').order('nome');
    if (error) throw error;
    return data;
}

/** Retorna as crianças de um responsável pelo id UUID. */
async function dbGetCriancasDoResponsavel(responsavelId) {
    const { data, error } = await _db
        .from('criancas').select('*')
        .eq('responsavel_id', responsavelId).order('nome');
    if (error) throw error;
    return data;
}

/** Busca uma criança pelo id UUID. */
async function dbGetCrianca(id) {
    const { data, error } = await _db
        .from('criancas').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
}

/** Insere uma nova criança. */
async function dbInserirCrianca(obj) {
    const { data, error } = await _db.from('criancas').insert(obj).select().single();
    if (error) throw error;
    return data;
}

/** Atualiza campos de uma criança pelo id UUID. */
async function dbAtualizarCrianca(id, campos) {
    const { error } = await _db.from('criancas').update(campos).eq('id', id);
    if (error) throw error;
}

/** Remove uma criança pelo id UUID. */
async function dbRemoverCrianca(id) {
    const { error } = await _db.from('criancas').delete().eq('id', id);
    if (error) throw error;
}
