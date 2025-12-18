
from src.services.portfolio import Portfolio
from datetime import date

def test_avg_price_logic():
    p = Portfolio()
    ticker = "TEST_AVG"
    broker = "TEST_BROKER"
    
    # Clean up
    p.delete_ticker(ticker)
    
    print("\n--- Testing Buy Logic ---")
    # 1. Buy 10 @ $100
    p.update_position(ticker, 10, 100.0, broker, date.today())
    # Expect: 10 @ $100
    
    # 2. Buy 10 @ $200
    p.update_position(ticker, 10, 200.0, broker, date.today())
    # Expect: 20 @ $150 ((1000 + 2000) / 20)
    
    print("\n--- Testing Sell Logic ---")
    # 3. Sell 10 @ $300 (Profit)
    p.update_position(ticker, -10, 300.0, broker, date.today())
    # Expect: 10 @ $150 (Avg price should NOT change)
    
    # Verify
    item = p.get_portfolio_item(ticker, broker)
    if item:
        print(f"\nResult: {item.quantity} shares @ ${item.avg_price:.2f}")
        if abs(item.avg_price - 150.0) < 0.01:
            print("✅ SUCCESS: Average price remained $150.00 after selling")
        else:
            print(f"❌ FAILURE: Average price changed to ${item.avg_price:.2f} (Expected $150.00)")
    else:
        print("❌ FAILURE: Item not found")

    # Clean up
    p.delete_ticker(ticker)

if __name__ == "__main__":
    # Mock get_portfolio_item for verification
    def get_portfolio_item(self, ticker, broker):
        from src.models.database import PortfolioItem
        return PortfolioItem.get_or_none((PortfolioItem.ticker == ticker) & (PortfolioItem.broker == broker))
    
    Portfolio.get_portfolio_item = get_portfolio_item
    
    test_avg_price_logic()
