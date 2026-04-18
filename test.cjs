const fs = require('fs')

const content = fs.readFileSync('src/components/MentalHealthChatDemo.tsx', 'utf8')
fs.writeFileSync('src/components/MentalHealthChatDemo.tsx', content.replace('export const MentalHealthChatDemo = MentalHealthChatDemoReact', 'export default MentalHealthChatDemoReact').replace('export default MentalHealthChatDemo\n', ''))
