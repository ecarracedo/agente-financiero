import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/http'
import { BibliographyWorkspace } from './BibliographyWorkspace'
import { bibliographyApi } from './bibliographyApi'

vi.mock('./bibliographyApi', () => ({
  bibliographyApi: {
    list: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
  },
}))

const resource = {
  id: 3,
  title: 'The Intelligent Investor',
  author: 'Benjamin Graham',
  year: 1949,
  category: 'Investing',
  link: 'https://example.com/book',
  description: 'Value investing classic.',
}

describe('BibliographyWorkspace', () => {
  afterEach(() => {
    // clearAllMocks (not resetAllMocks) keeps the settled-request implementations
    // intact across the mount + refresh calls these tests rely on.
    vi.clearAllMocks()
  })

  it('lists bibliography resources with their metadata', async () => {
    vi.mocked(bibliographyApi.list).mockResolvedValue([resource])

    render(<BibliographyWorkspace />)

    expect(await screen.findByText('The Intelligent Investor')).toBeInTheDocument()
    expect(screen.getByText('Benjamin Graham')).toBeInTheDocument()
    expect(screen.getByText('1949')).toBeInTheDocument()
    expect(screen.getByText('Investing')).toBeInTheDocument()
  })

  it('adds a resource with only the required fields and omits the optionals', async () => {
    vi.mocked(bibliographyApi.list).mockResolvedValue([])
    vi.mocked(bibliographyApi.add).mockResolvedValue({
      ...resource,
      id: 4,
      year: null,
      link: null,
      description: null,
    })

    render(<BibliographyWorkspace />)

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Security Analysis' },
    })
    fireEvent.change(screen.getByLabelText('Author'), {
      target: { value: 'Benjamin Graham' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add resource/i }))

    await waitFor(() =>
      expect(bibliographyApi.add).toHaveBeenCalledWith({
        title: 'Security Analysis',
        author: 'Benjamin Graham',
        category: 'General',
      }),
    )
    const [body] = vi.mocked(bibliographyApi.add).mock.calls[0]
    expect(body).not.toHaveProperty('year')
    expect(body).not.toHaveProperty('link')
    expect(body).not.toHaveProperty('description')
  })

  it('adds a resource with every optional field when provided', async () => {
    vi.mocked(bibliographyApi.list).mockResolvedValue([])
    vi.mocked(bibliographyApi.add).mockResolvedValue(resource)

    render(<BibliographyWorkspace />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: resource.title } })
    fireEvent.change(screen.getByLabelText('Author'), { target: { value: resource.author } })
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '1949' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Investing' } })
    fireEvent.change(screen.getByLabelText('Link'), { target: { value: resource.link } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: resource.description },
    })
    fireEvent.click(screen.getByRole('button', { name: /add resource/i }))

    await waitFor(() =>
      expect(bibliographyApi.add).toHaveBeenCalledWith({
        title: resource.title,
        author: resource.author,
        year: 1949,
        category: 'Investing',
        link: resource.link,
        description: resource.description,
      }),
    )
  })

  it('deletes a resource and refreshes the list', async () => {
    vi.mocked(bibliographyApi.list).mockResolvedValueOnce([resource]).mockResolvedValueOnce([])
    vi.mocked(bibliographyApi.remove).mockResolvedValue({ deleted: true })

    render(<BibliographyWorkspace />)

    await screen.findByText('The Intelligent Investor')
    fireEvent.click(
      screen.getByRole('button', { name: /delete the intelligent investor/i }),
    )

    await waitFor(() => expect(bibliographyApi.remove).toHaveBeenCalledWith(3))
    await waitFor(() =>
      expect(screen.queryByText('The Intelligent Investor')).not.toBeInTheDocument(),
    )
  })

  it('surfaces a missing resource (404) on delete as an error', async () => {
    vi.mocked(bibliographyApi.list).mockResolvedValue([resource])
    vi.mocked(bibliographyApi.remove).mockRejectedValue(new ApiError(404, 'not found'))

    render(<BibliographyWorkspace />)

    await screen.findByText('The Intelligent Investor')
    fireEvent.click(
      screen.getByRole('button', { name: /delete the intelligent investor/i }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/404/)
  })

  it('omits a non-numeric year instead of sending null', async () => {
    vi.mocked(bibliographyApi.list).mockResolvedValue([])
    vi.mocked(bibliographyApi.add).mockResolvedValue(resource)

    render(<BibliographyWorkspace />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Security Analysis' } })
    fireEvent.change(screen.getByLabelText('Author'), { target: { value: 'Benjamin Graham' } })
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: /add resource/i }))

    await waitFor(() => expect(bibliographyApi.add).toHaveBeenCalled())
    const [body] = vi.mocked(bibliographyApi.add).mock.calls[0]
    expect(body).not.toHaveProperty('year')
  })

  it('shows a required-fields error and sends nothing when title or author is blank', async () => {
    vi.mocked(bibliographyApi.list).mockResolvedValue([])

    render(<BibliographyWorkspace />)

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /add resource/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Title and author are required.')
    expect(bibliographyApi.add).not.toHaveBeenCalled()
  })
})
