export type ProductRole =
  | 'pm'
  | 'ux'
  | 'data_analyst'
  | 'ba'
  | 'user_researcher'
  | 'tpm';

export const PRODUCT_ROLE_LABELS: Record<ProductRole, { cn: string; desc: string }> = {
  pm:              { cn: '产品经理', desc: '商业目标、ROI、路线图、优先级' },
  ux:              { cn: 'UX 设计师', desc: '用户流程、交互、可用性、用户满意度' },
  data_analyst:    { cn: '数据分析师', desc: '数据验证、埋点、AB 测试、指标定义' },
  ba:              { cn: '业务分析师', desc: '需求细化、验收条件、规则梳理' },
  user_researcher: { cn: '用户研究员', desc: '用户痛点、行为模式、需求真伪' },
  tpm:             { cn: '技术产品经理', desc: '技术可行性、API 设计、系统影响' },
};

export const PRODUCT_ROLE_COLORS: Record<ProductRole, string> = {
  pm:              '#1565C0',
  ux:              '#7B1FA2',
  data_analyst:    '#00897B',
  ba:              '#E65100',
  user_researcher: '#C62828',
  tpm:             '#2E7D32',
};

/** Status of a product agent instance */
export type AgentStatusType = 'idle' | 'thinking' | 'speaking' | 'waiting' | 'done' | 'error';

export interface AgentStatusInfo {
  agentId: string;
  role: ProductRole;
  perspective: string;
  label: string;
  color: string;
  model: string;
  status: AgentStatusType;
  message?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Configuration for one workshop participant */
export interface ProductAgentConfig {
  id: string;
  role: ProductRole;
  perspective: string;
  label: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  color: string;
  enabled: boolean;
}

/** A message sent by an agent during discussion */
export interface AgentMessage {
  id: string;
  sessionId: string;
  from: string;
  to: string | 'all' | 'user';
  content: string;
  phase: string;
  timestamp: number;
  type: 'thought' | 'question' | 'decision' | 'action' | 'chat';
  actions?: CanvasAction[];
  inputTokens?: number;
  outputTokens?: number;
}

/** Internal reasoning step */
export interface AgentThought {
  agentId: string;
  content: string;
  phase: string;
  visible: boolean;
}

/** Actions an agent can perform on the canvas */
export interface CanvasAction {
  type:
    | 'add_card'
    | 'add_cards'
    | 'remove_card'
    | 'update_card'
    | 'add_edge'
    | 'remove_edge'
    | 'invite_agent'
    | 'invite_all'
    | 'advance_phase'
    | 'request_decision'
    | 'wait_for_user'
    | 'summarize'
    | 'propose_card'
    | 'propose_edges'
    | 'disagree'
    | 'agree';
  payload: Record<string, unknown>;
}

/** A decision that needs user input */
export interface DecisionRequest {
  id: string;
  sessionId: string;
  phase: string;
  title: string;
  description: string;
  context: string[];
  options: DecisionOption[];
  from: string[];
  status: 'pending' | 'resolved' | 'skipped';
  createdAt: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
}

export interface DecisionResponse {
  requestId: string;
  optionId?: string;
  customInput?: string;
  action: 'select' | 'skip' | 'custom';
}
