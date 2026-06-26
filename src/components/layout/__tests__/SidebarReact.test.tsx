import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { Sidebar } from '../SidebarReact'

describe('SidebarReact', () => {
  it('should contain navigation link for clinical validity dashboard', () => {
    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/dashboard',
      },
      writable: true,
    })

    render(<Sidebar />)

    // Check for clinical validity link
    const clinicalValidityLink = screen.getByText('Clinical Validity')
    expect(clinicalValidityLink).toBeDefined()
    expect(clinicalValidityLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/clinical-validity',
    )
  })

  it('should contain navigation link for training annotation', () => {
    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/dashboard',
      },
      writable: true,
    })

    render(<Sidebar />)

    // Check for annotation link
    const annotationLink = screen.getByText('Annotation Queue')
    expect(annotationLink).toBeDefined()
    expect(annotationLink.closest('a')).toHaveAttribute(
      'href',
      '/training/annotation',
    )
  })

  it('should contain navigation link for training portal', () => {
    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/dashboard',
      },
      writable: true,
    })

    render(<Sidebar />)

    // Check for training portal link
    const trainingPortalLink = screen.getByText('Training Portal')
    expect(trainingPortalLink).toBeDefined()
    expect(trainingPortalLink.closest('a')).toHaveAttribute('href', '/training')
  })
})
