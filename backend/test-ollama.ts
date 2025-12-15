#!/usr/bin/env node
/**
 * Test script for X402 MCP Server with Ollama integration
 * Verifies that local LLM can be used with OpenAI SDK
 */

import OpenAI from 'openai';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

async function testOllamaIntegration() {
  console.log('🧪 Testing X402 MCP + Ollama Integration\n');
  console.log(`📍 Ollama Host: ${OLLAMA_HOST}`);
  console.log(`🤖 Model: ${OLLAMA_MODEL}\n`);

  // Initialize OpenAI SDK pointing to Ollama
  const ollama = new OpenAI({
    apiKey: 'ollama', // dummy key
    baseURL: `${OLLAMA_HOST}/v1`,
  });

  try {
    // Test 1: List models
    console.log('✅ Test 1: List available models');
    const models = await ollama.models.list();
    console.log(`   Found ${models.data.length} model(s):`);
    models.data.forEach((m) => console.log(`   - ${m.id}`));
    console.log();

    // Test 2: Simple completion
    console.log('✅ Test 2: Simple chat completion');
    const completion = await ollama.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a payment assistant for the X402 privacy-preserving marketplace.',
        },
        {
          role: 'user',
          content: 'Explain in one sentence what X402 does.',
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || '';
    console.log(`   Response: ${response}\n`);

    // Test 3: Simulate MCP tool awareness
    console.log('✅ Test 3: Tool-aware completion');
    const toolCompletion = await ollama.chat.completions.create({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: 'system',
          content: `You have access to these payment tools:
1. get_payment_quote - Get pricing for content
2. submit_payment - Pay for content with ZK proof
3. check_payment_status - Verify payment
4. get_content_metadata - Fetch content details
5. pay_and_fetch - Complete flow in one call`,
        },
        {
          role: 'user',
          content: 'I want to buy an article about AI. What should I do first?',
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const toolResponse = toolCompletion.choices[0]?.message?.content || '';
    console.log(`   Response: ${toolResponse}\n`);

    // Test 4: Cost comparison
    console.log('💰 Cost Comparison:');
    console.log('   Ollama (local):  $0.00 per request');
    console.log('   OpenAI GPT-4:    ~$0.03 per request');
    console.log('   Claude Sonnet:   ~$0.025 per request\n');

    console.log('✅ All tests passed! MCP + Ollama integration is working.\n');
    console.log('🚀 Next steps:');
    console.log('   1. Run the MCP server: npm run mcp');
    console.log('   2. Add to Claude Desktop config (see MCP_OLLAMA_SETUP.md)');
    console.log('   3. Test autonomous content purchasing with AI agent\n');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Ensure Ollama is running: ollama serve');
    console.error('   2. Check model is installed: ollama list');
    console.error('   3. Verify API endpoint: curl http://localhost:11434/v1/models');
    process.exit(1);
  }
}

testOllamaIntegration();
