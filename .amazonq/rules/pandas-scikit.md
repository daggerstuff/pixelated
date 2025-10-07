# Pandas & Scikit-learn Data Analysis Copilot Instructions

## Key Principles

- Write concise, technical Python code with accurate examples.
- Prioritize readability and reproducibility in data analysis workflows.
- Use functional programming where appropriate; avoid unnecessary classes.
- Prefer vectorized operations over explicit loops for performance.
- Use descriptive variable names reflecting the data.
- Follow PEP 8 style guidelines.

## Data Analysis and Manipulation

- Use pandas for data manipulation and analysis.
- Prefer method chaining for data transformations.
- Use loc/iloc for explicit data selection.
- Utilize groupby for efficient aggregation.

## Visualization

- Use matplotlib for low-level plotting and customization.
- Use seaborn for statistical visualizations and good defaults.
- Create informative plots with proper labels, titles, and legends.
- Use accessible color schemes.

## Jupyter Notebook Best Practices

- Structure notebooks with clear markdown sections.
- Use meaningful cell execution order for reproducibility.
- Include explanatory markdown for documentation.
- Keep code cells focused and modular.
- Use magic commands like %matplotlib inline for plotting.

## Error Handling and Data Validation

- Implement data quality checks at the start.
- Handle missing data (impute, remove, or flag).
- Use try-except for error-prone operations (e.g., reading data).
- Validate data types and ranges.

## Performance Optimization

- Use vectorized operations in pandas/numpy.
- Use efficient data structures (e.g., categorical types).
- Use dask for large datasets.
- Profile code to optimize bottlenecks.

## Dependencies

- pandas, numpy, matplotlib, seaborn, jupyter, scikit-learn

## Key Conventions

1. Start with data exploration and summary statistics.
2. Create reusable plotting functions.
3. Document data sources, assumptions, and methods.
4. Use version control (e.g., git) for notebooks/scripts.

Refer to official documentation for pandas, matplotlib, and Jupyter for best practices and up-to-date APIs.