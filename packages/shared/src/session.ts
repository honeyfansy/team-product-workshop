import type { ProductAgentConfig } from './agent.js';
import type { ProductCard } from './card.js';
import type { Edge } from './canvas.js';

export type SessionPhase =
  | 'problem_definition'
  | 'goal_alignment'
  | 'solution_exploration'
  | 'requirements_refinement'
  | 'priority_review'
  | 'complete';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'waiting_input' | 'complete' | 'error';

export type InterventionMode = 'automatic' | 'smart_pause' | 'manual';

export interface FlowConfig {
  id: string;
  name: string;
  description: string;
  phase: SessionPhase;
  phaseHistory: SessionPhase[];
  status: 'pending' | 'running' | 'complete';
}

export interface SessionConfig {
  topic: string;
  subTopics: string[];
  flows: FlowConfig[];
  agents: ProductAgentConfig[];
  interventionMode: InterventionMode;
  autoConfirmPhase: boolean;
  canvasChangeResponse: 'continue' | 'stop';
  llmProvider?: string;
  llmBaseURL?: string;
  llmApiKey?: string;
}

export interface Session {
  id: string;
  name: string;
  config: SessionConfig;
  status: SessionStatus;
  currentFlowIndex: number;
  phase: SessionPhase;
  phaseHistory: SessionPhase[];
  canvas: {
    cards: ProductCard[];
    edges: Edge[];
  };
  createdAt: number;
  updatedAt: number;
  pendingDecisions: number;
  unresolvedCount: number;
}
