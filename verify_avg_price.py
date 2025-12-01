from src.portfolio import Portfolio
from src.database import PortfolioItem, Transaction
import time

def test_avg_price():
    p = Portfolio()
    ticker = "TEST_AVG"
    broker = "TEST_BROKER"
    
    # Clean up previous runs
    p.delete_ticker(ticker)
    
    print(f"--- Testing {ticker} ---")
    
    # 1. Buy 25 @ 2.595
    print("\n1. Buying 25 @ 2.595")
    p.update_position(ticker, 25, 2.595, broker, "2024-01-01")
    
    item = PortfolioItem.get(PortfolioItem.ticker == ticker)
    print(f"Qty: {item.quantity} | Avg: {item.avg_price:.4f}")
    assert item.quantity == 25
    assert abs(item.avg_price - 2.595) < 0.001
    
    # 2. Sell 10 @ 2.100
    # Expected: 
    # Old Cost = 64.875
    # Recovered = 21.000
    # New Cost = 43.875
    # Remaining = 15
    # New Avg = 2.925
    print("\n2. Selling 10 @ 2.100")
    p.update_position(ticker, -10, 2.100, broker, "2024-01-02")
    
    item = PortfolioItem.get(PortfolioItem.ticker == ticker)
    print(f"Qty: {item.quantity} | Avg: {item.avg_price:.4f}")
    
    assert item.quantity == 15
    assert abs(item.avg_price - 2.925) < 0.001
    
    print("\n✅ Test Passed!")
    
    # Cleanup
    p.delete_ticker(ticker)

if __name__ == "__main__":
    test_avg_price()
