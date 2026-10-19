import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  type Node, type Edge as FlowEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useSessionStore } from '../store/useSessionStore.js';
import { IssueCardNode } from './IssueCardNode.js';
import type { ProductCardType } from '@team-product-workshop/shared';

const nodeTypes = { issueCard: IssueCardNode };

const PHASE_INFO: Record<string, { label: string; en: string; desc: string }> = {
  problem_definition:        { label: '问题定义', en: 'Problem Definition', desc: '明确要解决的问题' },
  goal_alignment:            { label: '目标对齐', en: 'Goal Alignment', desc: '对齐产品目标和成功指标' },
  solution_exploration:      { label: '方案探索', en: 'Solution Exploration', desc: '探索用户故事和需求' },
  requirements_refinement:   { label: '需求细化', en: 'Requirements Refinement', desc: '细化验收条件和规则' },
  priority_review:           { label: '优先级评审', en: 'Priority Review', desc: '评估优先级，制定行动Roadmap' },
  complete:                  { label: '已完成', en: 'Complete', desc: '产品需求工作坊完成！' },
};

const PHASES = ['problem_definition', 'goal_alignment', 'solution_exploration', 'requirements_refinement', 'priority_review'];

// Dynamic layout constants
const CARD_WIDTH = 180;
const CARD_GAP_X = 24;
const CARD_STEP_X = CARD_WIDTH + CARD_GAP_X;
const TYPE_GAP_Y = 40;
const CARD_HEADER_H = 20; // type label height
const CARD_FOOTER_H = 22; // author/tags area
const LINE_HEIGHT = 18;
const CHARS_PER_LINE = 11; // CJK chars per line in 180px width

const estimateCardHeight = (content: string): number => {
  const lines = Math.max(1, Math.ceil(String(content).length / CHARS_PER_LINE));
  return CARD_HEADER_H + CARD_FOOTER_H + lines * LINE_HEIGHT + 12; // +12 for padding
};

const TYPE_COLORS: Record<string, string> = {
  problem: '#F44336', goal: '#4CAF50', user_story: '#2196F3',
  requirement: '#FF9800', acceptance_criteria: '#9C27B0', metric: '#00BCD4',
  decision: '#FF5722', question: '#FFC107', action_item: '#3F51B5', note: '#607D8B',
};

export function ProductCanvas() {
  const cards = useSessionStore((s) => s.cards);
  const edges = useSessionStore((s) => s.edges);
  const phase = useSessionStore((s) => s.phase);
  const status = useSessionStore((s) => s.status);
  const agentStatuses = useSessionStore((s) => s.agentStatuses);
  const [thinkingStart, setThinkingStart] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const thinkingIds = agentStatuses.filter((a) => a.status === 'thinking').map((a) => a.agentId);
    setThinkingStart((prev) => {
      const next = { ...prev };
      for (const id of thinkingIds) { if (!next[id]) next[id] = Date.now(); }
      for (const id of Object.keys(next)) { if (!thinkingIds.includes(id)) delete next[id]; }
      return next;
    });
  }, [agentStatuses]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getThinkingTime = (id: string): string => {
    const start = thinkingStart[id];
    if (!start) return '';
    const elapsed = Math.floor((now - start) / 1000);
    if (elapsed < 3) return '';
    if (elapsed < 60) return `${elapsed}秒`;
    return `${Math.floor(elapsed / 60)}分${elapsed % 60}秒`;
  };

  // Detect cluster markers
  const clusterMap = useMemo(() => {
    const map = new Map<string, { label: string; cards: typeof cards }>();
    const ctxRegex = /【(cluster[：:]\s*[^】]+)】/i;
    for (const card of cards) {
      const m = card.content.match(ctxRegex);
      if (m) {
        const key = m[1].trim();
        if (!map.has(key)) map.set(key, { label: key, cards: [] });
        map.get(key)!.cards.push(card);
      }
    }
    return map;
  }, [cards]);

  const { nodes, flowEdges } = useMemo(() => {
    const groupNodes: Node[] = [];
    const groupColors = ['#E3F2FD', '#E8F5E9', '#FFF3E0', '#F3E5F5', '#E0F7FA', '#FBE9E7', '#F1F8E9', '#EDE7F6'];
    let ci = 0;
    const cardGroupMap = new Map<string, string>();
    for (const [key, cluster] of clusterMap) {
      const groupId = `cluster-group-${ci}`;
      groupNodes.push({
        id: groupId,
        type: 'group',
        position: { x: 0, y: 20 },
        data: { label: key },
        style: {
          width: 2600, height: 1400, background: groupColors[ci % groupColors.length],
          border: '1px solid #ccc', borderRadius: 8, opacity: 0.5,
        },
      });
      for (const c of cluster.cards) cardGroupMap.set(c.id, groupId);
      ci++;
    }

    // Dynamic layout: group by type, calculate row heights from content
    const typeOrder = ['problem', 'goal', 'user_story', 'requirement', 'acceptance_criteria', 'metric', 'decision', 'question', 'action_item', 'note'];
    const groupedByType = new Map<string, typeof cards>();
    for (const card of cards) {
      const arr = groupedByType.get(card.type) || [];
      arr.push(card);
      groupedByType.set(card.type, arr);
    }

    const cardNodes: Node[] = [];
    let currentY = 60;
    for (const type of typeOrder) {
      const typeCards = groupedByType.get(type);
      if (!typeCards || typeCards.length === 0) continue;

      // Calculate how many rows needed for this type
      const maxCol = Math.max(1, Math.floor(2500 / CARD_STEP_X));
      const rowsForType = Math.ceil(typeCards.length / maxCol);

      // Estimate max height of cards in this type
      let maxCardH = 0;
      typeCards.forEach(c => {
        const h = estimateCardHeight(c.content);
        if (h > maxCardH) maxCardH = h;
      });
      const typeRowHeight = maxCardH + TYPE_GAP_Y;

      typeCards.forEach((card, idx) => {
        const col = idx % maxCol;
        const row = Math.floor(idx / maxCol);
        const cardH = estimateCardHeight(card.content);

        cardNodes.push({
          id: card.id,
          type: 'issueCard',
          parentId: cardGroupMap.get(card.id),
          position: {
            x: 40 + col * CARD_STEP_X,
            y: currentY + row * (cardH + 8),
          },
          data: {
            label: card.content,
            cardType: card.type,
            author: card.author,
            phase: card.phase,
            status: card.status,
            tags: card.tags || [],
          },
        });
      });

      currentY += typeRowHeight * rowsForType;
    }

    const nodes: Node[] = [...groupNodes, ...cardNodes];

    const flowEdges: FlowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: true,
      label: edgeLabel(e.type),
      style: { stroke: '#999', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#999' },
      labelStyle: { fontSize: 10, fill: '#666' },
    }));

    return { nodes, flowEdges };
  }, [cards, edges]);

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.phaseBadge}>
          <div style={styles.phaseLabel}>
            阶段 {PHASES.indexOf(phase) + 1}/{PHASES.length}: <strong>{PHASE_INFO[phase]?.label || phase}</strong>
          </div>
          <div style={styles.phaseEn}>{PHASE_INFO[phase]?.en || ''} — {PHASE_INFO[phase]?.desc || ''}</div>
        </div>
        {agentStatuses.filter((a) => a.status === 'thinking').map((a) => {
          const elapsed = getThinkingTime(a.agentId);
          const tooLong = (thinkingStart[a.agentId] && now - thinkingStart[a.agentId] > 60000);
          return (
            <span key={a.agentId} style={{
              ...styles.thinkingPill,
              ...(tooLong ? styles.thinkingPillSlow : {}),
            }}>
              ◌ {a.label} 思考中{elapsed ? ` (${elapsed})` : ''}
              {tooLong ? ' ⚠️' : ''}
            </span>
          );
        })}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{ background: '#FAFBFC' }}
        nodesDraggable={true}
        nodesConnectable={false}
      >
        <Background color="#eee" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => {
            const type = (n.data as any)?.cardType as string;
            return TYPE_COLORS[type] || '#ccc';
          }}
          style={{ border: '1px solid #ddd' }}
        />
      </ReactFlow>

      {/* Card legend */}
      <div style={styles.legend}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: color }} />
            <span style={styles.legendLabel}>{type}</span>
          </div>
        ))}
        <div style={styles.legendCount}>
          卡片: {cards.length} | 连线: {edges.length}
        </div>
      </div>
    </div>
  );
}

function edgeLabel(type: string): string {
  const labels: Record<string, string> = {
    supports: '支持', opposes: '反对', relates_to: '相关',
    leads_to: '导致', alternative_to: '替代', refines: '细化',
  };
  return labels[type] || type;
}

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
    display: 'flex', alignItems: 'flex-start', gap: 12,
    pointerEvents: 'none',
  },
  phaseBadge: {
    background: 'rgba(255,255,255,0.95)', padding: '8px 16px',
    borderRadius: 12, fontSize: 13,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    pointerEvents: 'auto',
  },
  phaseLabel: { fontSize: 13, fontWeight: 500 },
  phaseEn: { fontSize: 11, color: '#888', marginTop: 2 },
  thinkingPill: {
    background: 'rgba(255,152,0,0.15)', color: '#E65100',
    padding: '4px 12px', borderRadius: 16, fontSize: 12,
    fontWeight: 500,
    animation: 'pulse 1.5s ease-in-out infinite',
    pointerEvents: 'auto',
  },
  thinkingPillSlow: {
    background: 'rgba(244,67,54,0.15)', color: '#C62828',
    animation: 'pulse 0.8s ease-in-out infinite',
  },
  legend: {
    position: 'absolute', bottom: 12, left: 12, zIndex: 10,
    background: 'rgba(255,255,255,0.9)', padding: '8px 12px',
    borderRadius: 8, display: 'flex', gap: 10, flexWrap: 'wrap',
    fontSize: 11, boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    pointerEvents: 'auto',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: '50%' },
  legendLabel: { color: '#666' },
  legendCount: { color: '#999', fontFamily: 'monospace', marginLeft: 8, borderLeft: '1px solid #ddd', paddingLeft: 8 },
};
