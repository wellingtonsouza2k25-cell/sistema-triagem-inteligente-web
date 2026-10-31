# Sistema de Triagem Inteligente

Sistema web acadêmico desenvolvido para apoiar a organização de pacientes e atendimentos em uma unidade de saúde. A aplicação permite cadastrar pacientes, registrar sintomas, acompanhar a fila, atualizar o andamento dos atendimentos e solicitar ao Gemini uma **sugestão experimental de prioridade**.

> **Aviso importante:** este projeto é um protótipo acadêmico. A sugestão gerada por inteligência artificial não é diagnóstico médico, não substitui protocolos oficiais de classificação de risco e não deve orientar decisões clínicas reais. A prioridade utilizada na fila deve ser revisada e confirmada por um profissional habilitado. Utilize somente dados fictícios nos testes e demonstrações.

## Funcionalidades

- Cadastro, consulta, atualização e exclusão de pacientes.
- Registro de atendimentos e sintomas associados a um paciente.
- Consulta dos atendimentos registrados.
- Controle de status: `Aguardando`, `Em atendimento` e `Finalizado`.
- Fila de espera organizada pela prioridade confirmada e pela ordem de registro.
- Sugestão experimental de prioridade pelo Gemini, armazenada separadamente da prioridade confirmada.
- Interface web com telas de cadastro, fila, histórico e relatórios.
- Painel independente para sala de espera.
- Painel independente para exibir o paciente chamado.
- Filtros no histórico e exportação dos atendimentos em CSV.
- Persistência local dos dados usando SQLite.

## Tecnologias

| Tecnologia | Utilização |
|---|---|
| Node.js | Ambiente de execução do backend |
| Express | Servidor HTTP e API REST |
| JavaScript | Regras do sistema e comunicação entre frontend e backend |
| HTML5 | Estrutura das páginas |
| CSS3 | Estilização e responsividade |
| SQLite | Armazenamento local dos pacientes e atendimentos |
| better-sqlite3 | Acesso ao banco SQLite |
| Google Gemini API (`@google/genai`) | Geração de sugestões experimentais a partir dos sintomas informados |
| dotenv | Leitura de variáveis de ambiente |

## Estrutura do projeto

```text
triagem-web-js/
├── public/
│   ├── index.html       # Interface principal
│   ├── style.css        # Estilos da interface principal
│   ├── script.js        # Interações e chamadas à API
│   ├── painel.html      # Painel da sala de espera
│   ├── painel.css       # Estilos dos painéis auxiliares
│   ├── painel.js        # Atualização da sala de espera
│   ├── chamada.html     # Tela de chamada do paciente
│   └── chamada.js       # Lógica do painel de chamada
├── database.js          # Criação e configuração do banco SQLite
├── server.js            # Servidor Express e rotas da API
├── package.json
├── package-lock.json
├── .env                 # Chaves e configurações locais (não versionar)
├── .gitignore
└── triagem.db           # Banco local criado durante a execução (não versionar)
```

> `node_modules/` é criado pelo npm durante a instalação das dependências e não deve ser enviado ao GitHub.

## Requisitos

- Node.js instalado.
- npm instalado (normalmente acompanha o Node.js).
- Chave de API do Google Gemini para utilizar a funcionalidade de sugestão por IA.

## Instalação e execução

1. Clone o repositório:

   ```bash
   git clone 
   ```

2. Entre na pasta do projeto:

   ```bash
   cd triagem-web-js
   ```

3. Instale as dependências:

   ```bash
   npm install
   ```

4. Crie um arquivo `.env` na raiz do projeto, no mesmo nível de `server.js`, e configure sua chave:

   ```env
   GEMINI_API_KEY=sua_chave_do_gemini
   ```

   Não coloque a chave diretamente no código-fonte e não compartilhe o arquivo `.env`.

5. Inicie o servidor:

   ```bash
   node server.js
   ```

6. Acesse a aplicação no navegador:

   ```text
   http://localhost:3000
   ```

O banco `triagem.db` é utilizado localmente pelo sistema. Faça cópias de segurança antes de qualquer alteração estrutural ou manutenção manual do banco.

## Telas da aplicação

- **Cadastro de paciente:** dados básicos, seleção de sintomas, relato, sinais físicos e observações.
- **Fila de atendimento:** visualização dos atendimentos ativos, prioridades, status, tempo de espera e ações de chamada/finalização.
- **Histórico:** consulta dos registros com filtros disponíveis na interface.
- **Relatórios e estatísticas:** indicadores calculados a partir dos registros existentes e exportação CSV.
- **Painel da sala de espera:** página independente com atualização periódica da fila.
- **Painel de chamada:** página independente para exibir o paciente chamado.

## Rotas da API

As rotas abaixo são disponibilizadas pelo servidor Express:

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/status` | Verifica se a API está online |
| `GET` | `/api/pacientes` | Lista pacientes |
| `POST` | `/api/pacientes` | Cadastra um paciente |
| `GET` | `/api/pacientes/:id` | Consulta um paciente pelo ID |
| `PUT` | `/api/pacientes/:id` | Atualiza os dados básicos de um paciente |
| `DELETE` | `/api/pacientes/:id` | Exclui um paciente, se não houver vínculo que impeça a operação |
| `POST` | `/api/atendimentos` | Registra um atendimento e seus sintomas |
| `GET` | `/api/atendimentos` | Lista os atendimentos com o nome do paciente |
| `GET` | `/api/fila` | Consulta a fila de atendimentos aguardando |
| `PATCH` | `/api/atendimentos/:id/status` | Atualiza o status de um atendimento |
| `PATCH` | `/api/atendimentos/:id/prioridade` | Atualiza a prioridade confirmada |
| `GET` | `/api/ia/teste` | Testa a comunicação com o Gemini |
| `POST` | `/api/atendimentos/:id/sugerir-prioridade` | Solicita uma sugestão experimental de prioridade ao Gemini |

### Prioridade sugerida e prioridade confirmada

O sistema mantém dois conceitos separados:

- `prioridade_sugerida`: resultado retornado pela integração com o Gemini.
- `prioridade`: prioridade registrada/confirmada e utilizada na organização da fila.

A resposta da IA não deve alterar automaticamente a prioridade confirmada. A revisão e a confirmação são responsabilidades do profissional habilitado, conforme os protocolos aplicáveis.

## Segurança e privacidade

- O arquivo `.env` contém a chave de API e não deve ser enviado ao GitHub.
- O banco local `triagem.db` e a pasta `node_modules/` também devem permanecer fora do repositório.
- O `.gitignore` deve conter, no mínimo:

  ```gitignore
  node_modules/
  .env
  *.db
  ```

- Não utilize dados pessoais ou informações reais de pacientes em testes, capturas de tela ou demonstrações acadêmicas.
- Se uma chave de API tiver sido publicada por engano, revogue-a no serviço correspondente e gere outra.

## Testes

As rotas podem ser testadas com Postman ou outra ferramenta HTTP. Para a demonstração, recomenda-se utilizar pacientes e sintomas fictícios e verificar:

1. Cadastro e consulta de pacientes.
2. Registro e consulta de atendimentos.
3. Atualização de status e prioridade confirmada.
4. Ordenação e atualização da fila.
5. Geração e armazenamento da sugestão do Gemini, quando o serviço estiver disponível.
6. Persistência dos dados após reiniciar o servidor.
7. Atualização dos painéis, histórico e relatórios.

A API do Gemini pode apresentar indisponibilidade ou limite de uso. Nesses casos, as funções que não dependem da IA devem continuar disponíveis.

## Projeto acadêmico

**Disciplina:** Projeto Integrador III  
**Curso:** Análise e Desenvolvimento de Sistemas (ADS)  
**Instituição:** Universidade Estadual da Paraíba (UEPB)  
**Integrantes:** Wellington Souza, Gabriel dos Santos, Junior Vasconcelos, Mayalison

---

Projeto desenvolvido para fins acadêmicos.
