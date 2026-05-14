# Revisão de Segurança e Mobile — ContaFácil

## Correções aplicadas

### Autenticação e autorização
- Validação do token Firebase no backend com verificação de revogação.
- Manutenção do controle de escopo por empresa em clientes, honorários, recibos, relatórios, usuários, agenda e notificações.
- Regras administrativas preservadas para exclusões, assistentes e empresa.

### Proteções de entrada e abuso
- Regras Zod mais rígidas para documentos, telefones, datas, horários, valores, logotipos e textos.
- Limite do corpo das requisições reduzido para 3MB.
- Limitador simples de requisições por IP na rota `/api/trpc`.

### Cabeçalhos e navegador
- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: DENY`.
- `Referrer-Policy`.
- `Permissions-Policy`.
- `Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy`.
- HSTS e CSP em produção.

### Firestore e dados
- `firestore.rules` com bloqueio total de acesso direto do cliente ao banco, porque o sistema trabalha via backend com Admin SDK.
- `firebase.json` incluído para facilitar deploy das regras.

### PDF e arquivos
- Removida a possibilidade de o gerador de recibo fazer `fetch` para URLs arbitrárias de logotipo.
- Logotipo aceito somente como Data URL PNG/JPG validado.
- Rota pública de proxy de arquivos removida do servidor ativo; o helper legado permanece fora do fluxo exposto.
- Endpoint administrativo legado de notificação externa removido do roteador do sistema.

### Privacidade no frontend
- Removido armazenamento local desnecessário do objeto do usuário.

## Otimizações mobile aplicadas
- Conteúdo principal com padding responsivo.
- Modais scrolláveis em telas pequenas.
- Notificações adaptadas à largura do celular.
- Honorários, Relatórios e Assistentes com cards móveis, mantendo tabelas no desktop.
- Dashboard e controles da agenda ajustados para melhor quebra de linha.
- Prevenção de overflow horizontal indevido no layout geral.

## Observações
- Esta revisão reduz riscos comuns e fortalece a base do projeto, mas não substitui um pentest formal em ambiente publicado.
- Antes do deploy, publique as regras do Firestore e teste o fluxo real em produção com HTTPS.
