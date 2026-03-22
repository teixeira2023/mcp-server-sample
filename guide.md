
# Seu Roteiro de Aprendizado: MCP Weather Server

Este é um servidor MCP (Model Context Protocol) que fornece ferramentas para obter informações meteorológicas da API do National Weather Service dos EUA. Segue o padrão Domain-Driven Design em 5 camadas.

## Passo 1: Conceitos Fundamentais 📚

Leia `README.md` completamente

**O que aprender:** O que é MCP, as 2 ferramentas disponíveis (get-alerts, get-forecast), e as dependências (Zod para validação, @modelcontextprotocol/sdk)

## Passo 2: Entender o Entry Point 🚀

Leia `main.ts`

**O que aprender:** Como o servidor MCP inicia, como o transporte stdio é configurado, e qual é a ordem de instanciação dos serviços

## Passo 3: Modelos de Domínio 🏗️

Leia `Weather.ts`

**O que aprender:** As interfaces que representam os dados (AlertFeature, ForecastPeriod, AlertsResponse, etc.)

## Passo 4: Serviço de Infraestrutura 🌐

Leia `NWSApiService.ts`

**O que aprender:** Como as requisições HTTP são feitas à API NWS, tratamento de erros, e estrutura das chamadas externas

## Passo 5: Lógica de Negócio ⚙️

Leia `WeatherService.ts`

**O que aprender:** Como os dados da API são processados, formatados e preparados para retorno

## Passo 6: Controladores e Ferramentas MCP 🔧

Leia `WeatherToolsController.ts`

**O que aprender:** Como as ferramentas são registradas no MCP, validação com Zod, e schemas das respostas

## Passo 7: Build e Execução 💻

Revise `package.json` — veja os scripts build e server

**O que aprender:** Como compilar TypeScript com `npm run build` e executar com `node build/main.js`

## Passo 8: Fluxo Completo 🔄

Integre todo o conhecimento: uma requisição chega via stdio → WeatherToolsController valida → WeatherService processa → NWSApiService consulta API → dados retornam formatados

---

Após completar este roteiro, você entenderá como o projeto funciona e poderá modificar, estender com novas ferramentas ou integrar outras APIs! 🎯
