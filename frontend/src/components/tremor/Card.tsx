// Tremor Card [v1.0.0]
// Vendored into this repository from Tremor Raw. See openspec change
// frontend-tremor-redesign, decision D1.

import React from 'react'
import { Slot } from '@radix-ui/react-slot'

import { cx } from './utils/cx'

interface CardProps extends React.ComponentPropsWithoutRef<'div'> {
  asChild?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild, ...props }, forwardedRef) => {
    const Component = asChild ? Slot : 'div'
    return (
      <Component
        ref={forwardedRef}
        className={cx(
          // base
          'relative w-full rounded-lg border p-6 text-left shadow-lg',
          // background color
          'bg-[#181c24] text-[#dfe2ee]',
          // border color
          'border-[#3d494c]/40',
          className,
        )}
        tremor-id="tremor-raw"
        {...props}
      />
    )
  },
)

Card.displayName = 'Card'

export { Card, type CardProps }
