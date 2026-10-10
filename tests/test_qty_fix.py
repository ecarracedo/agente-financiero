from src.services.portfolio import Portfolio
from datetime import date
from src.models.database import PortfolioItem


def test_sell_quantity(isolated_database):
    """Verify selling a partial position reduces only the quantity."""
    p = Portfolio()
    ticker = "TEST_QTY"
    broker = "TEST_BROKER"

    # Clean up
    p.delete_ticker(ticker)

    print("\n--- Testing Quantity Logic ---")
    # 1. Buy 100
    p.update_position(ticker, 100, 10.0, broker, date.today())

    item = PortfolioItem.get_or_none(
        (PortfolioItem.ticker == ticker) & (PortfolioItem.broker == broker)
    )
    assert item is not None
    assert item.quantity == 100
    print(f"After Buy 100: Qty={item.quantity}")

    if item.quantity != 100:
        print("❌ FAILURE: Initial quantity incorrect")
        return

    # 2. Sell 30
    print("Selling 30...")
    p.update_position(ticker, -30, 12.0, broker, date.today())

    item = PortfolioItem.get_or_none(
        (PortfolioItem.ticker == ticker) & (PortfolioItem.broker == broker)
    )
    assert item is not None
    assert item.quantity == 70
    print(f"After Sell 30: Qty={item.quantity}")

    if item.quantity == 70:
        print("✅ SUCCESS: Quantity reduced to 70")
    else:
        print(f"❌ FAILURE: Quantity is {item.quantity} (Expected 70)")

    # Clean up
    p.delete_ticker(ticker)
