import type { ProductAgentConfig, CanvasAction } from '@team-product-workshop/shared';
import { callAIWithRetry } from '../llm/callAI.js';

export interface AgentResponse {
  agentId: string;
  content: string;
  actions: CanvasAction[];
  decisionRequest?: import('@team-product-workshop/shared').DecisionRequest;
  timedOut?: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AgentCallOptions {
  instruction: string;
  context: {
    phase: string;
    topic: string;
    cardSummary: string;
    conversationHistory: string[];
    canvasState: string;
  };
  signal?: AbortSignal;
  provider?: string;
  baseURL?: string;
  apiKey?: string;
}

export abstract class BaseAgent {
  constructor(public readonly config: ProductAgentConfig) {}

  get agentId(): string { return this.config.id; }
  get label(): string { return this.config.label; }
  get model(): string { return this.config.model; }

  abstract call(options: AgentCallOptions): Promise<AgentResponse>;

  protected buildSystemPrompt(phase: string): string {
    return this.config.systemPrompt.replace('{phase}', phase).replace('{perspective}', this.config.perspective || '');
  }

  protected async callAIAndParse(
    instruction: string,
    context: AgentCallOptions['context'],
    signal?: AbortSignal,
    llmOverrides?: { provider?: string; baseURL?: string; apiKey?: string },
  ): Promise<{ text: string; parsed: any; rawResult: import('../llm/callAI.js').CallAIResult }> {
    const systemPrompt = this.buildSystemPrompt(context.phase);
    const prompt = [
      `## 当前阶段: ${context.phase}`,
      `## 主题: ${context.topic}`,
      `## 当前画布:`,
      context.canvasState,
      '',
      context.conversationHistory.length > 0
        ? `## 讨论记录:\n${context.conversationHistory.join('\n')}`
        : '## 这是本轮开始。',
      '',
      `## 任务:`,
      instruction,
    ].join('\n');

    const historyLen = context.conversationHistory.length;
    const timeoutMs = Math.min(90_000 + historyLen * 5_000, 300_000);

    const rawResult = await callAIWithRetry({
      model: this.config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
      signal,
      timeoutMs,
      provider: llmOverrides?.provider,
      baseURL: llmOverrides?.baseURL,
      apiKey: llmOverrides?.apiKey,
    });

    if (rawResult.timedOut) {
      return { text: '', parsed: null, rawResult };
    }

    let parsed: any = null;
    try { parsed = JSON.parse(rawResult.text); } catch { /* not JSON */ }

    return { text: rawResult.text, parsed, rawResult };
  }

  protected normalizeResponse(data: any, rawText: string): { content: string; actions: any[] } {
    const content = data.reasoning || data.content || data.response?.answer || data.response?.question || rawText;
    let actions = data.actions || [];

    // problems[] → propose_card
    if (!actions.length && data.problems?.length) {
      actions = data.problems.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'problem', content: i.title || i.content || i },
      }));
    }
    // goals[] → propose_card
    if (!actions.length && data.goals?.length) {
      actions = data.goals.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'goal', content: i.title || i.content || i },
      }));
    }
    // stories[] → propose_card
    if (!actions.length && data.stories?.length) {
      actions = data.stories.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'user_story', content: i.title || i.content || i },
      }));
    }
    // requirements[] → propose_card
    if (!actions.length && data.requirements?.length) {
      actions = data.requirements.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'requirement', content: i.title || i.content || i },
      }));
    }
    // acceptance_criteria[] → propose_card
    if (!actions.length && data.acceptance_criteria?.length) {
      actions = data.acceptance_criteria.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'acceptance_criteria', content: i.title || i.content || i },
      }));
    }
    // metrics[] → propose_card
    if (!actions.length && data.metrics?.length) {
      actions = data.metrics.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'metric', content: i.title || i.content || i },
      }));
    }
    // decisions[] → propose_card
    if (!actions.length && data.decisions?.length) {
      actions = data.decisions.map((i: any) => ({
        type: 'propose_card',
        payload: { type: 'decision', content: i.title || i.content || i },
      }));
    }

    return { content, actions };
  }
}
