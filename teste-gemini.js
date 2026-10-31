
require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

const chave = process.env.GEMINI_API_KEY;

if (!chave) {
    console.log('Chave do Gemini não encontrada no .env');
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: chave
});

async function testarGemini() {
    try {
        const resposta = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: 'Responda em português: conexão com Gemini funcionando!'
        });

        console.log('Resposta do Gemini:');
        console.log(resposta.text);

    } catch (erro) {
        console.log('Erro ao conectar com o Gemini:');
        console.log(erro.message);
    }
}

testarGemini();
