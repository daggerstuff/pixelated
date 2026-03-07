import { render, screen } from '@testing-library/react'
import ProgressBar from '../components/ui/progress-bar'

describe('ProgressBar', () => {
  it('renders with the correct label and value', () => {
    render(<ProgressBar label="Test Progress" value={50} color="blue" />)
    expect(screen.getByText('Test Progress')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})
