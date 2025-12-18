import unittest
import sys
import os
import pandas as pd
from unittest.mock import patch

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.services.portfolio import Portfolio

class TestValuation(unittest.TestCase):
    def setUp(self):
        self.portfolio = Portfolio()
        self.ticker = "TEST_VAL"
        self.broker = "TEST_BROKER"
        self.portfolio.delete_ticker(self.ticker)

    def tearDown(self):
        self.portfolio.delete_ticker(self.ticker)

    @patch('src.market_data.get_current_price')
    def test_holdings_valuation(self, mock_get_price):
        # Mock current price to be higher than buy price
        mock_get_price.return_value = 150.0
        
        # Buy 10 @ 100
        self.portfolio.update_position(self.ticker, 10, 100.0, self.broker, "2024-01-01")
        
        df = self.portfolio.get_holdings_with_valuations()
        
        # Filter for our test ticker
        row = df[df['Ticker'] == self.ticker].iloc[0]
        
        self.assertEqual(row['Quantity'], 10)
        self.assertEqual(row['Avg Price'], 100.0)
        self.assertEqual(row['Current Price'], 150.0)
        self.assertEqual(row['Total Value'], 1500.0) # 10 * 150
        self.assertEqual(row['Gain/Loss $'], 500.0) # 1500 - 1000
        self.assertEqual(row['Gain/Loss %'], 50.0) # (150-100)/100 * 100

if __name__ == '__main__':
    unittest.main()
