# Read-Only Financial Agent Specification

## Purpose
Provide AWS Strands-based analysis agents that can inspect financial data through explicit, controlled tools.

## Requirements

### Requirement: Read-only analysis

The agent MUST answer portfolio and market-analysis questions using approved read-only tools and MUST NOT mutate holdings, transactions, alerts, wishlist, or bibliography.

#### Scenario: Analyze a portfolio

- GIVEN the user requests an analysis of current holdings
- WHEN the agent invokes approved data tools
- THEN it returns an explanation grounded in available portfolio and market data
- AND no financial record is changed

#### Scenario: Request an unsupported action

- GIVEN the user asks the agent to buy, sell, delete, or alter a financial record
- WHEN the request is processed
- THEN the agent refuses or routes it to an explicit confirmation workflow
- AND no mutation is performed

### Requirement: Tool and credential boundaries

The agent MUST use an allowlist of tools, scoped credentials, bounded execution, and auditable request outcomes.

#### Scenario: Tool access is limited

- GIVEN an agent request is running
- WHEN the agent selects a tool
- THEN only an approved tool with the required read permission is callable
- AND credentials are not exposed in the response

#### Scenario: Provider failure

- GIVEN a market or data provider is unavailable
- WHEN the agent attempts analysis
- THEN it reports uncertainty or unavailable data
- AND it does not invent prices or signals
