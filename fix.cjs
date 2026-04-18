const fs = require('fs')

let content = fs.readFileSync('src/components/MentalHealthChatDemo.tsx', 'utf8')
content = "import { MentalHealthChatDemoReact } from './MentalHealthChatDemoReact'\n" + content
fs.writeFileSync('src/components/MentalHealthChatDemo.tsx', content)
