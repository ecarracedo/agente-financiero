import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SelectField, TextAreaField, TextField } from './FormControls'

/**
 * Accessibility contract for the shared form controls.
 *
 * The financial spec requires that a validation error is associated with the
 * field that caused it and is exposed to assistive technology: the field is
 * marked invalid and the message is linked to it. A description is a permanent
 * hint rather than an error, so it is linked without marking the field invalid.
 *
 * The label association is checked here too, because these controls are used
 * inside `<label>`-wrapping call sites and a restructure can silently break it.
 */
describe('FormControls', () => {
  describe('TextField', () => {
    it('links its label to the input', () => {
      render(<TextField id="ticker" label="Ticker" value="" onChange={() => {}} />)

      expect(screen.getByLabelText('Ticker')).toBe(screen.getByRole('textbox'))
    })

    it('marks the field invalid and links the message when there is an error', () => {
      render(
        <TextField
          id="quantity"
          label="Quantity"
          value="abc"
          onChange={() => {}}
          error="Quantity must be a number"
        />,
      )

      const input = screen.getByLabelText('Quantity')
      expect(input).toHaveAttribute('aria-invalid', 'true')

      // The error must be reachable from the field, not merely visible.
      const describedBy = input.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        'Quantity must be a number',
      )
    })

    it('does not mark the field invalid when a description is present but there is no error', () => {
      render(
        <TextField
          id="currency"
          label="Currency"
          value=""
          onChange={() => {}}
          description="Three-letter code, for example USD."
        />,
      )

      const input = screen.getByLabelText('Currency')
      expect(input).not.toHaveAttribute('aria-invalid')

      const describedBy = input.getAttribute('aria-describedby')
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        'Three-letter code, for example USD.',
      )
    })

    it('links both the description and the error when both are present', () => {
      render(
        <TextField
          id="ratio"
          label="Ratio"
          value=""
          onChange={() => {}}
          description="Format: new:old."
          error="Ratio is required"
        />,
      )

      const input = screen.getByLabelText('Ratio')
      const ids = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean)

      expect(ids).toHaveLength(2)
      const text = ids.map((id) => document.getElementById(id)?.textContent).join(' ')
      expect(text).toContain('Format: new:old.')
      expect(text).toContain('Ratio is required')
    })

    it('has no aria-describedby when neither a description nor an error is given', () => {
      render(<TextField id="broker" label="Broker" value="" onChange={() => {}} />)

      expect(screen.getByLabelText('Broker')).not.toHaveAttribute('aria-describedby')
    })
  })

  describe('TextAreaField', () => {
    it('marks the field invalid and links the message when there is an error', () => {
      render(
        <TextAreaField
          id="notes"
          label="Notes"
          value=""
          onChange={() => {}}
          error="Notes are required"
        />,
      )

      const area = screen.getByLabelText('Notes')
      expect(area).toHaveAttribute('aria-invalid', 'true')
      const describedBy = area.getAttribute('aria-describedby')
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        'Notes are required',
      )
    })
  })

  describe('SelectField', () => {
    it('marks the field invalid and links the message when there is an error', () => {
      render(
        <SelectField
          id="operation"
          label="Operation"
          value=""
          options={[{ value: 'BUY', label: 'Buy' }]}
          onChange={() => {}}
          error="Operation is required"
        />,
      )

      const select = screen.getByLabelText('Operation')
      expect(select).toHaveAttribute('aria-invalid', 'true')
      const describedBy = select.getAttribute('aria-describedby')
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        'Operation is required',
      )
    })
  })
})
