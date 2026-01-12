// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilters, { type SearchFiltersState } from './SearchFilters';
import React from 'react';

// Setup Mock for onChange
const mockOnChange = vi.fn();

const defaultFilters: SearchFiltersState = {
    topics: [],
    minRelevance: 0,
    publishers: [],
    sortBy: 'relevance'
};

const filledFilters: SearchFiltersState = {
    topics: ['CBT'],
    minRelevance: 0.5,
    publishers: [],
    sortBy: 'year_desc'
};

describe('SearchFilters', () => {
    it('renders all filter sections', () => {
        render(<SearchFilters filters={defaultFilters} onChange={mockOnChange} />);

        expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
        expect(screen.getByLabelText('Year From')).toBeInTheDocument();
        expect(screen.getByLabelText('Year To')).toBeInTheDocument();
        expect(screen.getByText('Therapeutic Topics')).toBeInTheDocument();
        expect(screen.getByText('Min Relevance Score')).toBeInTheDocument();
    });

    it('toggles topics correctly', () => {
        render(<SearchFilters filters={defaultFilters} onChange={mockOnChange} />);

        const topicButton = screen.getByText('CBT');
        fireEvent.click(topicButton);

        // Note: The component uses local state, so we expect the button style to change 
        // AND handleApply calls onChange. But wait, toggleTopic updates local state.
        // We verify the button indicates it is pressed or selected visually (class check or aria-pressed).
        // After clicking, it should be pressed (true)
        expect(topicButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onChange with new filters when Apply is clicked', () => {
        render(<SearchFilters filters={defaultFilters} onChange={mockOnChange} />);

        const topicButton = screen.getByText('Trauma');
        fireEvent.click(topicButton);

        const applyButton = screen.getByText('Apply Filters');
        fireEvent.click(applyButton);

        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
            topics: ['Trauma']
        }));
    });

    it('resets filters when Reset is clicked', () => {
        render(<SearchFilters filters={filledFilters} onChange={mockOnChange} />);

        const resetButton = screen.getByText('Reset');
        fireEvent.click(resetButton);

        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
            topics: [],
            minRelevance: 0,
            sortBy: 'relevance'
        }));
    });
});
