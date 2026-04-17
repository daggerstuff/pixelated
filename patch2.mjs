import fs from 'fs';
const path = 'src/components/BlogSearch.tsx';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  /typeof value\.id === 'string' &&\n    typeof value\.title === 'string' &&\n    typeof value\.description === 'string' &&\n    typeof value\.slug === 'string'/g,
  "typeof value['id'] === 'string' &&\n    typeof value['title'] === 'string' &&\n    typeof value['description'] === 'string' &&\n    typeof value['slug'] === 'string'"
);
code = code.replace(
  /Array\.isArray\(value\.results\) && value\.results\.every\(isSearchResult\)/g,
  "Array.isArray(value['results']) && value['results'].every(isSearchResult)"
);
fs.writeFileSync(path, code);
