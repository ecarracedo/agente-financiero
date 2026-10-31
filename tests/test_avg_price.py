from src.services.portfolio import Portfolio
from src.models.database import PortfolioItem

def test_net_investment_logic(isolated_database):
    """Verify selling preserves the weighted average purchase price."""
    portfolio = Portfolio()
    ticker = "TEST_AVG_UI"
    broker = "TEST_BROKER"

        # 1. Buy 25 @ 2.595
    portfolio.update_position(ticker, 25, 2.595, broker, "2024-01-01")
    item = PortfolioItem.get(PortfolioItem.ticker == ticker)
    assert item.avg_price == 2.595
    assert item.quantity == 25

        # 2. Sell 10 @ 2.100
        # Expected: 
    portfolio.update_position(ticker, -10, 2.100, broker, "2024-01-02")
    item = PortfolioItem.get(PortfolioItem.ticker == ticker)
    assert item.avg_price == 2.595
    assert item.quantity == 15
