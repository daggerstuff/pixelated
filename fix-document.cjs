const fs = require('fs');
let content = fs.readFileSync('src/api/services/document-service.ts', 'utf8');

// Make sure to cast to any so string satisfies ObjectId in the TS types for the push method
content = content.replace(
`    !(document.permissions?.view || []).includes(sharedWithUserId)
  ) {
    (document.permissions?.view || []).push(sharedWithUserId)`,
`    !(document.permissions?.view || []).includes(sharedWithUserId as any)
  ) {
    document.permissions?.view?.push(sharedWithUserId as any)`
);

content = content.replace(
`    !(document.permissions?.edit || []).includes(sharedWithUserId)
  ) {
    (document.permissions?.edit || []).push(sharedWithUserId)`,
`    !(document.permissions?.edit || []).includes(sharedWithUserId as any)
  ) {
    document.permissions?.edit?.push(sharedWithUserId as any)`
);

content = content.replace(
`    !(document.permissions?.comment || []).includes(sharedWithUserId)
  ) {
    (document.permissions?.comment || []).push(sharedWithUserId)`,
`    !(document.permissions?.comment || []).includes(sharedWithUserId as any)
  ) {
    document.permissions?.comment?.push(sharedWithUserId as any)`
);

fs.writeFileSync('src/api/services/document-service.ts', content);
