/**
 * Derived opportunities: the technical signals reported by the analysis API.
 */

/** Human-readable labels for the known backend signal codes. */
const SIGNAL_LABELS: Record<string, string> = {
  NEAR_52_WEEK_LOW: 'Near 52-week low',
  NEAR_52_WEEK_HIGH: 'Near 52-week high',
  BELOW_200_DAY_AVERAGE: 'Below 200-day average',
  ABOVE_200_DAY_AVERAGE: 'Above 200-day average',
}

export interface OpportunityListProps {
  /** Raw signal codes from `MarketAnalysisResponse.signals`. */
  signals: string[]
}

/**
 * Render analysis signals as a labeled list.
 *
 * This is a light, frontend-only interpretation of the backend signals: new
 * codes stay visible with their raw value instead of being dropped.
 */
export function OpportunityList({ signals }: OpportunityListProps) {
  if (signals.length === 0) {
    return <p>No opportunities detected.</p>
  }

  return (
    <section aria-labelledby="opportunities-heading">
      <h3 id="opportunities-heading">Opportunities</h3>
      <ul aria-label="Opportunities">
        {signals.map((signal) => (
          <li key={signal}>{SIGNAL_LABELS[signal] ?? signal}</li>
        ))}
      </ul>
    </section>
  )
}
