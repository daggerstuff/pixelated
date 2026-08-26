import { render, screen } from '@testing-library/react'

import ProgressBar from '../../../components/ui/progress'

describe('ProgressBar', () => {
  it('renders with the correct value', () => {
    render(<ProgressBar value={50} showValue />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
  })
})
