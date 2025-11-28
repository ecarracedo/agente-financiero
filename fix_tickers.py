from src.database import PortfolioItem, Transaction

def fix_tickers():
    # List of tickers that should be Argentine
    arg_tickers = ['BYMA', 'ALUA', 'TXAR', 'GGAL', 'YPF', 'PAMP', 'CRES', 'EDN', 'LOMA', 'TECO2']
    
    print("Fixing Portfolio Items...")
    for item in PortfolioItem.select():
        if item.ticker in arg_tickers:
            old = item.ticker
            item.ticker = f"{old}.BA"
            item.save()
            print(f"Updated {old} -> {item.ticker}")

    print("\nFixing Transactions...")
    for t in Transaction.select():
        if t.ticker in arg_tickers:
            old = t.ticker
            t.ticker = f"{old}.BA"
            t.save()
            print(f"Updated transaction {old} -> {t.ticker}")

if __name__ == "__main__":
    fix_tickers()
