
from src.portfolio import Portfolio
from datetime import date

def test_sell_quantity():
    p = Portfolio()
    ticker = "TEST_QTY"
    broker = "TEST_BROKER"
    
    # Clean up
    p.delete_ticker(ticker)
    
    print("\n--- Testing Quantity Logic ---")
    # 1. Buy 100
    p.update_position(ticker, 100, 10.0, broker, date.today())
    
    item = p.get_portfolio_item(ticker, broker)
    print(f"After Buy 100: Qty={item.quantity}")
    
    if item.quantity != 100:
        print("❌ FAILURE: Initial quantity incorrect")
        return

    # 2. Sell 30
    print("Selling 30...")
    p.update_position(ticker, -30, 12.0, broker, date.today())
    
    item = p.get_portfolio_item(ticker, broker)
    print(f"After Sell 30: Qty={item.quantity}")
    
    if item.quantity == 70:
        print("✅ SUCCESS: Quantity reduced to 70")
    else:
        print(f"❌ FAILURE: Quantity is {item.quantity} (Expected 70)")

    # Clean up
    p.delete_ticker(ticker)

if __name__ == "__main__":
    # Mock get_portfolio_item for verification
    def get_portfolio_item(self, ticker, broker):
        from src.database import PortfolioItem
        return PortfolioItem.get_or_none((PortfolioItem.ticker == ticker) & (PortfolioItem.broker == broker))
    
    Portfolio.get_portfolio_item = get_portfolio_item
    
    test_sell_quantity()
