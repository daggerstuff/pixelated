export interface Scenario {
  id?: string
  name: string
  description: string
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: 'anxiety' | 'depression' | 'trauma' | 'addiction' | 'other'
}
