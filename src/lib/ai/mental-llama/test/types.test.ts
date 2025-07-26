import type { ChatCompletionOptions } from '../providers/types'

describe('ChatCompletionOptions Interface', () => {
  it('should accept providerSpecificParams', () => {
    const options: ChatCompletionOptions = {
      model: 'gpt-4',
      temperature: 0.7,
      providerSpecificParams: {
        functions: [
          {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        ],
        function_call: 'auto',
        response_format: { type: 'json_object' },
      },
    }

    expect(options.providerSpecificParams).toBeDefined()
    expect(options.providerSpecificParams?.['functions']).toBeDefined()
    expect(options.providerSpecificParams?.['response_format']).toEqual({
      type: 'json_object',
    })
  })

  it('should allow dynamic properties via index signature', () => {
    const options: ChatCompletionOptions = {
      model: 'gpt-3.5-turbo',
      custom_parameter: 'some_value',
      another_custom_param: 42,
    }

    expect(options['custom_parameter']).toBe('some_value')
    expect(options['another_custom_param']).toBe(42)
  })

  it('should work without providerSpecificParams', () => {
    const options: ChatCompletionOptions = {
      model: 'gpt-4',
      temperature: 0.5,
      max_tokens: 1000,
    }

    expect(options.providerSpecificParams).toBeUndefined()
    expect(options.model).toBe('gpt-4')
  })
})
