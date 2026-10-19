import type { ProductCard, CanvasChange, Edge } from '@team-product-workshop/shared';
import { randomUUID } from 'crypto';

export class CanvasManager {
  private cards: Map<string, ProductCard> = new Map();
  private edges: Map<string, Edge> = new Map();
  private changeListeners: Array<(change: CanvasChange) => void> = [];

  constructor(public readonly sessionId: string) {}

  onChange(cb: (change: CanvasChange) => void) {
    this.changeListeners.push(cb);
  }

  private emit(change: CanvasChange) {
    for (const cb of this.changeListeners) cb(change);
  }

  addCard(card: Omit<ProductCard, 'id' | 'createdAt' | 'updatedAt'>): ProductCard {
    const newCard: ProductCard = {
      ...card,
      id: randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.cards.set(newCard.id, newCard);
    this.emit({ type: 'card_added', card: newCard, timestamp: Date.now() });
    return newCard;
  }

  addCards(cards: Omit<ProductCard, 'id' | 'createdAt' | 'updatedAt'>[]): ProductCard[] {
    return cards.map((c) => this.addCard(c));
  }

  removeCard(id: string) {
    this.cards.delete(id);
    this.emit({ type: 'card_removed', cardId: id, timestamp: Date.now() });
  }

  updateCard(id: string, updates: Partial<ProductCard>): ProductCard | undefined {
    const card = this.cards.get(id);
    if (!card) return undefined;
    const updated = { ...card, ...updates, updatedAt: Date.now() };
    this.cards.set(id, updated);
    this.emit({ type: 'card_updated', card: updated, timestamp: Date.now() });
    return updated;
  }

  moveCard(id: string, position: { x: number; y: number }) {
    return this.updateCard(id, { position });
  }

  addEdge(edge: Omit<Edge, 'id'>): Edge {
    const newEdge: Edge = { ...edge, id: randomUUID() };
    this.edges.set(newEdge.id, newEdge);
    this.emit({ type: 'edge_added', edge: newEdge, timestamp: Date.now() });
    return newEdge;
  }

  removeEdge(id: string) {
    this.edges.delete(id);
    this.emit({ type: 'edge_removed', timestamp: Date.now() });
  }

  getCards(): ProductCard[] {
    return Array.from(this.cards.values());
  }

  getEdges(): Edge[] {
    return Array.from(this.edges.values());
  }

  getState() {
    return {
      sessionId: this.sessionId,
      cards: this.getCards(),
      edges: this.getEdges(),
    };
  }

  getStateSummary(flowId?: string): string {
    const cards = flowId
      ? Array.from(this.cards.values()).filter((c) => c.flowId === flowId)
      : Array.from(this.cards.values());
    const edges = flowId
      ? Array.from(this.edges.values()).filter((e) => e.flowId === flowId)
      : Array.from(this.edges.values());

    const byType = new Map<string, ProductCard[]>();
    for (const card of cards) {
      const arr = byType.get(card.type) || [];
      arr.push(card);
      byType.set(card.type, arr);
    }

    const parts: string[] = [];
    for (const [type, typeCards] of byType) {
      parts.push(`  ${type} (${typeCards.length}): ${typeCards.map((c) => c.content).join(', ')}`);
    }

    const edgeList = edges.length > 0
      ? `\nEdges:\n${edges.map((e) => `  ${e.source} -> ${e.target} [${e.type}]`).join('\n')}`
      : '';

    return `Cards:\n${parts.join('\n')}${edgeList}`;
  }

  getCardsByFlow(flowId: string): ProductCard[] {
    return Array.from(this.cards.values()).filter((c) => c.flowId === flowId);
  }

  getEdgesByFlow(flowId: string): Edge[] {
    return Array.from(this.edges.values()).filter((e) => e.flowId === flowId);
  }

  getFlowsState(flowId: string) {
    return {
      sessionId: this.sessionId,
      cards: this.getCardsByFlow(flowId),
      edges: this.getEdgesByFlow(flowId),
    };
  }
}
