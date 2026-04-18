const fs = require('fs')

const content = fs.readFileSync('src/components/MentalHealthChatDemo.tsx', 'utf8')
if (!content.includes('export default MentalHealthChatDemoReact')) {
  fs.writeFileSync('src/components/MentalHealthChatDemo.tsx', content + '\nexport default MentalHealthChatDemoReact\n')
}
