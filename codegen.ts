import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './apps/web/src/lib/graphql/schema.graphql',
  documents: ['./apps/web/src/lib/graphql/operations/**/*.graphql'],
  generates: {
    'apps/web/src/lib/graphql/generated/types.ts': {
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
