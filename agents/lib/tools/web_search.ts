import { webSearch } from 'eve/tools/web_search'

// Eve auto-adds a web_search tool to every agent's toolset.
// The default provider is 'exa', but `ai` v7.0.0-beta.178
// does not export `exaSearch`. Using 'parallel' instead.
export default webSearch({ provider: 'parallel' })
