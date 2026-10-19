export type ProductCardType =
  | 'problem'
  | 'goal'
  | 'user_story'
  | 'requirement'
  | 'acceptance_criteria'
  | 'metric'
  | 'decision'
  | 'question'
  | 'action_item'
  | 'note';

export type CardStatus = 'active' | 'draft' | 'archived' | 'selected';

export interface ProductCard {
  id: string;
  type: ProductCardType;
  content: string;
  position: { x: number; y: number };
  author: string;
  status: CardStatus;
  phase: string;
  round: number;
  flowId: string;
  parentId?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, string>;
}

export const CARD_COLORS: Record<ProductCardType, { bg: string; border: string; label: string }> = {
  problem:            { bg: '#FFEBEE', border: '#F44336', label: 'Problem' },
  goal:               { bg: '#E8F5E9', border: '#4CAF50', label: 'Goal' },
  user_story:         { bg: '#E3F2FD', border: '#2196F3', label: 'User Story' },
  requirement:        { bg: '#FFF3E0', border: '#FF9800', label: 'Requirement' },
  acceptance_criteria: { bg: '#F3E5F5', border: '#9C27B0', label: 'Acceptance' },
  metric:             { bg: '#E0F7FA', border: '#00BCD4', label: 'Metric' },
  decision:           { bg: '#FBE9E7', border: '#FF5722', label: 'Decision' },
  question:           { bg: '#FFF8E1', border: '#FFC107', label: 'Question' },
  action_item:        { bg: '#E8EAF6', border: '#3F51B5', label: 'Action' },
  note:               { bg: '#ECEFF1', border: '#607D8B', label: 'Note' },
};
