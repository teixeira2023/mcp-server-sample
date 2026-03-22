"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
// Cliente MCP melhorado com tratamento de erros
class MCPClient {
    constructor() {
        this.requestId = 1;
        this.pendingRequests = new Map();
        this.requestTimestamps = new Map();
        this.buffer = '';
        // Inicia o servidor como subprocesso
        this.serverProcess = (0, child_process_1.spawn)('node', ['build/main.js'], {
            stdio: ['pipe', 'pipe', 'inherit'] // stdin, stdout, stderr
        });
        // Escuta respostas do servidor com tratamento de linha
        this.serverProcess.stdout.on('data', (data) => {
            this.handleData(data);
        });
        this.serverProcess.on('close', (code) => {
            console.log(`\n✓ Servidor fechou com código ${code}\n`);
        });
    }
    // Processa dados recebidos, parseia JSON-RPC por linha
    handleData(data) {
        const text = data.toString();
        this.buffer += text;
        // Processa cada linha completa
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || ''; // Mantém linha incompleta no buffer
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const response = JSON.parse(line);
                    this.handleResponse(response);
                }
                catch (error) {
                    // JSON inválido, descarta
                }
            }
        }
    }
    // Processa resposta JSON-RPC
    handleResponse(response) {
        const callback = this.pendingRequests.get(response.id);
        const startTime = this.requestTimestamps.get(response.id) || Date.now();
        const duration = Date.now() - startTime;
        if (callback) {
            // Valida resposta
            if (!this.validateResponse(response)) {
                this.handleResponseValidationError(response, duration);
            }
            callback(response);
            this.pendingRequests.delete(response.id);
            this.requestTimestamps.delete(response.id);
        }
    }
    // Valida resposta JSON-RPC
    validateResponse(response) {
        if (!response.jsonrpc || response.jsonrpc !== '2.0') {
            console.warn('⚠️  Resposta JSON-RPC inválida: versão incorreta');
            return false;
        }
        if (typeof response.id !== 'number') {
            console.warn('⚠️  Resposta JSON-RPC inválida: ID ausente');
            return false;
        }
        // Verifica se tem resultado OU erro, mas não ambos
        if (!response.result && !response.error) {
            console.warn('⚠️  Resposta JSON-RPC inválida: sem resultado ou erro');
            return false;
        }
        return true;
    }
    // Trata erro de validação de resposta
    handleResponseValidationError(response, duration) {
        console.error(`\n🔴 ERRO DE VALIDAÇÃO (${duration}ms)`);
        console.error('─'.repeat(60));
        console.error('Resposta inválida recebida:');
        console.error(JSON.stringify(response, null, 2));
        console.error('─'.repeat(60));
    }
    // Exibe resultado de forma organizada com suporte a erros
    displayResult(title, response) {
        const startTime = this.requestTimestamps.get(response.id) || Date.now();
        const duration = Date.now() - startTime;
        if (response.error) {
            this.displayError(title, response.error, duration);
        }
        else if (response.result) {
            this.displaySuccess(title, response.result, duration);
        }
    }
    // Exibe sucesso
    displaySuccess(title, result, duration) {
        console.log(`\n✅ ${title} (${duration}ms)`);
        console.log('─'.repeat(60));
        console.log(JSON.stringify(result, null, 2));
        console.log('─'.repeat(60));
    }
    // Exibe erro com detalhes
    displayError(title, error, duration) {
        console.log(`\n❌ ${title} (${duration}ms)`);
        console.log('─'.repeat(60));
        console.log(`Código: ${error.code}`);
        console.log(`Mensagem: ${error.message}`);
        if (error.data) {
            console.log('\nDetalhes:');
            if (typeof error.data === 'string') {
                console.log(error.data);
            }
            else {
                console.log(JSON.stringify(error.data, null, 2));
            }
        }
        console.log('─'.repeat(60));
    }
    // Envia uma mensagem JSON-RPC para o servidor
    sendMessage(method, params) {
        const id = this.requestId++;
        const message = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };
        const jsonMessage = JSON.stringify(message) + '\n';
        this.requestTimestamps.set(id, Date.now());
        console.log(`\n▶ Enviando: ${method}`);
        try {
            this.serverProcess.stdin.write(jsonMessage);
        }
        catch (error) {
            console.error('🔴 Erro ao enviar mensagem:', error instanceof Error ? error.message : String(error));
            this.requestTimestamps.delete(id);
        }
        return id;
    }
    // Inicializa a conexão MCP e aguarda resposta
    async initialize() {
        return new Promise((resolve) => {
            const id = this.sendMessage('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: {
                    name: 'TestClient',
                    version: '1.0.0'
                }
            });
            this.pendingRequests.set(id, (response) => {
                this.displayResult('Inicialização', response);
                resolve();
            });
        });
    }
    // Lista as ferramentas disponíveis e aguarda resposta
    async listTools() {
        return new Promise((resolve) => {
            const id = this.sendMessage('tools/list');
            this.pendingRequests.set(id, (response) => {
                if (response.result?.tools) {
                    console.log(`\n📋 Ferramentas Disponíveis`);
                    console.log('─'.repeat(60));
                    response.result.tools.forEach((tool, index) => {
                        console.log(`\n${index + 1}. ${tool.name}`);
                        console.log(`   Descrição: ${tool.description}`);
                        console.log('   Parâmetros:');
                        Object.entries(tool.inputSchema.properties).forEach(([key, prop]) => {
                            console.log(`     - ${key}: ${prop.type} (${prop.description})`);
                        });
                    });
                    console.log('\n' + '─'.repeat(60));
                }
                else {
                    this.displayResult('Ferramentas Disponíveis', response);
                }
                resolve();
            });
        });
    }
    // Chama uma ferramenta específica e aguarda resposta com tratamento de erro
    async callTool(name, args) {
        return new Promise((resolve) => {
            // Valida argumentos
            if (!name) {
                console.error('🔴 Nome da ferramenta é obrigatório');
                resolve({ success: false, error: { message: 'Nome da ferramenta é obrigatório' }, duration: 0 });
                return;
            }
            const id = this.sendMessage('tools/call', {
                name,
                arguments: args
            });
            const startTime = Date.now();
            // Aumenta timeout para chamadas de ferramenta (APIs externas podem ser lentas)
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(id);
                this.requestTimestamps.delete(id);
                const duration = Date.now() - startTime;
                console.log(`\n⏱️  Timeout na chamada de ${name} após ${duration}ms`);
                resolve({ success: false, error: { message: 'Timeout na chamada da ferramenta' }, duration });
            }, 30000);
            this.pendingRequests.set(id, (response) => {
                clearTimeout(timeout);
                const duration = Date.now() - startTime;
                this.displayResult(`Resultado: ${name}`, response);
                if (response.error) {
                    resolve({
                        success: false,
                        error: {
                            message: response.error.message,
                            code: response.error.code,
                            details: response.error.data
                        },
                        duration
                    });
                }
                else {
                    resolve({
                        success: true,
                        data: response.result,
                        duration
                    });
                }
            });
        });
    }
    // Chama get-forecast com latitude e longitude específicas
    async getForecast(latitude, longitude, locationName) {
        // Valida coordenadas
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            console.error('🔴 Latitude e longitude devem ser números');
            return { success: false, error: { message: 'Coordenadas inválidas' }, duration: 0 };
        }
        if (latitude < -90 || latitude > 90) {
            console.error('🔴 Latitude deve estar entre -90 e 90');
            return { success: false, error: { message: 'Latitude fora do intervalo válido' }, duration: 0 };
        }
        if (longitude < -180 || longitude > 180) {
            console.error('🔴 Longitude deve estar entre -180 e 180');
            return { success: false, error: { message: 'Longitude fora do intervalo válido' }, duration: 0 };
        }
        console.log(`\n🌡️  CONSULTANDO PREVISÃO PARA ${locationName} (${latitude}, ${longitude})\n`);
        return await this.callTool('get-forecast', { latitude, longitude });
    }
    // Chama get-alerts com código de estado
    async getAlerts(stateCode) {
        // Valida código de estado
        if (!stateCode || stateCode.length !== 2) {
            console.error('🔴 Código de estado deve ter 2 letras (ex: CA, NY)');
            return { success: false, error: { message: 'Código de estado inválido' }, duration: 0 };
        }
        console.log(`\n⚠️  CONSULTANDO ALERTAS PARA ${stateCode.toUpperCase()}\n`);
        return await this.callTool('get-alerts', { state: stateCode });
    }
    // Fecha o cliente
    close() {
        this.serverProcess.kill();
    }
}
// Exemplo de uso com async/await
async function main() {
    const client = new MCPClient();
    try {
        // Passo 1: Inicializar
        console.log('\n🚀 INICIANDO CLIENTE MCP\n');
        await client.initialize();
        // Pequena pausa
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Passo 2: Listar ferramentas
        console.log('\n📦 LISTANDO FERRAMENTAS\n');
        await client.listTools();
        // Pequena pausa
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Passo 3: Chamar ferramenta get-alerts
        const alertsResult = await client.getAlerts('MN');
        if (!alertsResult.success) {
            console.log('⚠️  Falha ao obter alertas, continuando...');
        }
        // Pequena pausa
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Passo 4: Chamar ferramenta get-forecast
        // Coordenadas de Nova York
        const forecastResult = await client.getForecast(40.7128, -74.0060, 'Orlando');
        if (!forecastResult.success) {
            console.log('⚠️  Falha ao obter previsão, continuando...');
        }
        // Pequena pausa
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Passo 5: Testar validação de entrada
        console.log('\n🧪 TESTANDO VALIDAÇÃO DE ENTRADA\n');
        console.log('Teste 1: Código de estado inválido');
        const invalidStateResult = await client.getAlerts('INVALID');
        if (!invalidStateResult.success) {
            console.log(`✓ Erro capturado: ${invalidStateResult.error?.message}`);
        }
        // Pausa
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('\nTeste 2: Coordenadas inválidas (latitude fora do intervalo)');
        const invalidLatResult = await client.getForecast(95, -74, 'Teste Inválido');
        if (!invalidLatResult.success) {
            console.log(`✓ Erro capturado: ${invalidLatResult.error?.message}`);
        }
        // Pausa
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('\nTeste 3: Longitude inválida');
        const invalidLonResult = await client.getForecast(40.7, 200, 'Teste Inválido');
        if (!invalidLonResult.success) {
            console.log(`✓ Erro capturado: ${invalidLonResult.error?.message}`);
        }
    }
    finally {
        // Espera um pouco e fecha
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('\n🔌 Fechando cliente...\n');
        client.close();
    }
}
main().catch(console.error);
