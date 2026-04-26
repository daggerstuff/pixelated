import { FC } from 'react'

import MentalHealthChatDemoReact from './MentalHealthChatDemoReact'

interface MindMirrorDemoProps {
  className?: string
}

export const MindMirrorDemo: FC<MindMirrorDemoProps> = ({ className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      <MentalHealthChatDemoReact
        showAnalysisPanel={true}
        showSettingsPanel={false}
        initialTab='analysis'
      />
    </div>
  )
}

export default MindMirrorDemo
