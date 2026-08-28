-- Agenda comercial integrada ao dashboard.
-- Compatível com leads existentes e seguro para reaplicação.

begin;

alter table public.leads
  add column if not exists proxima_tipo text default 'Follow-up',
  add column if not exists proxima_hora time without time zone;

update public.leads
set proxima_tipo = 'Follow-up'
where proxima is not null
  and (proxima_tipo is null or btrim(proxima_tipo) = '');

do $$
begin
  alter table public.leads
    add constraint leads_proxima_tipo_check
    check (proxima_tipo is null or proxima_tipo in ('Follow-up','Visita','Ligação','Reunião','Demonstração','WhatsApp','Proposta','Outro'))
    not valid;
exception
  when duplicate_object then null;
end
$$;

alter table public.leads validate constraint leads_proxima_tipo_check;

create index if not exists leads_agenda_comercial_idx
  on public.leads (proxima, proxima_hora)
  where proxima is not null and convertido = false;

comment on column public.leads.proxima_tipo is 'Tipo do próximo compromisso comercial exibido na agenda.';
comment on column public.leads.proxima_hora is 'Horário local do próximo compromisso comercial.';

commit;
