import { describe, expect, it } from 'vitest'

import openapi from '../../openapi.json'
import { handlers } from './handlers'
import * as fixtures from './fixtures'

/**
 * Contract test for the MSW harness.
 *
 * The handlers and fixtures are hand-written; the OpenAPI document is generated
 * from the backend. Nothing kept the two in step, so the harness drifted onto
 * routes the contract does not define and fixtures missing the fields the views
 * read. These tests read the contract and fail when the harness disagrees with
 * it, which is what stops the drift from coming back.
 */

type Schema = {
  type?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  anyOf?: Schema[]
  additionalProperties?: Schema | boolean
  enum?: string[]
  $ref?: string
}

const document = openapi as unknown as {
  components: { schemas: Record<string, Schema> }
  paths: Record<string, Record<string, unknown>>
}
const schemas = document.components.schemas
const paths = document.paths

/** Resolve a `$ref` (local only) into its schema. */
function resolve(schema: Schema): Schema {
  if (schema.$ref !== undefined) {
    const name = schema.$ref.split('/').pop() as string
    return schemas[name]
  }
  return schema
}

/** The JSON schema a successful response of `route` returns. */
function responseSchemaFor(route: string): Schema | null {
  const operations = paths[route]
  if (operations === undefined) return null
  for (const method of ['get', 'post', 'put', 'delete']) {
    const operation = operations[method] as
      | { responses?: Record<string, { content?: Record<string, { schema?: Schema }> }> }
      | undefined
    if (operation === undefined) continue
    for (const status of ['200', '201']) {
      const schema = operation.responses?.[status]?.content?.['application/json']?.schema
      if (schema !== undefined) return resolve(schema)
    }
  }
  return null
}

/** Strip the MSW wildcard origin so a path can be compared to the contract. */
function registeredPaths(): string[] {
  return handlers
    .map((handler) => (handler.info.path as string).replace(/^\*/, ''))
    .filter((path) => path !== '')
}

/** Normalise `:param` to the contract's `{param}`. */
function toContractShape(path: string): string {
  return path.replace(/:([A-Za-z_]+)/g, '{$1}')
}

describe('MSW harness matches the OpenAPI contract', () => {
  describe('handler routes', () => {
    it('registers every path on a route the contract defines', () => {
      const unknown = registeredPaths().filter(
        (path) => paths[toContractShape(path)] === undefined,
      )

      expect(unknown).toEqual([])
    })

    it('covers every route the application consumes', () => {
      // The routes the frontend actually calls, from src/api and src/features.
      const consumed = [
        '/health',
        '/ready',
        '/api/v1/portfolio',
        '/api/v1/valuations',
        '/api/v1/transactions',
        '/api/v1/wishlist',
        '/api/v1/bibliography',
        '/api/v1/analysis/{ticker}',
        '/api/v1/splits',
        '/api/v1/portfolio/{ticker}/alert',
        '/api/v1/portfolio/{ticker}/alert/check',
        '/api/v1/wishlist/{ticker}/alert',
        '/api/v1/wishlist/{ticker}/alert/check',
      ]
      const registered = registeredPaths().map(toContractShape)

      expect(consumed.filter((route) => !registered.includes(route))).toEqual([])
    })
  })

  describe('fixture shapes', () => {
    /** Assert a value carries exactly the contract's required fields. */
    function requiredFieldsOf(schemaName: string): string[] {
      return schemas[schemaName].required ?? []
    }

    it('portfolio entries carry the position fields', () => {
      for (const item of fixtures.portfolioItems) {
        expect(Object.keys(item).sort()).toEqual(
          requiredFieldsOf('PortfolioPositionResponse').sort(),
        )
      }
    })

    it('valuations are per currency and carry the valuation fields', () => {
      const required = requiredFieldsOf('CurrencyValuationResponse')

      expect(fixtures.valuations.length).toBeGreaterThan(0)
      for (const item of fixtures.valuations) {
        expect(required.filter((field) => !(field in item))).toEqual([])
      }

      // One entry per currency: a duplicate currency would double every total.
      const currencies = fixtures.valuations.map((v) => v.currency)
      expect(new Set(currencies).size).toBe(currencies.length)
    })

    it('transactions carry the summary fields', () => {
      const required = requiredFieldsOf('TransactionSummaryResponse')

      for (const item of fixtures.transactions) {
        expect(required.filter((field) => !(field in item))).toEqual([])
      }
    })

    it('wishlist entries carry the wishlist fields', () => {
      const required = requiredFieldsOf('WishlistItemResponse')

      for (const item of fixtures.wishlist) {
        expect(required.filter((field) => !(field in item))).toEqual([])
      }
    })

    it('bibliography entries carry the bibliography fields', () => {
      const required = requiredFieldsOf('BibliographyItemResponse')

      for (const item of fixtures.bibliography) {
        expect(required.filter((field) => !(field in item))).toEqual([])
      }
    })

    it('the split projection carries quantity, average price and ratio', () => {
      const required = requiredFieldsOf('SplitProjectionResponse')

      expect(required.filter((field) => !(field in fixtures.splitResult))).toEqual([])
    })

    it('an alert check carries a price and a nullable event', () => {
      const required = requiredFieldsOf('AlertCheckResponse')

      for (const check of [fixtures.alertCheckTriggered, fixtures.alertCheckClear]) {
        expect(required.filter((field) => !(field in check))).toEqual([])
      }

      // The event, when present, carries its own required fields.
      const event = fixtures.alertCheckTriggered.event
      expect(event).not.toBeNull()
      if (event !== null) {
        const eventRequired = requiredFieldsOf('TargetAlertEventResponse')
        expect(eventRequired.filter((field) => !(field in event))).toEqual([])
        expect(schemas['AlertIntent'].enum).toContain(event.intent)
      }
    })

    it('the market analysis carries series points as date and close', () => {
      const required = requiredFieldsOf('MarketAnalysisResponse')

      expect(required.filter((field) => !(field in fixtures.analysisAAPL))).toEqual([])
      for (const point of fixtures.analysisAAPL.series) {
        expect(Object.keys(point).sort()).toEqual(['close', 'date'])
      }
    })
  })

  describe('response schemas resolve', () => {
    it('every registered route has a response schema to verify against', () => {
      // Guards the test suite itself: a route with no schema would silently
      // skip fixture verification.
      const unresolved = registeredPaths()
        .map(toContractShape)
        .filter((path) => responseSchemaFor(path) === null)

      expect(unresolved).toEqual([])
    })
  })
})
