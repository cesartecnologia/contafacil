# Sistema de Gestão de Honorários Contábeis - TODO

## Fase 1: Estrutura Base e Autenticação
- [x] Configurar autenticação obrigatória com Firebase Authentication
- [x] Proteger todas as rotas (sem acesso sem login)
- [x] Criar páginas de login e cadastro com Firebase Authentication

## Fase 2: Banco de Dados e Modelos
- [x] Migrar persistência para Firebase Firestore
- [x] Criar tabela de empresas (razão social, CNPJ, endereço, telefone, logo_url)
- [x] Criar tabela de clientes (nome, CPF/CNPJ, email, telefone, endereço, honorário_mensal, regime tributário)
- [x] Criar tabela de honorários (cliente_id, competência, valor, status, data_vencimento)
- [x] Criar tabela de notificações (usuário_id, tipo, mensagem, lido)
- [x] Criar tabela/coleção de agenda por usuário
- [x] Estender tabela de assistentes com role (admin/user) e empresa_id

## Fase 3: Layout Principal e Sidebar
- [x] Implementar DashboardLayout com sidebar elegante
- [x] Criar navegação entre módulos
- [x] Adicionar saudação personalizada do usuário logado
- [x] Implementar logout

## Fase 4: Dashboard Interativo
- [x] Calcular total recebido no mês
- [x] Calcular clientes ativos
- [x] Calcular honorários pendentes
- [x] Calcular honorários vencidos
- [x] Criar gráfico de evolução mensal
- [x] Exibir cards com resumo financeiro
- [x] Implementar filtros por período

## Fase 5: Módulo de Clientes
- [x] Criar página de listagem de clientes
- [x] Implementar modal de cadastro de cliente
- [x] Implementar modal de edição de cliente
- [x] Implementar exclusão de cliente
- [x] Validar campos (CPF/CNPJ, email, telefone)
- [x] Exibir clientes em cards elegantes

## Fase 6: Gestão de Honorários
- [x] Criar página de honorários
- [x] Implementar registro de competência
- [x] Implementar registro de valor e data de vencimento
- [x] Criar sistema de status (pendente/pago/vencido)
- [x] Implementar modal de registro de honorário
- [x] Implementar edição de honorário
- [x] Implementar marcação como pago

## Fase 7: Geração de Recibos em PDF
- [x] Implementar biblioteca de geração de PDF real
- [x] Criar template de recibo com dados da empresa
- [x] Incluir logo da empresa no recibo
- [x] Incluir dados do cliente
- [x] Incluir valor por extenso
- [x] Incluir competência e data de vencimento
- [x] Incluir campo de assinatura
- [x] Implementar botão de download de recibo
- [x] Implementar envio via WhatsApp com link wa.me +55

## Fase 8: Área da Empresa
- [x] Criar página de configuração da empresa
- [x] Implementar cadastro de razão social
- [x] Implementar cadastro de CNPJ
- [x] Implementar cadastro de endereço
- [x] Implementar cadastro de telefone
- [x] Implementar upload de logotipo salvo na empresa
- [x] Exibir preview do logotipo
- [x] Salvar dados da empresa no banco

## Fase 9: Relatórios Financeiros
- [x] Criar página de relatórios
- [x] Implementar filtro por período
- [x] Implementar filtro por cliente
- [x] Implementar filtro por status
- [x] Criar tabela de relatório
- [x] Implementar exportação em CSV
- [x] Implementar exportação em PDF
- [x] Implementar gráficos de resumo

## Fase 10: Sistema de Notificações
- [x] Criar tabela/coleção de notificações
- [x] Implementar lógica de alertas de vencimento próximo
- [x] Implementar lógica de alertas de atraso
- [x] Criar painel de notificações
- [x] Implementar marcação como lido
- [x] Exibir notificações no dashboard

## Fase 11: Gestão de Assistentes e Controle de Acesso
- [x] Implementar criação de assistentes (admin only)
- [x] Implementar edição de assistentes (admin only)
- [x] Implementar exclusão de assistentes (admin only)
- [x] Implementar atribuição de roles (admin/user)
- [x] Proteger rotas por role
- [x] Proteger operações por role (criar, editar, deletar)
- [x] Criar página de gerenciamento de assistentes (admin only)

## Fase 12: Agenda Individual
- [x] Criar agenda semanal por usuário
- [x] Reservar horários de 30 em 30 minutos das 08h às 17h30
- [x] Criar modal de agendamento
- [x] Criar detalhes, cancelamento e remarcação
- [x] Integrar agenda às notificações

## Fase 13: Design e Refinamento
- [ ] Aplicar design elegante e sofisticado
- [ ] Revisar tipografia e cores
- [ ] Implementar animações suaves
- [ ] Testar responsividade
- [ ] Testar acessibilidade
- [ ] Revisar UX em todos os módulos

## Fase 14: Testes e Deploy
- [ ] Escrever testes unitários (vitest)
- [ ] Testar fluxos principais
- [ ] Revisar segurança
- [ ] Preparar para deploy no Vercel
- [ ] Criar checkpoint final
- [ ] Deploy

---

## Notas Importantes
- Login obrigatório em todas as funcionalidades
- PDF real (não screenshot)
- Logo da empresa em todos os recibos
- Valor por extenso em recibos
- Dois perfis: admin e usuário padrão
- Design elegante e refinado
- Notificações internas para vencimentos e atrasos
