import unittest
import sys
import os

# Add project root to path to allow imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.portfolio import Portfolio
from src.database import PortfolioItem

class TestAvgPrice(unittest.TestCase):
    def setUp(self):
        self.portfolio = Portfolio()
        self.ticker = "TEST_AVG_UI"
        self.broker = "TEST_BROKER"
        # Clean up before test
        self.portfolio.delete_ticker(self.ticker)

    def tearDown(self):
        # Clean up after test
        self.portfolio.delete_ticker(self.ticker)

    def test_net_investment_logic(self):
        # 1. Buy 25 @ 2.595
        self.portfolio.update_position(self.ticker, 25, 2.595, self.broker, "2024-01-01")
        item = PortfolioItem.get(PortfolioItem.ticker == self.ticker)
        self.assertAlmostEqual(item.avg_price, 2.595, places=3)
        self.assertEqual(item.quantity, 25)

        # 2. Sell 10 @ 2.100
        # Expected: 
        # Old Cost = 64.875
        # Recovered = 21.000
        # New Cost = 43.875
        # Remaining = 15
        # New Avg = 2.925
        self.portfolio.update_position(self.ticker, -10, 2.100, self.broker, "2024-01-02")
        item = PortfolioItem.get(PortfolioItem.ticker == self.ticker)
        self.assertAlmostEqual(item.avg_price, 2.925, places=3)
        self.assertEqual(item.quantity, 15)

if __name__ == '__main__':
    unittest.main()
