import type { ProductAgentConfig, SessionConfig } from '@team-product-workshop/shared';
import { FacilitatorAgent } from './FacilitatorAgent.js';
import { ProductAgent } from './ProductAgent.js';
import { BaseAgent } from './BaseAgent.js';
import { AGENT_SYSTEM_PROMPTS } from '../orchestrator/phases.js';

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  constructor(config: SessionConfig) {
    for (const ac of config.agents) {
      if (!ac.enabled) continue;
      const detailedPrompt = AGENT_SYSTEM_PROMPTS[ac.role] || AGENT_SYSTEM_PROMPTS.default;
      const agent = this.createAgent({
        ...ac,
        systemPrompt: ac.systemPrompt || detailedPrompt,
      });
      if (agent) this.agents.set(ac.id, agent);
    }
  }

  private createAgent(ac: ProductAgentConfig): BaseAgent | null {
    // Facilitator uses special class; all others use ProductAgent
    if (ac.role === 'pm' && ac.perspective === 'facilitator') {
      return new FacilitatorAgent(ac);
    }
    return new ProductAgent(ac);
  }

  get(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  getActiveAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  getByRole(role: string): BaseAgent[] {
    return this.getAll().filter((a) => a.config.role === role);
  }

  getNonFacilitator(): BaseAgent[] {
    return this.getAll().filter((a) => !(a.config.role === 'pm' && a.config.perspective === 'facilitator'));
  }
}
