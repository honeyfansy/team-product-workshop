import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../store/useSessionStore.js';
import { fetchConfig, fetchDetectedAgents, type BackendConfig, type DetectedAgent } from '../store/api.js';
import { PRODUCT_ROLE_LABELS, PRODUCT_ROLE_COLORS, type ProductRole, type SessionConfig, type ProductAgentConfig } from '@team-product-workshop/shared';

const PRODUCT_ROLES: ProductRole[] = ['pm', 'ux', 'data_analyst', 'ba', 'user_researcher', 'tpm'];

const ROLE_DISPLAY: Record<string, { cn: string; color: string }> = {
  pm:              { cn: '产品经理', color: '#1565C0' },
  ux:              { cn: 'UX 设计师', color: '#7B1FA2' },
  data_analyst:    { cn: '数据分析师', color: '#00897B' },
  ba:              { cn: '业务分析师', color: '#E65100' },
  user_researcher: { cn: '用户研究员', color: '#C62828' },
  tpm:             { cn: '技术产品经理', color: '#2E7D32' },
};

interface AgentInstance {
  id: string;
  role: ProductRole;
  perspective: string;
  label: string;
  color: string;
  model: string;
  temperature: number;
  enabled: boolean;
}

export function SessionSetup() {
  const createSession = useSessionStore((s) => s.createSession);
  const wsConnected = useSessionStore((s) => s.connected);

  const [topic, setTopic] = useState('');
  const [subTopicsText, setSubTopicsText] = useState('');
  const [mode, setMode] = useState<'smart_pause' | 'automatic' | 'manual'>('smart_pause');
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(null);
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [configError, setConfigError] = useState('');

  const [agentInstances, setAgentInstances] = useState<AgentInstance[]>(() => getDefaultInstances([]));
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});

  function getDefaultInstances(models: string[]): AgentInstance[] {
    const defaultModel = models[0] || '';
    return [
      {
        id: 'facilitator',
        role: 'pm',
        perspective: 'facilitator',
        label: '引导者',
        color: '#9E9E9E',
        model: defaultModel,
        temperature: 0.3,
        enabled: true,
      },
      {
        id: 'pm-1',
        role: 'pm',
        perspective: '',
        label: '产品经理',
        color: PRODUCT_ROLE_COLORS.pm,
        model: defaultModel,
        temperature: 0.6,
        enabled: true,
      },
      {
        id: 'ux-1',
        role: 'ux',
        perspective: '',
        label: 'UX 设计师',
        color: PRODUCT_ROLE_COLORS.ux,
        model: defaultModel,
        temperature: 0.7,
        enabled: true,
      },
      {
        id: 'ba-1',
        role: 'ba',
        perspective: '',
        label: '业务分析师',
        color: PRODUCT_ROLE_COLORS.ba,
        model: defaultModel,
        temperature: 0.5,
        enabled: true,
      },
      {
        id: 'data_analyst-1',
        role: 'data_analyst',
        perspective: '',
        label: '数据分析师',
        color: PRODUCT_ROLE_COLORS.data_analyst,
        model: defaultModel,
        temperature: 0.4,
        enabled: true,
      },
      {
        id: 'user_researcher-1',
        role: 'user_researcher',
        perspective: '',
        label: '用户研究员',
        color: PRODUCT_ROLE_COLORS.user_researcher,
        model: defaultModel,
        temperature: 0.5,
        enabled: true,
      },
    ];
  }

  function getSelectedAgentModels(): string[] {
    if (selectedAgentId && detectedAgents.length > 0) {
      const agent = detectedAgents.find((a) => a.id === selectedAgentId);
      if (agent?.models?.length) return agent.models;
    }
    return backendConfig?.availableModels || [];
  }

  useEffect(() => {
    Promise.all([
      fetchConfig(),
      fetchDetectedAgents(),
    ]).then(([cfg, agentsList]) => {
      setBackendConfig(cfg);
      setDetectedAgents(agentsList);
      setConfigError('');

      const preferred = agentsList.find((a) => a.source === 'config')
        || agentsList.find((a) => a.id === 'claude-code')
        || agentsList.find((a) => a.id === 'openai')
        || agentsList[0];
      const agentId = preferred?.id || '';
      setSelectedAgentId(agentId);

      const models = preferred?.models?.length ? preferred.models : cfg.availableModels;
      if (models.length > 0) {
        setAgentInstances(getDefaultInstances(models));
        const sel: Record<string, string> = {};
        for (const inst of getDefaultInstances(models)) {
          sel[inst.role] = inst.model;
        }
        setModelSelections(sel);
      }
      setLoadingAgents(false);
    }).catch(() => {
      setConfigError('Cannot connect to backend — is it running on port 3002?');
      setLoadingAgents(false);
    });
  }, []);

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = detectedAgents.find((a) => a.id === agentId);
    const models = agent?.models?.length ? agent.models : (backendConfig?.availableModels || []);
    const defaultModel = models[0] || '';
    setAgentInstances((prev) => prev.map((a) => ({
      ...a,
      model: modelSelections[a.role] || defaultModel,
    })));
  };

  const updateInstance = (id: string, updates: Partial<AgentInstance>) => {
    setAgentInstances((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
  };

  const removeInstance = (id: string) => {
    if (id === 'facilitator') return;
    setAgentInstances((prev) => prev.filter((a) => a.id !== id));
  };

  const addInstance = (role: ProductRole) => {
    const models = getSelectedAgentModels();
    const defaultModel = models[0] || '';
    const count = agentInstances.filter((a) => a.role === role).length;
    const newId = `${role}-${count + 1}`;
    setAgentInstances((prev) => [...prev, {
      id: newId,
      role,
      perspective: '',
      label: PRODUCT_ROLE_LABELS[role].cn,
      color: PRODUCT_ROLE_COLORS[role],
      model: modelSelections[role] || defaultModel,
      temperature: 0.6,
      enabled: true,
    }]);
  };

  const handleStart = () => {
    if (!topic.trim()) return;

    const flowConfigs = [{
      id: crypto.randomUUID(),
      name: topic.trim().slice(0, 40),
      description: topic.trim(),
      phase: 'problem_definition' as const,
      phaseHistory: [] as any[],
      status: 'pending' as const,
    }];

    const models = getSelectedAgentModels();
    const fallbackModel = models[0] || '';
    const selectedAgent = detectedAgents.find((a) => a.id === selectedAgentId);

    const finalInstances = agentInstances.filter((a) => a.enabled).map((a) => ({
      ...a,
      model: a.model || modelSelections[a.role] || fallbackModel,
    }));

    const agentConfigs: ProductAgentConfig[] = finalInstances.map((a) => ({
      id: a.id,
      role: a.role,
      perspective: a.perspective,
      label: a.label,
      model: a.model,
      temperature: a.temperature,
      systemPrompt: '',
      color: a.color,
      enabled: true,
    }));

    const subTopics = subTopicsText.split('\n').map((s) => s.trim()).filter(Boolean);

    const config: SessionConfig = {
      topic: topic.trim(),
      subTopics,
      flows: flowConfigs,
      agents: agentConfigs,
      interventionMode: mode,
      autoConfirmPhase: mode === 'automatic',
      canvasChangeResponse: 'continue',
      llmProvider: selectedAgent?.provider || backendConfig?.currentProvider || 'anthropic',
      llmBaseURL: selectedAgent?.baseURL || '',
      llmApiKey: selectedAgent?.apiKey || '',
    };

    createSession(config, models);
  };

  const currentModels = getSelectedAgentModels();
  const selectedAgentObj = detectedAgents.find((a) => a.id === selectedAgentId);

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Team Product Workshop</h1>
          <p style={styles.subtitle}>多 Agent 并行产品需求讨论工作坊</p>
          {configError && <p style={styles.error}>{configError}</p>}
          {selectedAgentObj && (
            <p style={styles.providerBadge}>
              AI: {selectedAgentObj.name} · {selectedAgentObj.models.length} models
            </p>
          )}
        </div>

        <div style={styles.form}>
          {/* Topic */}
          <div style={styles.field}>
            <label style={styles.label}>讨论主题</label>
            <textarea
              style={styles.textarea}
              placeholder="描述你要讨论的产品需求，例如：提升新用户激活率的方案"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          {/* Sub-topics */}
          <div style={styles.field}>
            <label style={styles.label}>子话题（可选，每行一个）</label>
            <textarea
              style={{ ...styles.textarea, fontSize: 13 }}
              placeholder="如果你希望讨论按子话题分层，可以在此列出，每行一个"
              value={subTopicsText}
              onChange={(e) => setSubTopicsText(e.target.value)}
              rows={3}
            />
          </div>

          {/* Intervention Mode */}
          <div style={styles.field}>
            <label style={styles.label}>干预模式</label>
            <div style={styles.modes}>
              {[
                { value: 'smart_pause' as const, label: '🧠 Smart Pause', desc: '在分歧和决策点时暂停' },
                { value: 'automatic' as const, label: '🤖 Fully Auto', desc: '全自动运行，不需干预' },
                { value: 'manual' as const, label: '🎮 Manual', desc: '每一步都需要确认' },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  style={{ ...styles.modeBtn, ...(mode === m.value ? styles.modeBtnActive : {}) }}
                >
                  <strong>{m.label}</strong>
                  <span style={styles.modeDesc}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Backend */}
          <div style={styles.field}>
            <label style={styles.label}>AI 后端 / LLM 供应商</label>
            {loadingAgents ? (
              <p style={styles.loadingModels}>检测本地 AI Agent...</p>
            ) : detectedAgents.length === 0 ? (
              <p style={{ ...styles.loadingModels, color: '#f44336' }}>未检测到本地 AI Agent</p>
            ) : (
              <div style={styles.agentList}>
                {detectedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => handleAgentChange(agent.id)}
                    style={{
                      ...styles.agentCard,
                      ...(selectedAgentId === agent.id ? styles.agentCardActive : {}),
                    }}
                  >
                    <div style={styles.agentCardHeader}>
                      <input
                        type="radio"
                        checked={selectedAgentId === agent.id}
                        onChange={() => handleAgentChange(agent.id)}
                        style={{ accentColor: '#1a237e' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{agent.name}</span>
                      <span style={styles.sourceTag}>{agent.source}</span>
                    </div>
                    <div style={styles.agentCardMeta}>
                      <span style={styles.agentCardDesc}>{agent.description}</span>
                      <span style={styles.agentCardModels}>{agent.models.length > 0 ? `${agent.models.length} 个模型可用` : '获取模型中...'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model config per role */}
          {currentModels.length > 0 && (
            <div style={styles.field}>
              <label style={styles.label}>各角色的模型配置</label>
              {currentModels.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: '#4f46e5', width: 100, whiteSpace: 'nowrap' }}>⚡ 设为全部</span>
                  <select value={modelSelections['facilitator'] || currentModels[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated: Record<string, string> = {};
                      ['facilitator', ...PRODUCT_ROLES].forEach((r) => { updated[r] = val; });
                      setModelSelections(updated);
                      setAgentInstances((prev) => prev.map((a) => ({ ...a, model: val })));
                    }}
                    style={{ flex: 1, padding: '2px 6px', borderRadius: 4, border: '1px solid #c7d2fe', fontSize: 12, background: 'white' }}>
                    {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                  </select>
                  <button onClick={() => {
                    const model = modelSelections['facilitator'] || currentModels[0];
                    const updated: Record<string, string> = {};
                    ['facilitator', ...PRODUCT_ROLES].forEach((r) => { updated[r] = model; });
                    setModelSelections(updated);
                    setAgentInstances((prev) => prev.map((a) => ({ ...a, model })));
                  }} style={{
                    padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: '#4f46e5', color: 'white', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  }}>应用到全部</button>
                </div>
              )}
              <div style={styles.modelGrid}>
                {['facilitator', ...PRODUCT_ROLES].map((role) => {
                  const display = role === 'facilitator' ? { cn: '引导者', color: '#9E9E9E' } : ROLE_DISPLAY[role];
                  return (
                    <div key={role} style={styles.modelRow}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: display?.color, width: 100 }}>{display?.cn || role}</span>
                      <select
                        value={modelSelections[role] || currentModels[0]}
                        onChange={(e) => {
                          const newModel = e.target.value;
                          setModelSelections((prev) => ({ ...prev, [role]: newModel }));
                          setAgentInstances((prev) =>
                            prev.map((a) => {
                              if (role === 'facilitator' && a.id === 'facilitator') return { ...a, model: newModel };
                              if (a.role === role && a.id !== 'facilitator') return { ...a, model: newModel };
                              return a;
                            })
                          );
                        }}
                        style={styles.modelSelect}
                      >
                        {currentModels.map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agent Instances */}
          <div style={styles.field}>
            <label style={styles.label}>参与者配置 <span style={styles.labelHint}>（可添加多个相同角色的参与者）</span></label>
            <div style={styles.instanceList}>
              {agentInstances.filter((a) => a.enabled).map((inst) => (
                <div key={inst.id} style={{ ...styles.instanceRow, borderLeftColor: inst.color }}>
                  <div style={styles.instanceInfo}>
                    <span style={{ ...styles.instanceStyle, color: inst.color }}>
                      {inst.id === 'facilitator' ? '🎙️ 引导者' : (ROLE_DISPLAY[inst.role]?.cn || inst.role)}
                    </span>
                    <input
                      style={styles.perspectiveInput}
                      placeholder={inst.id === 'facilitator' ? '引导者不需要视角' : '专业视角（如：增长、商业化、平台...）'}
                      value={inst.perspective}
                      onChange={(e) => updateInstance(inst.id, { perspective: e.target.value, label: e.target.value || ROLE_DISPLAY[inst.role]?.cn || inst.role })}
                      disabled={inst.id === 'facilitator'}
                    />
                  </div>
                  <div style={styles.instanceActions}>
                    <span style={styles.instanceId}>{inst.id}</span>
                    {inst.id !== 'facilitator' && (
                      <button onClick={() => removeInstance(inst.id)} style={styles.removeBtn}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add more agents */}
            <div style={styles.addAgentRow}>
              <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>添加参与者：</span>
              {PRODUCT_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => addInstance(role)}
                  style={{ ...styles.addStyleBtn, borderColor: PRODUCT_ROLE_COLORS[role], color: PRODUCT_ROLE_COLORS[role] }}
                  title={PRODUCT_ROLE_LABELS[role].desc}
                >
                  +{ROLE_DISPLAY[role]?.cn || role}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!topic.trim() || !wsConnected}
            style={{
              ...styles.startBtn,
              opacity: topic.trim() && wsConnected ? 1 : 0.5,
              cursor: topic.trim() && wsConnected ? 'pointer' : 'not-allowed',
            }}
          >
            {wsConnected ? '🚀 开始产品需求讨论' : '⏳ 连接服务器中...'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100vw', height: '100vh', overflow: 'auto',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a237e 0%, #4a148c 100%)',
    padding: '20px 0',
  },
  card: {
    background: 'white', borderRadius: 16, padding: '24px 32px',
    width: 700, maxWidth: '90vw', marginBottom: 40,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: { marginBottom: 24, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: 700, color: '#333' },
  subtitle: { color: '#888', marginTop: 8, fontSize: 14 },
  error: { color: '#f44336', fontSize: 13, marginTop: 8 },
  providerBadge: {
    display: 'inline-block', marginTop: 8, padding: '2px 10px',
    background: '#e8f5e9', borderRadius: 12, fontSize: 12, color: '#2e7d32',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontWeight: 600, color: '#555', fontSize: 14 },
  labelHint: { fontWeight: 400, fontSize: 12, color: '#999' },
  textarea: {
    padding: 12, borderRadius: 8, border: '1px solid #ddd',
    fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  modes: { display: 'flex', flexDirection: 'column', gap: 8 },
  modeBtn: {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0',
    background: '#fafafa', cursor: 'pointer', textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  modeBtnActive: { borderColor: '#1a237e', background: '#f0f0ff' },
  modeDesc: { fontSize: 12, color: '#888' },
  agentList: { display: 'flex', flexDirection: 'column', gap: 8 },
  agentCard: {
    padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0',
    background: '#fafafa', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
  },
  agentCardActive: { borderColor: '#1a237e', background: '#f0f0ff' },
  agentCardHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  sourceTag: {
    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
    background: '#e0e0e0', color: '#666', textTransform: 'uppercase',
  },
  agentCardMeta: { display: 'flex', justifyContent: 'space-between', marginLeft: 24 },
  agentCardDesc: { fontSize: 12, color: '#888' },
  agentCardModels: { fontSize: 12, color: '#1a237e', fontWeight: 600 },
  modelGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  modelRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 10px', background: '#f9f9f9', borderRadius: 8,
  },
  modelSelect: {
    flex: 1, padding: '4px 8px', borderRadius: 6,
    border: '1px solid #ddd', fontSize: 12, background: 'white',
  },
  loadingModels: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  instanceList: { display: 'flex', flexDirection: 'column', gap: 6 },
  instanceRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px', background: '#f9f9f9', borderRadius: 8,
    borderLeft: '3px solid',
  },
  instanceInfo: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 },
  instanceStyle: { fontWeight: 600, fontSize: 13, minWidth: 100 },
  perspectiveInput: {
    flex: 1, padding: '4px 8px', borderRadius: 6,
    border: '1px solid #ddd', fontSize: 12, background: 'white',
    maxWidth: 280,
  },
  instanceActions: { display: 'flex', alignItems: 'center', gap: 6 },
  instanceId: { fontSize: 10, color: '#bbb', fontFamily: 'monospace' },
  removeBtn: {
    width: 20, height: 20, borderRadius: '50%', border: 'none',
    background: '#ffebee', color: '#f44336', fontSize: 12,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addAgentRow: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    padding: '8px 0',
  },
  addStyleBtn: {
    padding: '4px 10px', borderRadius: 12, border: '1px solid',
    background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  },
  startBtn: {
    padding: '14px 24px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #1a237e 0%, #4a148c 100%)',
    color: 'white', fontSize: 16, fontWeight: 600,
  },
};
