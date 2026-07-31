import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultCausalDagService } from '../lib/causal/causal-dag'

describe('CausalDagService', () => {
  let service: DefaultCausalDagService

  beforeEach(() => {
    service = new DefaultCausalDagService()
  })

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      service.addNode('A')
      const graph = service.getGraph()
      expect(graph.nodes).toContain('A')
    })

    it('should add a node with metadata', () => {
      service.addNode('A', { type: 'intervention', weight: 0.5 })
      const graph = service.getGraph()
      expect(graph.nodes).toContain('A')
    })

    it('should throw error when adding duplicate node', () => {
      service.addNode('A')
      expect(() => service.addNode('A')).toThrow('Node A already exists')
    })
  })

  describe('addEdge', () => {
    it('should add an edge between existing nodes', () => {
      service.addNode('A')
      service.addNode('B')
      service.addEdge('A', 'B')

      const graph = service.getGraph()
      expect(graph.edges).toContainEqual({ from: 'A', to: 'B', weight: 1.0 })
    })

    it('should add an edge with custom weight', () => {
      service.addNode('A')
      service.addNode('B')
      service.addEdge('A', 'B', 0.7)

      const graph = service.getGraph()
      expect(graph.edges).toContainEqual({ from: 'A', to: 'B', weight: 0.7 })
    })

    it('should throw error when adding edge to non-existent node', () => {
      service.addNode('A')
      expect(() => service.addEdge('A', 'B')).toThrow()
    })

    it('should throw error when edge would create cycle', () => {
      service.addNode('A')
      service.addNode('B')
      service.addNode('C')
      service.addEdge('A', 'B')
      service.addEdge('B', 'C')
      expect(() => service.addEdge('C', 'A')).toThrow('cycle')
    })
  })

  describe('getAncestors', () => {
    it('should return all ancestors of a node', () => {
      service.addNode('A')
      service.addNode('B')
      service.addNode('C')
      service.addEdge('A', 'B')
      service.addEdge('B', 'C')

      const ancestors = service.getAncestors('C')
      expect(ancestors).toContain('A')
      expect(ancestors).toContain('B')
      expect(ancestors).toHaveLength(2)
    })

    it('should return empty array for root node', () => {
      service.addNode('A')
      const ancestors = service.getAncestors('A')
      expect(ancestors).toHaveLength(0)
    })
  })

  describe('getDescendants', () => {
    it('should return all descendants of a node', () => {
      service.addNode('A')
      service.addNode('B')
      service.addNode('C')
      service.addEdge('A', 'B')
      service.addEdge('B', 'C')

      const descendants = service.getDescendants('A')
      expect(descendants).toContain('B')
      expect(descendants).toContain('C')
      expect(descendants).toHaveLength(2)
    })

    it('should return empty array for leaf node', () => {
      service.addNode('A')
      const descendants = service.getDescendants('A')
      expect(descendants).toHaveLength(0)
    })
  })

  describe('estimateIntervention', () => {
    it('should estimate intervention effect', async () => {
      service.addNode('A')
      service.addNode('B')
      service.addNode('C')
      service.addEdge('A', 'B', 0.8)
      service.addEdge('B', 'C', 0.6)

      const result = await service.estimateIntervention({
        nodeId: 'B',
        value: 1.0,
      })

      expect(result).toMatchObject({
        nodeId: 'B',
        estimatedEffect: expect.any(Number),
        confidence: expect.any(Number),
        ancestors: expect.arrayContaining(['A']),
        descendants: expect.arrayContaining(['C']),
      })
    })

    it('should throw error for non-existent node', async () => {
      await expect(
        service.estimateIntervention({ nodeId: 'X', value: 1.0 })
      ).rejects.toThrow('Node X does not exist')
    })

    it('should handle isolated node', async () => {
      service.addNode('A')
      const result = await service.estimateIntervention({
        nodeId: 'A',
        value: 1.0,
      })

      expect(result.ancestors).toHaveLength(0)
      expect(result.descendants).toHaveLength(0)
      expect(result.estimatedEffect).toBe(0)
    })
  })

  describe('removeNode', () => {
    it('should remove node and its edges', () => {
      service.addNode('A')
      service.addNode('B')
      service.addNode('C')
      service.addEdge('A', 'B')
      service.addEdge('B', 'C')

      service.removeNode('B')

      const graph = service.getGraph()
      expect(graph.nodes).not.toContain('B')
      expect(graph.edges).toHaveLength(0)
    })
  })

  describe('removeEdge', () => {
    it('should remove edge between nodes', () => {
      service.addNode('A')
      service.addNode('B')
      service.addEdge('A', 'B')

      service.removeEdge('A', 'B')

      const graph = service.getGraph()
      expect(graph.edges).toHaveLength(0)
      expect(graph.nodes).toContain('A')
      expect(graph.nodes).toContain('B')
    })
  })
})