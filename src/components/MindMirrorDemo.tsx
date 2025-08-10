import React from 'react'
import EnhancedMentalHealthChat from './ui/EnhancedMentalHealthChat'

interface MindMirrorDemoProps {
  className?: string
}

export const MindMirrorDemo: React.FC<MindMirrorDemoProps> = ({ 
  className = "" 
}) => {
  return (
    <div className={`w-full ${className}`}>
      <EnhancedMentalHealthChat 
        showBrainViz={true}
        showAnalysisPanel={true}
      />
    </div>
  )
}

export default MindMirrorDemo
