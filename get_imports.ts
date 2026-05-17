import { readFileSync } from 'fs';
const content = readFileSync('src/components/dashboard/AnalyticsCharts.tsx', 'utf-8');
const lines = content.split('\n');
console.log(lines.slice(0, 15).join('\n'));
