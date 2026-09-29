import { useState } from 'react'

import SearchBox from './SearchBox'

interface SearchNavItemProps {
  className?: string
  buttonClassName?: string
  searchBoxClassName?: string
  placeDropdownLeft?: boolean
}

/**
 * A compact search component for navigation bars that toggles a search dropdown
 */
export default function SearchNavItem({
  className = '',
  buttonClassName = '',
  searchBoxClassName = '',
  placeDropdownLeft = false,
}: SearchNavItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSearch = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleSearch}
        className={`rounded-none p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${buttonClassName}`}
        aria-expanded={isOpen}
        aria-label="Search"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute z-10 mt-2 ${placeDropdownLeft ? 'right-0' : 'left-0'} w-64 sm:w-80`}
        >
          <div className="rounded-none border border-border bg-card p-2">
            <SearchBox
              placeholder="Search..."
              maxResults={5}
              minQueryLength={2}
              onResultClick={() => setIsOpen(false)}
              className={searchBoxClassName}
            />
          </div>
        </div>
      )}
    </div>
  )
}
