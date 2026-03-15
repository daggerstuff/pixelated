import re

with open('src/components/ui/SearchBox.tsx', 'r') as f:
    content = f.read()

# 1. Add debouncedQuery state
state_match = re.search(r'const \[query, setQuery\] = useState\(\'\'\)\n', content)
if state_match:
    content = content[:state_match.end()] + "  const [debouncedQuery, setDebouncedQuery] = useState('')\n" + content[state_match.end():]

# 2. Add debounce effect
effect_idx = content.find('  // Track if the search is actually showing results')
if effect_idx != -1:
    debounce_effect = """  // ⚡ Bolt: Debounce query to prevent synchronous main thread blocking during rapid typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

"""
    content = content[:effect_idx] + debounce_effect + content[effect_idx:]

# 3. Update the search effect to depend on debouncedQuery
search_effect_start = content.find('  // Handle searching when query changes')
if search_effect_start != -1:
    search_effect_end = content.find('  // Close results when clicking outside', search_effect_start)
    if search_effect_end != -1:
        search_effect = content[search_effect_start:search_effect_end]

        # Replace query with debouncedQuery in the dependency array and body
        new_search_effect = search_effect.replace('[query, isSearchReady', '[debouncedQuery, isSearchReady')
        new_search_effect = new_search_effect.replace('query.length < minQueryLength', 'debouncedQuery.length < minQueryLength')
        new_search_effect = new_search_effect.replace('window.searchClient.search(query)', 'window.searchClient.search(debouncedQuery)')
        new_search_effect = new_search_effect.replace('onSearch(query, limitedResults)', 'onSearch(debouncedQuery, limitedResults)')

        content = content[:search_effect_start] + new_search_effect + content[search_effect_end:]

with open('src/components/ui/SearchBox.tsx', 'w') as f:
    f.write(content)
print("Updated SearchBox.tsx")
