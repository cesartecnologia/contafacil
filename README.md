# Sistema de Gestão de Honorários Contábeis

Sistema React + Express + tRPC para gestão de honorários contábeis, clientes, empresa, recibos em PDF, relatórios, notificações internas e assistentes por empresa.

## Arquitetura atual

- **Frontend:** React + Vite
- **Backend:** Express + tRPC
- **Banco:** Firebase Firestore
- **Autenticação:** Firebase Authentication com e-mail e senha
- **Validação no servidor:** Firebase Admin SDK verificando o ID Token enviado pelo frontend

## Banco de dados

A persistência foi migrada para **Firebase Firestore**. O projeto não usa mais MySQL.

### Coleções criadas no Firestore

- `users`
- `companies`
- `clients`
- `fees`
- `notifications`
- `appointments`
- `counters`

A coleção `counters` mantém IDs numéricos sequenciais para preservar compatibilidade com as telas existentes.

## Autenticação Firebase

O sistema agora usa **Firebase Authentication** com **E-mail/Senha**.

### Fluxo de acesso

1. O usuário cria conta em `/register`.
2. Após criar a conta, o usuário já pode acessar o sistema.
3. O frontend autentica no Firebase Auth.
4. O frontend envia o **ID Token** em `Authorization: Bearer <token>` para o backend.
5. O backend valida esse token com o Firebase Admin SDK.
6. O usuário é sincronizado na coleção `users` do Firestore.
7. O acesso às empresas e permissões continua controlado pela coleção `users`.

### Primeiro administrador

O usuário que cadastrar a **primeira empresa** é promovido automaticamente para **Administrador** daquela empresa.

A variável `OWNER_EMAIL` é opcional: quando preenchida, esse e-mail já entra com perfil administrativo mesmo antes da criação da empresa.

### Assistentes adicionados pelo administrador

A tela de assistentes continua funcionando por pré-autorização:

1. O administrador informa nome, e-mail e cargo.
2. O sistema grava o usuário como pré-autorizado no Firestore.
3. Quando a pessoa criar conta ou entrar com o mesmo e-mail, a conta Firebase Auth é vinculada automaticamente à empresa.

## Variáveis obrigatórias

Crie um `.env.local` a partir do `.env.example` para rodar localmente.

```env
# Firebase Admin SDK - backend/Firestore/Auth token validation
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE\n-----END PRIVATE KEY-----\n"

# Firebase Web SDK - frontend/Auth
VITE_FIREBASE_API_KEY=sua_api_key_web
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000

# Administrador opcional pré-definido
OWNER_EMAIL=admin@empresa.com
```

No Firebase Console:

1. Ative **Authentication → Sign-in method → Email/Password**.
2. Crie o **Firestore Database**.
3. Gere uma chave de conta de serviço em **Configurações do projeto → Contas de serviço → Gerar nova chave privada**.
4. Copie a configuração Web do app Firebase para as variáveis `VITE_FIREBASE_*`.

## Rodar localmente

```bash
npm install
npm run dev
```

A aplicação abre normalmente em:

```text
http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Funcionalidades concluídas nesta versão

- Migração da camada de dados para Firebase Firestore.
- Migração da autenticação para Firebase Authentication com e-mail e senha.
- Validação de tokens no backend com Firebase Admin SDK.
- Páginas próprias de login e cadastro.
- Recuperação de senha via Firebase Auth.
- Remoção da dependência do OAuth antigo no fluxo principal.
- Empresas, clientes, honorários, agenda, dashboard, relatórios e recibos usando Firestore.
- Edição de honorários.
- Marcação de honorário como pago com data de pagamento.
- Geração automática de número do recibo.
- Logo da empresa enviada para o recibo em formato PNG/JPG validado, sem requisições externas no servidor.
- Notificações internas de honorários próximos do vencimento e vencidos.
- Central de notificações na navegação e alertas no dashboard.
- Gestão de assistentes por administradores, com pré-autorização por e-mail.
- Vínculo automático do usuário pré-autorizado no primeiro login/cadastro com o e-mail cadastrado.
- Proteções de escopo por empresa no backend para clientes, honorários, relatórios, recibos, agenda e notificações.
- Título do projeto corrigido para **ContaFácil**.
- Identidade visual migrada do azul para o vermelho.
- Relatórios com exportação em **CSV e PDF**.
- Recibo redesenhado com aparência mais profissional.
- Ação de envio por WhatsApp via `wa.me/+55` com mensagem pronta para o cliente.
- Logotipo da empresa exibido na área superior da sidebar quando cadastrado.
- Ações de clientes, honorários e assistentes consolidadas em menu de três pontos.
- Clientes com regime tributário: MEI, Simples Nacional, Lucro Presumido e Lucro Real.
- Cards de clientes abrem detalhes completos da empresa.
- Filtros dos relatórios recolhidos em modal acionado por ícone.
- Exclusão de clientes e honorários restrita a administradores.
- Agenda individual semanal por usuário, com slots de 30 minutos das 08h às 17h30, cancelamento, remarcação e notificações.



## Reforços de segurança aplicados

- Tokens do Firebase Auth validados no backend com checagem de revogação.
- Cabeçalhos HTTP defensivos no servidor, incluindo HSTS em produção, anti-iframe, anti-MIME sniffing e política de permissões.
- Content Security Policy em produção para reduzir risco de injeção de scripts.
- Limite de payload reduzido para 3MB e limitador simples de requisições na API tRPC.
- Validação mais rígida de textos, documentos, valores, datas, horários, telefones e logotipo.
- Remoção de armazenamento local desnecessário de dados do usuário no navegador.
- Bloqueio de requisições externas arbitrárias durante a geração do recibo, evitando SSRF por URL de logotipo.
- Rota pública de proxy de arquivos removida do servidor ativo, reduzindo superfície de exposição.
- Endpoint administrativo legado de notificação externa removido do roteador público do sistema.
- Regra `firestore.rules` incluída para bloquear acesso direto do cliente ao banco; o sistema opera pelo backend com Firebase Admin SDK.

Para publicar as regras do Firestore no Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

## Ajustes mobile aplicados

- Layout principal com espaçamentos responsivos e prevenção de rolagem horizontal indevida.
- Modais com altura máxima dinâmica e rolagem interna em telas menores.
- Central de notificações adaptada para a largura do celular.
- Cards móveis para Honorários, Relatórios e Assistentes, evitando tabelas apertadas no telefone.
- Cabeçalho do dashboard, controles da agenda e área de conteúdo ajustados para telas compactas.
- Grade da agenda mantida navegável com rolagem horizontal assistida no mobile.
