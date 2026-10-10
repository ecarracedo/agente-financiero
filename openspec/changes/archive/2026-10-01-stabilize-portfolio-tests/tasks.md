# Tasks: Estabilizar pruebas de cartera

## Phase 1: Test Foundation

- [x] 1.1 Create `tests/conftest.py` with a function-scoped in-memory SQLite fixture that binds all four Peewee models, creates tables, yields an open database, and cleans up after each test.
- [x] 1.2 Confirm the fixture prevents access to repository `finance.db` by running a focused test from the repository root and checking the database file remains unchanged.

## Phase 2: RED Tests

- [x] 2.1 Update `tests/test_avg_fix.py` and `tests/test_qty_fix.py` to use the fixture and replace missing `get_portfolio_item` calls with supported model/API assertions; run them to capture remaining failures.
- [x] 2.2 Update `tests/test_avg_price.py` to use the fixture and assert that selling reduces quantity while preserving the weighted average documented by the project.
- [x] 2.3 Update `tests/test_valuation.py` to use the fixture and patch `src.external.market_data.get_current_price` at the real import path; verify valuation scenarios remain deterministic.

## Phase 3: GREEN / REFACTOR

- [x] 3.1 Make the corrected test suite pass without changing production financial behavior; only modify `src/models/database.py` or `src/services/portfolio.py` if fixture binding exposes a genuine testability defect.
- [x] 3.2 Remove duplicated path manipulation and test-only monkey patches from the affected test files while preserving readable setup and cleanup.

## Phase 4: Verification

- [x] 4.1 Run `pytest` twice from the repository root and confirm all tests pass in both runs, covering isolation, purchases, sales, average, quantity, and valuation scenarios.
- [x] 4.2 Run `git diff --check` and verify `finance.db` is not modified; record the final test count in the verification report.
