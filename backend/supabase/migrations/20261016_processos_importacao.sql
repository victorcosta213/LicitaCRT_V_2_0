-- Campos da planilha de importação de processos licitatórios
-- (numero do Processo | Situação no SEI | nome do Processo | Unidade Demandante |
--  Modalidade | Valor Estimado (R$) | Prioridade | Fase Atual)
alter table public.processos add column if not exists situacao_sei       text;
alter table public.processos add column if not exists unidade_demandante text;
alter table public.processos add column if not exists modalidade         text;
alter table public.processos add column if not exists valor_estimado     numeric(15,2);
