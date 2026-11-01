import { expect, it, vi } from 'vitest'

import { localDateTimeValue } from '../src/lib/datetime'

it('formats a date as local datetime input text, including day rollover', () => {
  const date = new Date('2024-01-02T03:04:05.000Z')
  vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(300)

  expect(localDateTimeValue(date)).toBe('2024-01-01T22:04')
})
