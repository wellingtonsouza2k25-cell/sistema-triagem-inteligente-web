const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const db = require('./database');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

app.use(express.json({ limit: '1mb' }));

// Os arquivos do frontend ficam em /public.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function getAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
}

function validarId(valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function buscarAtendimento(id) {
    return db.prepare(`
        SELECT
            a.*,
            p.nome AS paciente_nome,
            p.idade AS idade,
            p.genero AS genero,
            p.documento AS documento,
            p.telefone AS telefone
        FROM atendimentos a
        INNER JOIN pacientes p ON p.id = a.paciente_id
        WHERE a.id = ?
    `).get(id);
}

// Status da API.
app.get('/api/status', (req, res) => {
    res.json({
        mensagem: 'Sistema de Triagem Inteligente funcionando!',
        status: 'online'
    });
});

// Lista pacientes.
app.get('/api/pacientes', (req, res) => {
    const pacientes = db.prepare(`
        SELECT id, nome, idade, genero, documento, telefone
        FROM pacientes
        ORDER BY id
    `).all();

    res.json(pacientes);
});

// Busca um paciente.
app.get('/api/pacientes/:id', (req, res) => {
    const id = validarId(req.params.id);

    if (!id) {
        return res.status(400).json({ erro: 'O ID deve ser um número inteiro positivo.' });
    }

    const paciente = db.prepare(`
        SELECT id, nome, idade, genero, documento, telefone
        FROM pacientes
        WHERE id = ?
    `).get(id);

    if (!paciente) {
        return res.status(404).json({ erro: 'Paciente não encontrado.' });
    }

    res.json(paciente);
});

// Cadastra paciente.
app.post('/api/pacientes', (req, res) => {
    const { nome, idade, genero, documento, telefone } = req.body;
    const idadeNumero = Number(idade);

    if (typeof nome !== 'string' || nome.trim().length < 3) {
        return res.status(400).json({ erro: 'O nome deve ter pelo menos 3 caracteres.' });
    }

    if (!Number.isInteger(idadeNumero) || idadeNumero <= 0 || idadeNumero > 120) {
        return res.status(400).json({ erro: 'A idade deve ser um número inteiro entre 1 e 120.' });
    }

    const resultado = db.prepare(`
        INSERT INTO pacientes (nome, idade, genero, documento, telefone)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        nome.trim(),
        idadeNumero,
        String(genero || '').trim() || null,
        String(documento || '').trim() || null,
        String(telefone || '').trim() || null
    );

    const paciente = db.prepare(`
        SELECT id, nome, idade, genero, documento, telefone
        FROM pacientes
        WHERE id = ?
    `).get(resultado.lastInsertRowid);

    res.status(201).json(paciente);
});

// Atualiza paciente.
app.put('/api/pacientes/:id', (req, res) => {
    const id = validarId(req.params.id);
    const { nome, idade, genero, documento, telefone } = req.body;
    const idadeNumero = Number(idade);

    if (!id) {
        return res.status(400).json({ erro: 'ID inválido.' });
    }

    if (typeof nome !== 'string' || nome.trim().length < 3) {
        return res.status(400).json({ erro: 'O nome deve ter pelo menos 3 caracteres.' });
    }

    if (!Number.isInteger(idadeNumero) || idadeNumero <= 0 || idadeNumero > 120) {
        return res.status(400).json({ erro: 'A idade deve ser um número inteiro entre 1 e 120.' });
    }

    const existente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(id);
    if (!existente) {
        return res.status(404).json({ erro: 'Paciente não encontrado.' });
    }

    db.prepare(`
        UPDATE pacientes
        SET nome = ?, idade = ?, genero = ?, documento = ?, telefone = ?
        WHERE id = ?
    `).run(
        nome.trim(),
        idadeNumero,
        String(genero || '').trim() || null,
        String(documento || '').trim() || null,
        String(telefone || '').trim() || null,
        id
    );

    res.json(db.prepare(`
        SELECT id, nome, idade, genero, documento, telefone
        FROM pacientes
        WHERE id = ?
    `).get(id));
});

// Exclui paciente somente quando não possui atendimentos vinculados.
app.delete('/api/pacientes/:id', (req, res) => {
    const id = validarId(req.params.id);

    if (!id) {
        return res.status(400).json({ erro: 'ID inválido.' });
    }

    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(id);
    if (!paciente) {
        return res.status(404).json({ erro: 'Paciente não encontrado.' });
    }

    const possuiAtendimentos = db.prepare(
        'SELECT id FROM atendimentos WHERE paciente_id = ? LIMIT 1'
    ).get(id);

    if (possuiAtendimentos) {
        return res.status(409).json({
            erro: 'Não é possível excluir este paciente porque existem atendimentos vinculados.'
        });
    }

    db.prepare('DELETE FROM pacientes WHERE id = ?').run(id);
    res.json({ mensagem: 'Paciente excluído com sucesso.', id });
});

// Cria atendimento.
app.post('/api/atendimentos', (req, res) => {
    const pacienteId = validarId(req.body.paciente_id);
    const sintomas = req.body.sintomas;
    const profissional = String(req.body.profissional || '').trim() || null;

    if (!pacienteId) {
        return res.status(400).json({ erro: 'ID do paciente inválido.' });
    }

    if (typeof sintomas !== 'string' || sintomas.trim().length < 3) {
        return res.status(400).json({ erro: 'Informe os sintomas do paciente.' });
    }

    const paciente = db.prepare('SELECT id FROM pacientes WHERE id = ?').get(pacienteId);
    if (!paciente) {
        return res.status(404).json({ erro: 'Paciente não encontrado.' });
    }

    const resultado = db.prepare(`
        INSERT INTO atendimentos (paciente_id, sintomas, profissional)
        VALUES (?, ?, ?)
    `).run(pacienteId, sintomas.trim(), profissional);

    res.status(201).json(buscarAtendimento(resultado.lastInsertRowid));
});

// Lista todos os atendimentos com os dados do paciente.
app.get('/api/atendimentos', (req, res) => {
    const atendimentos = db.prepare(`
        SELECT
            a.*,
            p.nome AS paciente_nome,
            p.idade AS idade,
            p.genero AS genero,
            p.documento AS documento,
            p.telefone AS telefone
        FROM atendimentos a
        INNER JOIN pacientes p ON p.id = a.paciente_id
        ORDER BY a.data_registro DESC, a.id DESC
    `).all();

    res.json(atendimentos);
});

// Lista a fila ativa. Inclui quem aguarda e quem já está em atendimento.
app.get('/api/fila', (req, res) => {
    const fila = db.prepare(`
        SELECT
            a.id,
            a.id AS atendimento_id,
            a.paciente_id,
            p.nome AS paciente_nome,
            p.idade AS idade,
            p.genero AS genero,
            p.documento AS documento,
            p.telefone AS telefone,
            a.sintomas,
            a.status,
            a.prioridade,
            a.prioridade_sugerida,
            a.data_registro,
            a.finalizado_em,
            a.profissional
        FROM atendimentos a
        INNER JOIN pacientes p ON p.id = a.paciente_id
        WHERE a.status IN ('Aguardando', 'Em atendimento')
        ORDER BY
            CASE a.prioridade
                WHEN 'Emergência' THEN 1
                WHEN 'Urgente' THEN 2
                WHEN 'Pouco Urgente' THEN 3
                ELSE 4
            END,
            a.data_registro ASC,
            a.id ASC
    `).all();

    res.json(fila);
});

// Atualiza status do atendimento.
app.patch('/api/atendimentos/:id/status', (req, res) => {
    const id = validarId(req.params.id);
    const { status } = req.body;
    const statusPermitidos = ['Aguardando', 'Em atendimento', 'Finalizado'];

    if (!id) {
        return res.status(400).json({ erro: 'ID do atendimento inválido.' });
    }

    if (!statusPermitidos.includes(status)) {
        return res.status(400).json({ erro: 'Status inválido.' });
    }

    const atendimento = db.prepare('SELECT id FROM atendimentos WHERE id = ?').get(id);
    if (!atendimento) {
        return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }

    db.prepare(`
        UPDATE atendimentos
        SET status = ?,
            finalizado_em = CASE WHEN ? = 'Finalizado' THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE id = ?
    `).run(status, status, id);

    res.json(buscarAtendimento(id));
});

// Confirma/atualiza a prioridade. A sugestão da IA não altera esta coluna automaticamente.
app.patch('/api/atendimentos/:id/prioridade', (req, res) => {
    const id = validarId(req.params.id);
    const { prioridade } = req.body;
    const prioridadesPermitidas = [
        'Emergência',
        'Urgente',
        'Pouco Urgente',
        'Pendente'
    ];

    if (!id) {
        return res.status(400).json({ erro: 'ID do atendimento inválido.' });
    }

    if (!prioridadesPermitidas.includes(prioridade)) {
        return res.status(400).json({ erro: 'Prioridade inválida.' });
    }

    const atendimento = db.prepare('SELECT id FROM atendimentos WHERE id = ?').get(id);
    if (!atendimento) {
        return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }

    db.prepare('UPDATE atendimentos SET prioridade = ? WHERE id = ?').run(prioridade, id);
    res.json(buscarAtendimento(id));
});

// Teste de conexão com Gemini.
app.get('/api/ia/teste', async (req, res) => {
    const ai = getAI();

    if (!ai) {
        return res.status(503).json({ erro: 'GEMINI_API_KEY não configurada no arquivo .env.' });
    }

    try {
        const resposta = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: 'Responda em português: a integração com o sistema está funcionando!',
            config: { abortSignal: AbortSignal.timeout(20000) }
        });

        res.json({
            mensagem: 'Gemini conectado com sucesso!',
            resposta: resposta.text || 'Resposta recebida sem texto.'
        });
    } catch (erro) {
        console.error('Erro ao consultar Gemini:', erro.message);
        res.status(503).json({
            erro: 'O Gemini está temporariamente indisponível. Tente novamente em instantes.'
        });
    }
});

// Sugestão de prioridade pela IA. A decisão final continua sendo humana.
app.post('/api/atendimentos/:id/sugerir-prioridade', async (req, res) => {
    const id = validarId(req.params.id);

    if (!id) {
        return res.status(400).json({ erro: 'ID do atendimento inválido.' });
    }

    const atendimento = buscarAtendimento(id);
    if (!atendimento) {
        return res.status(404).json({ erro: 'Atendimento não encontrado.' });
    }

    const ai = getAI();
    if (!ai) {
        return res.status(503).json({ erro: 'GEMINI_API_KEY não configurada no arquivo .env.' });
    }

    try {
        const resposta = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: `
                Você é um assistente de apoio a uma SIMULAÇÃO ACADÊMICA de triagem.
                Analise somente os dados informados abaixo. Não invente sinais, sintomas,
                medições ou antecedentes que não estejam descritos.

                Retorne uma sugestão preliminar entre: Emergência, Urgente,
                Pouco Urgente ou Indefinida. Se os dados forem insuficientes,
                escolha Indefinida. Não dê diagnóstico médico, não indique medicamentos,
                não prescreva tratamento e não afirme que o paciente está seguro.
                Não substitua protocolos oficiais nem avaliação de profissional habilitado.

                Em pontos_atencao, liste apenas sinais/sintomas relevantes que realmente
                aparecem no relato. Em informacoes_ausentes, liste dados que poderiam
                ser coletados por um profissional (por exemplo, sinais vitais, início,
                duração ou intensidade), sem presumir seus valores.
                A orientação operacional deve reforçar a avaliação humana conforme
                o protocolo da unidade, sem oferecer tratamento.

                Dados do paciente: ${atendimento.paciente_nome}, ${atendimento.idade} anos.
                Relato e informações registrados:
                ${String(atendimento.sintomas).slice(0, 2500)}
            `,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        prioridade_sugerida: {
                            type: 'STRING',
                            enum: ['Emergência', 'Urgente', 'Pouco Urgente', 'Indefinida']
                        },
                        resumo: { type: 'STRING' },
                        justificativa: { type: 'STRING' },
                        pontos_atencao: { type: 'ARRAY', items: { type: 'STRING' } },
                        informacoes_ausentes: { type: 'ARRAY', items: { type: 'STRING' } },
                        orientacao_operacional: { type: 'STRING' }
                    },
                    required: [
                        'prioridade_sugerida',
                        'resumo',
                        'justificativa',
                        'pontos_atencao',
                        'informacoes_ausentes',
                        'orientacao_operacional'
                    ]
                },
                abortSignal: AbortSignal.timeout(25000)
            }
        });

        const dados = JSON.parse(resposta.text || '{}');
        const permitidas = ['Emergência', 'Urgente', 'Pouco Urgente', 'Indefinida'];

        if (!permitidas.includes(dados.prioridade_sugerida)) {
            return res.status(502).json({ erro: 'A IA retornou uma sugestão inválida.' });
        }

        const pontosAtencao = Array.isArray(dados.pontos_atencao)
            ? dados.pontos_atencao.filter(item => typeof item === 'string').slice(0, 8)
            : [];
        const informacoesAusentes = Array.isArray(dados.informacoes_ausentes)
            ? dados.informacoes_ausentes.filter(item => typeof item === 'string').slice(0, 8)
            : [];
        const resultadoIA = {
            resumo: String(dados.resumo || 'Análise preliminar concluída com os dados registrados.'),
            justificativa: String(dados.justificativa || 'Sem justificativa retornada.'),
            pontos_atencao: pontosAtencao,
            informacoes_ausentes: informacoesAusentes,
            orientacao_operacional: String(dados.orientacao_operacional || 'Encaminhar para avaliação do profissional responsável, conforme protocolo institucional.')
        };

        db.prepare(`
            UPDATE atendimentos
            SET prioridade_sugerida = ?,
                resumo_ia = ?,
                justificativa_ia = ?,
                pontos_atencao_ia = ?,
                informacoes_ausentes_ia = ?,
                orientacao_ia = ?
            WHERE id = ?
        `).run(
            dados.prioridade_sugerida,
            resultadoIA.resumo,
            resultadoIA.justificativa,
            JSON.stringify(resultadoIA.pontos_atencao),
            JSON.stringify(resultadoIA.informacoes_ausentes),
            resultadoIA.orientacao_operacional,
            id
        );

        res.json({
            atendimento_id: id,
            prioridade_sugerida: dados.prioridade_sugerida,
            ...resultadoIA,
            prioridade_confirmada: atendimento.prioridade,
            aviso: 'Análise preliminar para simulação acadêmica. Não é diagnóstico médico. A prioridade final deve ser confirmada por profissional responsável conforme protocolo institucional.'
        });
    } catch (erro) {
        console.error('Erro no Gemini:', erro.message);
        res.status(503).json({
            erro: 'Não foi possível gerar a sugestão agora. O atendimento foi salvo e pode ser classificado manualmente.'
        });
    }
});

// Retorna JSON em vez de uma página HTML para erros de API.
app.use('/api', (req, res) => {
    res.status(404).json({ erro: 'Rota da API não encontrada.' });
});

app.use((erro, req, res, next) => {
    console.error('Erro no servidor:', erro);
    if (res.headersSent) return next(erro);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Interface disponível em http://localhost:${PORT}`);
});
