/**
 * Causal DAG Execution Engine
 *
 * Implements causal graph operations for intervention estimation
 * using do-calculus and structural causal models.
 */

export interface CausalNode {
  id: string
  parents: string[]
  children: string[]
  metadata?: Record<string, unknown>
}

export interface InterventionRequest {
  nodeId: string
  value: unknown
  context?: Record<string, unknown>
}

export interface InterventionResult {
  nodeId: string
  estimatedEffect: number
  confidence: number
  timestamp: string
  ancestors: string[]
  descendants: string[]
}

export interface CausalDagService {
  addNode(id: string, metadata?: Record<string, unknown>): void
  addEdge(from: string, to: string, weight?: number): void
  removeNode(id: string): void
  removeEdge(from: string, to: string): void
  estimateIntervention(
    request: InterventionRequest,
  ): Promise<InterventionResult>
  getAncestors(nodeId: string): string[]
  getDescendants(nodeId: string): string[]
  getGraph(): {
    nodes: string[]
    edges: Array<{ from: string; to: string; weight?: number }>
  }
}

export class DefaultCausalDagService implements CausalDagService {
  private nodes: Map<string, CausalNode> = new Map()
  private edges: Map<string, Map<string, number>> = new Map()

  addNode(id: string, metadata?: Record<string, unknown>): void {
    if (this.nodes.has(id)) {
      throw new Error(`Node ${id} already exists`)
    }
    this.nodes.set(id, { id, parents: [], children: [], metadata })
  }

  addEdge(from: string, to: string, weight: number = 1.0): void {
    const fromNode = this.nodes.get(from)
    const toNode = this.nodes.get(to)

    if (!fromNode || !toNode) {
      throw new Error(`Node ${from} or ${to} does not exist`)
    }

    // Check for cycles
    if (this.wouldCreateCycle(from, to)) {
      throw new Error(`Adding edge ${from} -> ${to} would create a cycle`)
    }

    // Update graph structure
    fromNode.children.push(to)
    toNode.parents.push(from)

    // Store edge weight
    if (!this.edges.has(from)) {
      this.edges.set(from, new Map())
    }
    this.edges.get(from)!.set(to, weight)
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id)
    if (!node) return

    // Remove all edges to/from this node
    for (const parentId of node.parents) {
      const parent = this.nodes.get(parentId)
      if (parent) {
        parent.children = parent.children.filter((c) => c !== id)
      }
      this.edges.get(parentId)?.delete(id)
    }

    for (const childId of node.children) {
      const child = this.nodes.get(childId)
      if (child) {
        child.parents = child.parents.filter((p) => p !== id)
      }
    }
    this.edges.delete(id)

    this.nodes.delete(id)
  }

  removeEdge(from: string, to: string): void {
    const fromNode = this.nodes.get(from)
    const toNode = this.nodes.get(to)

    if (fromNode) {
      fromNode.children = fromNode.children.filter((c) => c !== to)
    }
    if (toNode) {
      toNode.parents = toNode.parents.filter((p) => p !== from)
    }

    this.edges.get(from)?.delete(to)
  }

  async estimateIntervention(
    request: InterventionRequest,
  ): Promise<InterventionResult> {
    const { nodeId } = request
    const node = this.nodes.get(nodeId)

    if (!node) {
      throw new Error(`Node ${nodeId} does not exist`)
    }

    const ancestors = this.getAncestors(nodeId)
    const descendants = this.getDescendants(nodeId)

    // Estimate causal effect using path analysis
    // Simple model: effect = sum of weighted paths from ancestors to descendants through intervened node
    let estimatedEffect = 0.0
    let pathCount = 0

    for (const ancestor of ancestors) {
      for (const descendant of descendants) {
        const ancestorWeight = this.getPathWeight(ancestor, nodeId)
        const descendantWeight = this.getPathWeight(nodeId, descendant)
        estimatedEffect += ancestorWeight * descendantWeight
        pathCount++
      }
    }

    // Normalize by path count
    if (pathCount > 0) {
      estimatedEffect /= Math.sqrt(pathCount)
    }

    // Confidence based on graph connectivity
    const confidence = Math.min(
      1.0,
      (ancestors.length + descendants.length) / 10,
    )

    return {
      nodeId,
      estimatedEffect,
      confidence,
      timestamp: new Date().toISOString(),
      ancestors,
      descendants,
    }
  }

  getAncestors(nodeId: string): string[] {
    const ancestors = new Set<string>()
    const queue = [nodeId]

    while (queue.length > 0) {
      const current = queue.shift()!
      const node = this.nodes.get(current)
      if (!node) continue

      for (const parentId of node.parents) {
        if (!ancestors.has(parentId)) {
          ancestors.add(parentId)
          queue.push(parentId)
        }
      }
    }

    return Array.from(ancestors)
  }

  getDescendants(nodeId: string): string[] {
    const descendants = new Set<string>()
    const queue = [nodeId]

    while (queue.length > 0) {
      const current = queue.shift()!
      const node = this.nodes.get(current)
      if (!node) continue

      for (const childId of node.children) {
        if (!descendants.has(childId)) {
          descendants.add(childId)
          queue.push(childId)
        }
      }
    }

    return Array.from(descendants)
  }

  getGraph(): {
    nodes: string[]
    edges: Array<{ from: string; to: string; weight?: number }>
  } {
    const nodes = Array.from(this.nodes.keys())
    const edges: Array<{ from: string; to: string; weight?: number }> = []

    for (const [from, targets] of this.edges.entries()) {
      for (const [to, weight] of targets.entries()) {
        edges.push({ from, to, weight })
      }
    }

    return { nodes, edges }
  }

  private wouldCreateCycle(from: string, to: string): boolean {
    // Check if 'to' can reach 'from' via existing paths
    const visited = new Set<string>()
    const queue = [to]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (current === from) return true
      if (visited.has(current)) continue
      visited.add(current)

      const node = this.nodes.get(current)
      if (!node) continue

      for (const childId of node.children) {
        queue.push(childId)
      }
    }

    return false
  }

  private getPathWeight(from: string, to: string): number {
    if (from === to) return 1.0

    const visited = new Set<string>()
    const queue: Array<{ node: string; weight: number }> = [
      { node: from, weight: 1.0 },
    ]

    while (queue.length > 0) {
      const { node: current, weight } = queue.shift()!
      if (current === to) return weight
      if (visited.has(current)) continue
      visited.add(current)

      const edges = this.edges.get(current)
      if (!edges) continue

      for (const [childId, edgeWeight] of edges.entries()) {
        queue.push({ node: childId, weight: weight * edgeWeight })
      }
    }

    return 0.0
  }
}

export const causalDagService = new DefaultCausalDagService()
