import React from 'react'
import MentalHealthChatDemo from './MentalHealthChatDemo'

interface MindMirrorDemoProps {
  className?: string
}

export const MindMirrorDemo: React.FC<MindMirrorDemoProps> = ({
  className = ""
}) => {
  return (
    <div className={`w-full ${className}`}>
      <MentalHealthChatDemo
        showAnalysisPanel={true}
        showSettingsPanel={false}
        initialTab="analysis"
      />
    </div>
  )
}

export default MindMirrorDemo
