const fs = require('fs')

let content = fs.readFileSync('src/components/MentalHealthChatDemo.tsx', 'utf8')
content = content.replace('export const MentalHealthChatDemo = MentalHealthChatDemoReact', 'export { MentalHealthChatDemoReact as MentalHealthChatDemo }')
fs.writeFileSync('src/components/MentalHealthChatDemo.tsx', content)
