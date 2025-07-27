 // Date formatting and content reading time estimation utilities

export function formatDate(dateInput, options = {}) {
  if (!dateInput) {
    return '-';
  }
  
  const date = new Date(dateInput);
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

export function getReadingTime(content) {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min read`;
}

export function getUrl(...paths) {
  return '/' + paths.filter(Boolean).join('/').replace(/\/+/g, '/');
}