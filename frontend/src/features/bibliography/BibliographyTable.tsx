/**
 * Bibliography table with a per-row delete action.
 */

import type { Column } from '../../components/DataTable'
import { DataTable } from '../../components/DataTable'
import type { BibliographyItem } from './bibliographyApi'

export interface BibliographyTableProps {
  items: BibliographyItem[]
  onDelete: (itemId: number) => void
}

/** Render one row per resource, each with its own delete action. */
export function BibliographyTable({ items, onDelete }: BibliographyTableProps) {
  const columns: Column<BibliographyItem>[] = [
    { key: 'title', header: 'Title', render: (item) => item.title },
    { key: 'author', header: 'Author', render: (item) => item.author },
    {
      key: 'year',
      header: 'Year',
      align: 'right',
      render: (item) => (item.year === null ? <span>—</span> : <span>{item.year}</span>),
    },
    { key: 'category', header: 'Category', render: (item) => item.category },
    {
      key: 'link',
      header: 'Link',
      render: (item) => (item.link === null ? <span>—</span> : <span>{item.link}</span>),
    },
    {
      key: 'description',
      header: 'Description',
      render: (item) =>
        item.description === null ? <span>—</span> : <span>{item.description}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          aria-label={`Delete ${item.title}`}
          className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-1.5 text-xs font-semibold text-[#ffb4ab] hover:bg-red-900/30 transition-all"
        >
          Delete
        </button>
      ),
    },
  ]

  return (
    <DataTable
      caption="Bibliography"
      columns={columns}
      rows={items}
      getRowKey={(item) => item.id}
      emptyMessage="No bibliography resources."
    />
  )
}
