from unittest.mock import patch

from src.services.portfolio import Portfolio

@patch("src.external.market_data.get_current_price")
def test_holdings_valuation(mock_get_price, isolated_database):
        """Verify valuation metrics use the mocked current market price."""
        portfolio = Portfolio()
        ticker = "TEST_VAL"
        broker = "TEST_BROKER"

        # Mock current price to be higher than buy price
        mock_get_price.return_value = 150.0
        
        # Buy 10 @ 100
        portfolio.update_position(ticker, 10, 100.0, broker, "2024-01-01")
        
        df = portfolio.get_holdings_with_valuations()
        
        # Filter for our test ticker
        row = df[df["Ticker"] == ticker].iloc[0]
        
        assert row["Quantity"] == 10
        assert row["Avg Price"] == 100.0
        assert row["Current Price"] == 150.0
        assert row["Total Value"] == 1500.0
        assert row["Gain/Loss $"] == 500.0
        assert row["Gain/Loss %"] == 50.0
