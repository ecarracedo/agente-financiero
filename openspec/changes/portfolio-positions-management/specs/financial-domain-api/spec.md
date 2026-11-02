# Delta for Financial Domain API

## ADDED Requirements

### Requirement: Update a position's broker and asset type

The API MUST let a client change the broker or the asset type of an existing position without altering its quantity, weighted average price, or currency.

- `PUT /api/v1/portfolio/{ticker}` MUST accept an optional `broker` and an optional `category` in the body.
- The position to update MUST be identified by the `broker` and `category` query parameters, because those are part of the position's business identity.
- The response MUST be the updated position.
- An unknown position MUST answer `404`.

#### Scenario: Change only the asset type

- GIVEN a position `ALUA.BA` held in `ECO` with asset type `Acciones`
- WHEN the client sends `PUT /api/v1/portfolio/ALUA.BA?broker=ECO&category=Acciones` with `{"category": "Cedear"}`
- THEN the response carries asset type `Cedear`
- AND the quantity, weighted average price and currency are unchanged

#### Scenario: Unknown position

- GIVEN no position matches the identity in the query parameters
- WHEN the client sends the update
- THEN the API answers `404`
