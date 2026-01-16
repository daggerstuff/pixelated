import React from 'react';

// Common source types based on SourceType enum in backend
export type SourceType =
    | 'all'
    | 'publisher' // Generic publisher category
    | 'api'       // Generic API category
    | 'dataset'   // Dataset category
    | 'arxiv'
    | 'semantic_scholar'
    | 'crossref'
    | 'pubmed'
    | 'openalex'
    | 'apa_publisher'
    | 'springer'
    | 'oxford';

interface SourceSelectorProps {
    selectedSources: string[];
    onChange: (sources: string[]) => void;
}

export default function SourceSelector({ selectedSources, onChange }: SourceSelectorProps) {

    const toggleSource = (source: string) => {
        if (source === 'all') {
            onChange(['all']);
            return;
        }

        let newSources = [...selectedSources];

        // If 'all' was selected, clear it
        if (newSources.includes('all')) {
            newSources = [];
        }

        if (newSources.includes(source)) {
            newSources = newSources.filter(s => s !== source);
        } else {
            newSources.push(source);
        }

        // If nothing selected, default back to all? Or empty? Let's say empty effectively implies all or user must select one.
        // Ideally, if empty, we might revert to 'all' or show validation error. 
        // For this UX, let's treat empty as 'all' or just empty.
        if (newSources.length === 0) {
            newSources = ['all'];
        }

        onChange(newSources);
    };

    const isSelected = (source: string) => selectedSources.includes(source) || (selectedSources.includes('all') && source === 'all');

    return (
        <div className="flex flex-wrap gap-2 justify-center">
            <button
                className={`source-chip ${isSelected('all') ? 'active' : ''}`}
                onClick={() => toggleSource('all')}
            >
                All Sources
            </button>

            {/* Categories */}
            <button
                className={`source-chip ${isSelected('publisher') ? 'active' : ''}`}
                onClick={() => toggleSource('publisher')}
            >
                Publishers
            </button>
            <button
                className={`source-chip ${isSelected('api') ? 'active' : ''}`}
                onClick={() => toggleSource('api')}
            >
                APIs
            </button>
            <button
                className={`source-chip ${isSelected('dataset') ? 'active' : ''}`}
                onClick={() => toggleSource('dataset')}
                title="Therapy Datasets (HuggingFace, etc.)"
            >
                Datasets
            </button>

            {/* Divider if we want to show specific popular sources */}
            <div className="w-px bg-slate-700 mx-2 h-6 self-center"></div>

            <button
                className={`source-chip ${isSelected('arxiv') ? 'active' : ''}`}
                onClick={() => toggleSource('arxiv')}
            >
                ArXiv
            </button>
            <button
                className={`source-chip ${isSelected('pubmed') ? 'active' : ''}`}
                onClick={() => toggleSource('pubmed')}
            >
                PubMed
            </button>
            <button
                className={`source-chip ${isSelected('apa_publisher') ? 'active' : ''}`}
                onClick={() => toggleSource('apa_publisher')}
            >
                APA
            </button>
        </div>
    );
}
