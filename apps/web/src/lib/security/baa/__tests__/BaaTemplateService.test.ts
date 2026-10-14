import { describe, expect, it } from 'vitest'

import { BaaTemplateService } from '../BaaTemplateService'
import { BusinessAssociateType } from '../types'

describe('BaaTemplateService createDefaultTemplate', () => {
  it('uses BusinessAssociateType enum at runtime', () => {
    expect(BusinessAssociateType.EHR_VENDOR).toBeDefined()
    const service = new BaaTemplateService()
    const template = service.createDefaultTemplate('test-user')
    expect(template.associateTypes).toContain(BusinessAssociateType.EHR_VENDOR)
  })
})
