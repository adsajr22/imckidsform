-- ============================================================
-- IMC Kids — Schema Supabase
-- Cole este arquivo no SQL Editor do Supabase e clique em Run.
--
-- Estrutura:
--   • perfis     → todos os usuários (admin, responsáveis, professoras)
--   • criancas   → crianças vinculadas a um responsável
--
-- ⚠️  FOTOS: o campo foto_url deve armazenar o caminho do arquivo
--     no Supabase Storage (bucket "fotos"), não base64.
--     Base64 ocupa muito espaço no banco e deixa tudo lento.
-- ============================================================


-- ============================================================
-- TABELA: perfis
-- ============================================================
create table if not exists public.perfis (

    -- Identificação
    id              uuid primary key default gen_random_uuid(),
    usuario         text not null unique,            -- login (ex: "joao.silva")
    senha           text not null,                   -- ⚠️ use bcrypt/hash — NUNCA texto puro em produção
    perfil          text not null
                        default 'usuario'
                        check (perfil in ('admin', 'usuario', 'professora')),

    -- Dados pessoais
    nome            text,
    data_nascimento date,
    sexo            text check (sexo in ('Masculino', 'Feminino', 'Outro')),

    -- Documento (CPF ou RG — apenas um por vez)
    tipo_doc        text check (tipo_doc in ('cpf', 'rg')),
    cpf             text,
    rg              text,

    -- Contato
    telefone        text,
    email           text,

    -- Foto (caminho no Supabase Storage, ex: "fotos/perfis/uuid.jpg")
    foto_url        text,

    -- Endereço (desnormalizado para manter a simplicidade do projeto)
    end_cep         text,
    end_logradouro  text,
    end_numero      text,
    end_complemento text,
    end_bairro      text,
    end_cidade      text,
    end_estado      char(2),                         -- ex: "SP", "RJ"

    -- Controle
    criado_em       timestamptz not null default now(),
    atualizado_em   timestamptz not null default now()
);

comment on table  public.perfis              is 'Usuários do sistema: administradores, responsáveis e professoras.';
comment on column public.perfis.perfil       is 'admin = painel admin | usuario = pai/mãe/responsável | professora = área das professoras';
comment on column public.perfis.foto_url     is 'Caminho no bucket "fotos" do Supabase Storage. Não armazene base64 aqui.';


-- ============================================================
-- TABELA: criancas
-- ============================================================
create table if not exists public.criancas (

    -- Identificação
    id                  uuid primary key default gen_random_uuid(),

    -- Vínculo com o responsável
    responsavel_id      uuid not null
                            references public.perfis(id)
                            on delete cascade,       -- remove filhos ao deletar o responsável
    parentesco          text,                        -- ex: "Pai", "Mãe", "Avó"

    -- Turma calculada pela idade
    turma               text check (turma in ('Kids', 'Juniores')),  -- Kids: 3–6 | Juniores: 7–11

    -- Dados da criança
    nome                text not null,
    data_nascimento     date not null,
    sexo                text check (sexo in ('Masculino', 'Feminino', 'Outro')),
    cpf                 text,
    foto_url            text,                        -- caminho no Supabase Storage

    -- Dados de saúde (todos opcionais)
    saude_doencas       text,
    saude_alergias      text,
    saude_comorbidades  text,
    saude_medicamentos  text,
    saude_observacoes   text,

    -- Controle
    data_registro       timestamptz not null default now(),
    atualizado_em       timestamptz not null default now()
);

comment on table  public.criancas                is 'Crianças cadastradas pelos responsáveis.';
comment on column public.criancas.turma          is 'Calculada automaticamente pela data de nascimento: Kids (3–6 anos) ou Juniores (7–11 anos).';
comment on column public.criancas.responsavel_id is 'FK para perfis.id — identifica quem cadastrou a criança.';


-- ============================================================
-- ÍNDICES — aceleram consultas frequentes
-- ============================================================
create index if not exists idx_criancas_responsavel on public.criancas(responsavel_id);
create index if not exists idx_criancas_turma       on public.criancas(turma);
create index if not exists idx_perfis_perfil        on public.perfis(perfil);


-- ============================================================
-- TRIGGER: mantém atualizado_em sempre atualizado
-- ============================================================
create or replace function public.fn_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
    new.atualizado_em = now();
    return new;
end;
$$;

create or replace trigger trg_perfis_atualizado_em
    before update on public.perfis
    for each row execute function public.fn_set_atualizado_em();

create or replace trigger trg_criancas_atualizado_em
    before update on public.criancas
    for each row execute function public.fn_set_atualizado_em();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
--
-- Este projeto usa autenticação própria (não o Supabase Auth),
-- então as políticas abaixo liberam o acesso para a chave anon.
-- O controle de acesso é feito pela aplicação (login, sessão).
--
-- ⚠️  Se no futuro migrar para o Supabase Auth (recomendado),
--     substitua "true" por "auth.uid() is not null" e adicione
--     filtros por auth.uid() nas políticas de select/update/delete.
-- ============================================================
alter table public.perfis   enable row level security;
alter table public.criancas enable row level security;


-- ── Políticas para PERFIS ──────────────────────────────────
-- Usar policies separadas por operação evita recursão infinita no Supabase.

drop policy if exists "Perfil: anon faz tudo"  on public.perfis;
drop policy if exists "Perfil: anon select"    on public.perfis;
drop policy if exists "Perfil: anon insert"    on public.perfis;
drop policy if exists "Perfil: anon update"    on public.perfis;
drop policy if exists "Perfil: anon delete"    on public.perfis;

create policy "Perfil: anon select" on public.perfis for select to anon using (true);
create policy "Perfil: anon insert" on public.perfis for insert to anon with check (true);
create policy "Perfil: anon update" on public.perfis for update to anon using (true) with check (true);
create policy "Perfil: anon delete" on public.perfis for delete to anon using (true);


-- ── Políticas para CRIANÇAS ───────────────────────────────

drop policy if exists "Criança: anon faz tudo"  on public.criancas;
drop policy if exists "Criança: anon select"    on public.criancas;
drop policy if exists "Criança: anon insert"    on public.criancas;
drop policy if exists "Criança: anon update"    on public.criancas;
drop policy if exists "Criança: anon delete"    on public.criancas;

create policy "Criança: anon select" on public.criancas for select to anon using (true);
create policy "Criança: anon insert" on public.criancas for insert to anon with check (true);
create policy "Criança: anon update" on public.criancas for update to anon using (true) with check (true);
create policy "Criança: anon delete" on public.criancas for delete to anon using (true);


-- ============================================================
-- DADOS INICIAIS — admin padrão para o primeiro acesso
-- ⚠️  Troque a senha ANTES de subir para produção!
-- ============================================================
insert into public.perfis (usuario, senha, perfil)
values ('admin', 'admin123', 'admin')
on conflict (usuario) do update set senha = 'admin123', perfil = 'admin';


-- ============================================================
-- STORAGE — Bucket para fotos
-- Execute este trecho separadamente no SQL Editor do Supabase
-- OU crie o bucket manualmente em Storage > New bucket.
-- ============================================================

-- insert into storage.buckets (id, name, public)
-- values ('fotos', 'fotos', false)
-- on conflict do nothing;

-- Política de storage: apenas o dono do arquivo pode ler/enviar
-- create policy "Storage: upload próprio"
--   on storage.objects for insert
--   with check (bucket_id = 'fotos');
--
-- create policy "Storage: leitura própria"
--   on storage.objects for select
--   using (bucket_id = 'fotos');
