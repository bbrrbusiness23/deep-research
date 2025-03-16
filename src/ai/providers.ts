import Together from "together-ai";
import { createFireworks } from '@ai-sdk/fireworks';
import { createOpenAI } from '@ai-sdk/openai';
import {
  extractReasoningMiddleware,
  LanguageModelV1,
  wrapLanguageModel,
} from 'ai';
import { getEncoding } from 'js-tiktoken';
import { RecursiveCharacterTextSplitter } from './text-splitter';

// Providers for OpenAI and Fireworks
const openai = process.env.OPENAI_KEY
  ? createOpenAI({
      apiKey: process.env.OPENAI_KEY,
      baseURL: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1',
    })
  : undefined;

const fireworks = process.env.FIREWORKS_KEY
  ? createFireworks({
      apiKey: process.env.FIREWORKS_KEY,
    })
  : undefined;

const customModel = process.env.CUSTOM_MODEL
  ? openai?.(process.env.CUSTOM_MODEL, {
      structuredOutputs: true,
    })
  : undefined;

// Together Model Provider
const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY, // Make sure this is set in your .env.local if needed
});

// Define the Together model with a supported default mode ("text")
const togetherModel: LanguageModelV1 = {
  modelId: "Together-Llama-3.3-70B-Instruct-Turbo-Free",
  defaultObjectGenerationMode: 'text',  // Use 'text' mode for Together
  async generate(messages, options) {
    const response = await together.chat.completions.create({
      messages,
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      max_tokens: options?.max_tokens || null,
      temperature: options?.temperature || 0.7,
      top_p: options?.top_p || 0.7,
      top_k: options?.top_k || 50,
      repetition_penalty: options?.repetition_penalty || 1,
      stop: options?.stop || ["<|eot_id|>", "<|eom_id|>"],
      stream: false,
    });
    let result = '';
    for await (const token of response) {
      result += token.choices[0]?.delta?.content || '';
    }
    return result;
  }
};

// Models for other providers
const o3MiniModel = openai?.('o3-mini', {
  reasoningEffort: 'medium',
  structuredOutputs: true,
});

const deepSeekR1Model = fireworks
  ? wrapLanguageModel({
      model: fireworks('accounts/fireworks/models/deepseek-r1') as LanguageModelV1,
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  : undefined;

// getModel selects the appropriate model based on environment variables
export function getModel(): LanguageModelV1 {
  if (process.env.USE_TOGETHER === 'true') {
    return togetherModel;
  }
  if (customModel) {
    return customModel;
  }
  const model = deepSeekR1Model ?? o3MiniModel;
  if (!model) {
    throw new Error('No model found');
  }
  return model as LanguageModelV1;
}

const MinChunkSize = 140;
const encoder = getEncoding('o200k_base');

// Function to trim a prompt so it fits within the context size
export function trimPrompt(
  prompt: string,
  contextSize = Number(process.env.CONTEXT_SIZE) || 128_000,
) {
  if (!prompt) {
    return '';
  }

  const length = encoder.encode(prompt).length;
  if (length <= contextSize) {
    return prompt;
  }

  const overflowTokens = length - contextSize;
  const chunkSize = prompt.length - overflowTokens * 3;
  if (chunkSize < MinChunkSize) {
    return prompt.slice(0, MinChunkSize);
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap: 0,
  });
  const trimmedPrompt = splitter.splitText(prompt)[0] ?? '';

  if (trimmedPrompt.length === prompt.length) {
    return trimPrompt(prompt.slice(0, chunkSize), contextSize);
  }

  return trimPrompt(trimmedPrompt, contextSize);
}
