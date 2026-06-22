## 2025-02-21 - Optimize ClinicalCompetencyModule state calculations

Learning: Grouping cohort and chart data using maps/filters on large datasets inside a component body leads to excessive un-optimized recalculations across renders

Action: Wrapped state mappings and cohort groupings inside a useMemo hook with proper destructuring, optimizing recalculations to run only when data prop changes
