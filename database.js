const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'triagem.db'));
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        idade INTEGER NOT NULL,
        genero TEXT,
        documento TEXT,
        telefone TEXT
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS atendimentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        sintomas TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Aguardando',
        prioridade TEXT NOT NULL DEFAULT 'Pendente',
        prioridade_sugerida TEXT,
        data_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finalizado_em TEXT,
        profissional TEXT,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
    )
`);

function ensureColumn(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((item) => item.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

// Migra automaticamente bancos criados nas etapas anteriores.
ensureColumn('pacientes', 'genero', 'TEXT');
ensureColumn('pacientes', 'documento', 'TEXT');
ensureColumn('pacientes', 'telefone', 'TEXT');

ensureColumn('atendimentos', 'prioridade', "TEXT NOT NULL DEFAULT 'Pendente'");
ensureColumn('atendimentos', 'prioridade_sugerida', 'TEXT');
ensureColumn('atendimentos', 'finalizado_em', 'TEXT');
ensureColumn('atendimentos', 'profissional', 'TEXT');
ensureColumn('atendimentos', 'resumo_ia', 'TEXT');
ensureColumn('atendimentos', 'justificativa_ia', 'TEXT');
ensureColumn('atendimentos', 'pontos_atencao_ia', 'TEXT');
ensureColumn('atendimentos', 'informacoes_ausentes_ia', 'TEXT');
ensureColumn('atendimentos', 'orientacao_ia', 'TEXT');

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_atendimentos_status
    ON atendimentos(status);

    CREATE INDEX IF NOT EXISTS idx_atendimentos_prioridade
    ON atendimentos(prioridade);

    CREATE INDEX IF NOT EXISTS idx_atendimentos_data
    ON atendimentos(data_registro);
`);

module.exports = db;
