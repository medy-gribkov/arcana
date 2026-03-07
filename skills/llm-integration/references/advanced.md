# LLM Integration - Advanced Patterns

## Function/Tool Calling with Multi-Turn

### BAD: Single-turn, no function execution

```typescript
async function ask(question: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: question }],
    functions: [{ name: 'get_weather', parameters: {} }]
  });
  return response.choices[0].message;
}
```

### GOOD: Multi-turn with actual function execution

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: object;
  execute: (args: any) => Promise<any>;
}

const tools: Tool[] = [
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
        units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
      },
      required: ['location']
    },
    execute: async ({ location, units = 'celsius' }) => {
      // Call actual weather API
      return { location, temp: 22, units, condition: 'sunny' };
    }
  }
];

async function chatWithTools(
  userMessage: string,
  conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = []
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools: tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  });

  const message = response.choices[0].message;

  if (message.tool_calls) {
    messages.push(message);

    for (const toolCall of message.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.function.name);
      if (!tool) throw new Error(`Unknown tool: ${toolCall.function.name}`);

      const args = JSON.parse(toolCall.function.arguments);
      const result = await tool.execute(args);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    // Recursive call for final response
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages
    });

    return finalResponse.choices[0].message.content || '';
  }

  return message.content || '';
}
```

## Prompt Engineering Patterns

### BAD: Single massive prompt, no separation

```typescript
async function analyze(data: string) {
  return await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'user',
      content: `You are an expert analyst. Analyze this data and provide insights: ${data}`
    }]
  });
}
```

### GOOD: System/user separation, few-shot examples

```typescript
async function analyzeWithPattern(data: string, domain: string) {
  return await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert ${domain} analyst. Provide structured analysis with:
1. Key findings (3-5 bullet points)
2. Risks (if any)
3. Recommendations`
      },
      {
        role: 'user',
        content: 'Sales data: Q1 revenue $500k, Q2 $450k, Q3 $400k'
      },
      {
        role: 'assistant',
        content: `**Key Findings:**
- 10% revenue decline Q1 to Q2
- Continued 11% decline Q2 to Q3
- Total 20% decline over 6 months

**Risks:**
- Trend indicates customer churn or market saturation

**Recommendations:**
- Investigate customer feedback
- Review pricing strategy`
      },
      {
        role: 'user',
        content: data
      }
    ],
    temperature: 0.3 // Lower for analysis
  });
}
```

## Token Management and Context Windowing

### BAD: Sending full context every call, no limits

```typescript
let chatHistory = [];

async function continueChat(message: string) {
  chatHistory.push({ role: 'user', content: message });

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: chatHistory // Unbounded growth
  });

  chatHistory.push(response.choices[0].message);
  return response;
}
```

### GOOD: Token-aware sliding window with summarization

```typescript
import { encode } from 'gpt-tokenizer';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens?: number;
}

class TokenAwareChat {
  private messages: Message[] = [];
  private readonly maxTokens = 6000; // Leave room for response
  private readonly systemPrompt: Message;

  constructor(systemPrompt: string) {
    this.systemPrompt = {
      role: 'system',
      content: systemPrompt,
      tokens: encode(systemPrompt).length
    };
  }

  private countTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
  }

  private async summarizeOldMessages(messages: Message[]): Promise<Message> {
    const content = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cheaper for summarization
      messages: [{
        role: 'user',
        content: `Summarize this conversation in 3-4 sentences:\n${content}`
      }],
      temperature: 0.3
    });

    const summary = response.choices[0].message.content;
    return {
      role: 'system',
      content: `Previous conversation summary: ${summary}`,
      tokens: encode(summary).length
    };
  }

  async chat(userMessage: string): Promise<string> {
    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      tokens: encode(userMessage).length
    };

    this.messages.push(userMsg);

    let totalTokens = this.systemPrompt.tokens! + this.countTokens(this.messages);

    if (totalTokens > this.maxTokens) {
      const messagesToSummarize = this.messages.slice(0, -4); // Keep last 4
      const summary = await this.summarizeOldMessages(messagesToSummarize);
      this.messages = [summary, ...this.messages.slice(-4)];
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [this.systemPrompt, ...this.messages]
    });

    const assistantMsg: Message = {
      role: 'assistant',
      content: response.choices[0].message.content || '',
      tokens: response.usage?.completion_tokens || 0
    };

    this.messages.push(assistantMsg);

    return assistantMsg.content;
  }
}
```

## Retry with Exponential Backoff

### BAD: No retry, immediate failure

```typescript
async function generate(prompt: string) {
  return await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
}
```

### GOOD: Exponential backoff with jitter

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable =
        error instanceof OpenAI.APIError &&
        (error.status === 429 || error.status >= 500);

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;

      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay + jitter}ms`);
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }

  throw new Error('Max retries exceeded');
}

async function generateRobust(prompt: string) {
  return retryWithBackoff(() =>
    openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }]
    })
  );
}
```

## Cost Optimization

### BAD: Always using most expensive model

```typescript
async function simpleTask(text: string) {
  return await openai.chat.completions.create({
    model: 'gpt-4', // Expensive for simple tasks
    messages: [{ role: 'user', content: text }]
  });
}
```

### GOOD: Model selection based on complexity, caching

```typescript
type TaskComplexity = 'simple' | 'moderate' | 'complex';

const modelTiers = {
  simple: 'gpt-4o-mini',      // $0.15/$0.60 per 1M tokens
  moderate: 'gpt-4o',         // $2.50/$10 per 1M tokens
  complex: 'gpt-4'            // $30/$60 per 1M tokens
};

async function optimizedGenerate(
  prompt: string,
  complexity: TaskComplexity = 'moderate'
) {
  const model = modelTiers[complexity];

  return await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: complexity === 'simple' ? 500 : 2000, // Limit tokens
    temperature: complexity === 'simple' ? 0 : 0.7    // Deterministic for simple
  });
}

// For Anthropic: use prompt caching for repeated system prompts
async function cachedAnthropicCall(userMessage: string, systemPrompt: string) {
  return await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' } // Cache for 5 minutes
      }
    ],
    messages: [{ role: 'user', content: userMessage }]
  });
}
```

## Embeddings and RAG Basics

### GOOD: Generate embeddings for semantic search

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small', // 1536 dimensions, $0.02/1M tokens
    input: text
  });

  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function semanticSearch(
  query: string,
  documents: Array<{ text: string; metadata: any }>
): Promise<Array<{ text: string; metadata: any; score: number }>> {
  const queryEmbedding = await generateEmbedding(query);

  const docEmbeddings = await Promise.all(
    documents.map(doc => generateEmbedding(doc.text))
  );

  const results = documents.map((doc, i) => ({
    ...doc,
    score: cosineSimilarity(queryEmbedding, docEmbeddings[i])
  }));

  return results.sort((a, b) => b.score - a.score);
}
```

### GOOD: Simple RAG pipeline

```typescript
async function ragQuery(
  question: string,
  knowledgeBase: Array<{ text: string; metadata: any }>
): Promise<string> {
  const relevantDocs = await semanticSearch(question, knowledgeBase);
  const topDocs = relevantDocs.slice(0, 3);

  const context = topDocs
    .map((doc, i) => `[${i + 1}] ${doc.text}`)
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Answer using only the provided context. Cite sources with [1], [2], etc.'
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}`
      }
    ],
    temperature: 0.3
  });

  return response.choices[0].message.content || '';
}
```

## Complete Error Handling Pattern

### GOOD: Comprehensive error handling across providers

```typescript
class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: 'openai' | 'anthropic',
    public readonly code?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

async function robustGenerate(prompt: string): Promise<string> {
  try {
    if (openai) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
      });
      return response.choices[0].message.content || '';
    }

    if (anthropic) {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        return textBlock.text;
      }
    }

    throw new Error('No LLM provider configured');

  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new LLMError(
        error.message,
        'openai',
        error.code,
        error.status
      );
    }

    if (error instanceof Anthropic.APIError) {
      throw new LLMError(
        error.message,
        'anthropic',
        error.error?.type,
        error.status
      );
    }

    throw error;
  }
}
```
