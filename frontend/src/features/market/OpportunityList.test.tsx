import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OpportunityList } from './OpportunityList'

describe('OpportunityList', () => {
  it('renders known analysis signals as labeled items', () => {
    render(<OpportunityList signals={['NEAR_52_WEEK_LOW', 'BELOW_200_DAY_AVERAGE']} />)

    expect(screen.getByRole('heading', { name: 'Opportunities' })).toBeInTheDocument()
    expect(screen.getByText('Near 52-week low')).toBeInTheDocument()
    expect(screen.getByText('Below 200-day average')).toBeInTheDocument()
  })

  it('keeps unknown signal codes visible instead of hiding them', () => {
    render(<OpportunityList signals={['SOME_NEW_SIGNAL']} />)

    expect(screen.getByText('SOME_NEW_SIGNAL')).toBeInTheDocument()
  })

  it('reports no opportunities explicitly when there are no signals', () => {
    render(<OpportunityList signals={[]} />)

    expect(screen.getByText(/no opportunities/i)).toBeInTheDocument()
  })
})
