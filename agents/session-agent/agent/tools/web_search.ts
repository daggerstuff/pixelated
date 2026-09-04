import { webSearch } from 'eve/tools/web_search'

// The eve framework auto-adds a web_search tool to the agent's toolset.
// The default provider ('exa') requires gateway.tools.exaSearch which is
// not available in the installed AI SDK beta. 'parallel' is available and
// routes through the AI Gateway's parallel search backend.
export default webSearch({ provider: 'parallel' })
