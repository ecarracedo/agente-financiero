from src.portfolio import Portfolio
import sys

try:
    p = Portfolio()
    print("Portfolio instantiated.")
    if hasattr(p, 'delete_ticker'):
        print("SUCCESS: delete_ticker method exists.")
    else:
        print("FAILURE: delete_ticker method MISSING.")
        print("Attributes:", dir(p))
        sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
