const fs = require('fs')

const content = fs.readFileSync('src/components/MindMirrorDemo.tsx', 'utf8')
fs.writeFileSync('src/components/MindMirrorDemo.tsx', content.replace('import MentalHealthChatDemo from \'./MentalHealthChatDemo\'', 'import MentalHealthChatDemoReact from \'./MentalHealthChatDemo\'').replace(/<MentalHealthChatDemo/g, '<MentalHealthChatDemoReact').replace(/<\/MentalHealthChatDemo/g, '</MentalHealthChatDemoReact'))
