import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './src/lib/graphql/schema.graphql',
  documents: ['./src/lib/graphql/operations/**/*.graphql'],
  generates: {
    'src/lib/graphql/generated/types.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        scalars: {
          JSON: 'Record<string, unknown>',
          DateTime: 'string',
        },
        nonOptionalTypename: true,
        skipTypename: false,
        enumsAsTypes: true,
        avoidOptionals: false,
        useTypeImports: true,
      },
    },
  },
}

export default config
