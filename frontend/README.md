# LicitaCRT — Plataforma de Gestão Contratual e Financeira (CRT-08)

Ferramenta interna de controle gerencial do ciclo de execução dos contratos
administrativos. O processo e os documentos oficiais permanecem no **SEI**;
a plataforma guarda o acompanhamento, os alertas, a consolidação financeira,
o histórico e os relatórios, sempre com referência ao processo/documento SEI.

Stack: Vite + React 19 + Bootstrap 5 + Supabase (Auth + Postgres).

## Como colocar para rodar

1. `cp .env.example .env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
2. Prepare o banco seguindo o [README do backend](../backend/README.md) (migrations e verificação no SQL Editor do Supabase).
3. Em Authentication → URL Configuration, inclua em *Redirect URLs* o endereço do sistema e `<endereço>/redefinir-senha`.
4. `npm install && npm run dev`.
5. Em **Usuários** (admin), atribua o perfil de cada pessoa. Quem tem login mas não tem perfil ativo vê a tela "Acesso não liberado" e não lê nenhum dado.

> Sem a migration, as telas de gestão contratual exibem um aviso em vez de dados.

## Modo demonstração (sem banco)

`npm run demo` abre o sistema completo em `http://127.0.0.1:5174` com **dados fictícios em memória**
(`demo/dados.js`), sem tocar no Supabase — para apresentar telas, treinar perfis ou revisar o visual.
Uma faixa no canto inferior troca o perfil (Gestão, Fiscal titular, Fiscal substituto, Compras,
Financeiro, Gabinete, Administrador, Visualizador). Também aceita `?perfil=` e `?tema=escuro` na URL
(`?captura` esconde a faixa). Recarregar a página volta aos dados iniciais. O `npm run build` não inclui
nada da pasta `demo/`.

## Interface

- **Navegação por módulos**: o trilho escuro à esquerda mostra só os módulos do perfil
  (Mesa, Contratações/Fiscalização, Financeiro, Licitações, Gabinete, Administração) e o menu ao lado,
  só as telas do módulo aberto (`modulosFor` em `src/utils/permissions.js`).
- **Minha mesa** (`/mesa`): tela inicial de Gestão, Fiscal, Financeiro e Compras, com o que aguarda
  a atuação da pessoa, separado em Urgente / Atenção / Para acompanhar.
- Identidade visual em `src/styles/tema.css` (tokens de cor da marca CRT-08, IBM Plex servida pelo próprio
  sistema, ajustes do Bootstrap e tema escuro) e `src/styles/componentes.css` (carimbos de status,
  indicadores, abas, legenda da ficha, régua de etapas, lista de tarefas).

## Testes

```
npm test               # regras de negócio e telas
npm run test:coverage  # com cobertura
```

- `tests/unit` — regras de negócio (saldos, status, alertas, permissões, importação, serviços).
- `tests/components` — formulários, rotas por perfil, login e telas de processos (jsdom).

Os testes não leem o `.env` (usam `tests/env/.env.test`) e bloqueiam qualquer acesso à rede.
Os testes do banco (RLS, triggers, migrations) ficam em [`../backend`](../backend/README.md).

## Perfis e permissões

A entidade principal é a **contratação** (contrato, nota de empenho ou outro instrumento).

| Perfil | Tela inicial | Pode |
|---|---|---|
| **Compras** (`compras`; o antigo `editor` é tratado como Compras) | Minha mesa | Cadastrar a contratação e **encaminhar à Gestão** (gera a solicitação de fiscais e a de OS/OC). Depois disso, só consulta. |
| **Gestão de contratos** (`gestor`) | Minha mesa | Receber a contratação, designar fiscal titular e substituto, portaria, termo de ciência, OS/OC, conferir competências, devolver ao fiscal ou liberar ao Financeiro, eventos, ocorrências e pendências. **Não** registra NF nem atesta. |
| **Fiscal** (`fiscal`) | Minha mesa | Vê **só as contratações em que está designado**. Recebe a NF, registra a competência, fiscaliza, registra ocorrência e glosa, confere a documentação e **atesta**. O substituto atua quando acionado ("Fiscal substituto em atuação"). |
| **Financeiro** (`financeiro`) | Minha mesa | Empenhos, reforços/anulações, liquidação, pagamento e saldos — só de competências liberadas pela Gestão. |
| **Gabinete** (`gabinete`) | Atos para assinatura | Vê só os atos encaminhados: registra a publicação da portaria e as assinaturas da OS/OC. |
| **Administrador** (`admin`) | Minha mesa (de todos) | Tudo, mais usuários e parâmetros. |
| Visualizador (`viewer`) | Home | Somente consulta. |

As regras estão em `src/utils/permissions.js` (interface) e **também no banco**
(RLS + triggers nas migrations), então não dependem do navegador.

## Fluxo entre os setores

```
COMPRAS     contrato assinado ou nota de empenho emitida → cadastra a contratação
            → ENCAMINHA PARA GESTÃO (solicita fiscais + OS/OC)
GESTÃO      recebe → designa fiscal titular e substituto → portaria (minuta)
GABINETE    assinatura/publicação da portaria → "fiscalização designada"
GESTÃO      termo de ciência e aceite → "fiscalização formalizada" → OS/OC (rascunho)
GABINETE    assinatura do Presidente e do Diretor Financeiro
GESTÃO      envio à contratada → recebimento registrado → EM EXECUÇÃO
FISCAL      recebe a NF (PARA o fiscal titular, CC a Gestão) → registra a competência
            → fiscaliza → ocorrência/glosa → documentação → ATESTO
GESTÃO      confere o fluxo (não refaz a fiscalização) → devolve ao fiscal ou LIBERA
FINANCEIRO  empenho → liquidação → pagamento → saldos atualizados
```

A **vez de cada setor** é derivada do estado (`etapaContratacao` e `statusCompetencia`
em `src/utils/contrato.js`) e aparece nos alertas por perfil — para o fiscal, só
o que é dele quando está em atuação —, na *Minha mesa*, em *Competências → "Minha vez"* e nos painéis.

Status automático da competência: Aguardando nota fiscal → NF recebida — aguardando
fiscalização → Fiscalizada — aguardando atesto → Atestada — aguardando Gestão →
Aguardando liquidação → Liquidada — aguardando pagamento → Paga (+ sinalizadores
"Com ocorrência", "Com glosa" e "Devolvida pela Gestão").

Documentos gerados para o SEI (botões nas telas): portaria de designação, termo de
ciência e aceite, OS/OC (com a orientação de envio da NF) e atesto — `src/utils/documentos.js`.
Os e-mails de tarefa ("Existe uma nova tarefa aguardando sua atuação") saem da fila
`gc_notificacoes` pela Edge Function descrita no [README do backend](../backend/README.md).

## Mapa escopo → implementação

| Escopo | Onde |
|---|---|
| §3 Cadastro mestre | `gc_contratos`, `gc_responsaveis` · ficha do contrato → aba *Cadastro* |
| §4 Ordem de serviço | `gc_ordens_servico` · *Ordens de serviço* e aba *OS* |
| §5 Acompanhamento mensal | `gc_competencias` (único por contrato+mês) · *Competências* |
| §6–7 Empenhos e execução financeira | `gc_empenhos`, `gc_empenho_movs`, `gc_execucoes` · *Painel financeiro* e aba *Financeiro* |
| §8 Saldos distintos | `consolidar()` em `src/utils/contrato.js` — nunca um "saldo" único |
| §9 Eventos contratuais | `gc_eventos` · aba *Eventos*; ao concluir, valor e vigência vigentes são recalculados |
| §10 Ocorrências | `gc_ocorrencias` · aba *Ocorrências* |
| §11 Dossiê/índice SEI | `gc_documentos` + índice automático dos SEI citados nos lançamentos |
| §12 Alertas | `gerarAlertas()` · *Alertas* (limiares configuráveis em *Parâmetros*) |
| §13–14 Painéis | *Painel da gestão* e *Painel financeiro* |
| §15 Auditoria | triggers gravam `gc_auditoria` (usuário, data/hora, antes/depois); **não há exclusão** — registros são cancelados |
| §16 Pesquisa e relatórios | *Contratos* (filtros) e *Relatórios* (12 relatórios, Excel/PDF, individual imprimível) |
| §18 Tela única | `ContratoFicha` — legenda com o essencial (contratada, SEI, vigência, valor, gestão, fiscal) e a aba *Visão geral* com alertas, competências recentes, prazos e composição financeira |

## Decisões de modelagem

- **Nada derivado é gravado.** Valor atualizado, vigência vigente, saldos,
  status das competências e alertas são recalculados dos lançamentos; assim
  não há divergência entre telas.
- **Valor atualizado** = valor inicial + (valor posterior − anterior) dos
  eventos *concluídos*. Vigência vigente = última `vigencia_posterior` concluída.
- **Saldo do contrato** = valor atualizado − o que já foi comprometido: com OS/OC *dada* (assinada)
  e com valor, abate-se o valor das ordens; sem elas, abate-se o que o Financeiro **liquidou**. Os dois
  critérios não se somam (`consolidar()` → `saldoExecucao`, `saldoBase`).
- **Executado reconhecido** = valor líquido (NF/medição − glosa) das competências
  atestadas. **Saldo do empenho** = inicial + reforços − anulações − liquidado.
  **Pendente de pagamento** = liquidado − retenções − pago.
- **Atesto**: quem atesta é parâmetro (`atesto_por`: fiscal ou gestor), pois o
  escopo deixa "conforme fluxo definido".

## Fora do escopo desta entrega

- Anexar arquivos (o dossiê é índice de nº SEI/link, como previsto no escopo).
- Geração automática da minuta da OS (previsto como evolução futura).
- Notificações por e-mail/WhatsApp: os alertas são calculados e exibidos na
  plataforma; o envio externo exigiria uma rotina agendada (Supabase Edge Function).
- A importação por planilha da tela de Contratos foi retirada — a migration
  importa os contratos legados; novos cadastros entram pelo formulário.
