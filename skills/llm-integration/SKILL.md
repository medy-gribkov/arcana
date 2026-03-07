---
name: llm-integration
description: Integrate OpenAI and Anthropic APIs with streaming, structured output, tool calling, token management, and cost optimization
user-invokable: true
---

# LLM Integration Skill

Integrate Large Language Models (OpenAI, Anthropic) into applications with proper streaming, structured outputs, tool calling, prompt engineering, token management, and error handling.

## API Configuration and Client Setup

### BAD: Hardcoded credentials, no validation

```typescript
const openai = new OpenAI({
  apiKey: "sk-proj-abc123" // Hardcoded key
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY // No validation
});
```

### GOOD: Environment validation, typed configuration

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface LLMConfig {
  openaiKey?: string;
  anthropicKey?: string;
  maxRetries: number;
  timeout: number;
}

function validateConfig(config: LLMConfig): void {
  if (!config.openaiKey && !config.anthropicKey) {
    throw new Error('At least one API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) required');
  }
  if (config.timeout < 1000) {
    throw new Error('Timeout must be at least 1000ms');
  }
}

const config: LLMConfig = {
  openaiKey: process.env.OPENAI_API_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
  timeout: 60000
};

validateConfig(config);

const openai = config.openaiKey ? new OpenAI({
  apiKey: config.openaiKey,
  maxRetries: config.maxRetries,
  timeout: config.timeout
}) : null;

const anthropic = config.anthropicKey ? new Anthropic({
  apiKey: config.anthropicKey,
  maxRetries: config.maxRetries,
  timeout: config.timeout
}) : null;
```

## Streaming Responses

### BAD: No streaming, blocks UI, no error handling

```typescript
async function chat(prompt: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices[0].message.content;
}
```

### GOOD: Streaming with error handling and token tracking

```typescript
async function* streamChat(
  prompt: string,
  onToken?: (token: string) => void
): AsyncGenerator<string, void, unknown> {
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      stream_options: { include_usage: true }
    });

    let totalTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;

      if (delta) {
        onToken?.(delta);
        yield delta;
      }

      if (chunk.usage) {
        totalTokens = chunk.usage.total_tokens;
      }
    }

    console.log(`Total tokens used: ${totalTokens}`);
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API error (${error.status}): ${error.message}`);
    }
    throw error;
  }
}

// Usage
for await (const token of streamChat('Explain streaming', console.log)) {
  process.stdout.write(token);
}
```

### GOOD: Anthropic streaming with tool use

```typescript
async function* streamAnthropicWithTools(
  prompt: string,
  tools: Anthropic.Tool[]
): AsyncGenerator<string, any, unknown> {
  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
    tools
  });

  let toolUseBlocks: any[] = [];

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }

    if (event.type === 'content_block_stop' && event.content_block.type === 'tool_use') {
      toolUseBlocks.push(event.content_block);
    }
  }

  return toolUseBlocks;
}
```

## Structured Output (JSON Mode, Tool Use)

### BAD: String parsing, fragile extraction

```typescript
async function extractData(text: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: `Extract name and email from: ${text}. Return as JSON.`
    }]
  });

  const content = response.choices[0].message.content;
  return JSON.parse(content.match(/\{.*\}/s)[0]); // Fragile
}
```

### GOOD: OpenAI JSON mode with schema validation

```typescript
import { z } from 'zod';

const ContactSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional()
});

type Contact = z.infer<typeof ContactSchema>;

async function extractContactOpenAI(text: string): Promise<Contact> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Extract contact information. Respond only with valid JSON matching the schema.'
      },
      { role: 'user', content: text }
    ],
    response_format: { type: 'json_object' }
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return ContactSchema.parse(parsed);
}
```

### GOOD: Anthropic tool use for structured output

```typescript
async function extractContactAnthropic(text: string): Promise<Contact> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    tools: [{
      name: 'record_contact',
      description: 'Record extracted contact information',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' }
        },
        required: ['name', 'email']
      }
    }],
    messages: [{ role: 'user', content: `Extract contact info: ${text}` }]
  });

  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('No tool use in response');
  }

  return ContactSchema.parse(toolUse.input);
}
```

<!-- See references/advanced.md for extended examples -->
