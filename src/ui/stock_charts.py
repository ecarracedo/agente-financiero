import streamlit as st
import pandas as pd
from streamlit_lightweight_charts import renderLightweightCharts
from src.external.market_data import get_historical_data

def plot_stock_detail(ticker: str, period: str = "1y", chart_type: str = "Velas", target_price: float = None, avg_price: float = None, transactions: list = None):
    """
    Renders a stock chart using Lightweight Charts (TradingView style).
    Replaces the old Plotly implementation.
    """
    
    # Fetch Data
    df = get_historical_data(ticker, period=period)
    
    if df.empty:
        st.warning(f"No hay datos históricos disponibles para {ticker}.")
        return

    # Prepare Data for Lightweight Charts
    df_chart = df.reset_index()
    # Ensure date format is YYYY-MM-DD
    df_chart['Date'] = df_chart['Date'].dt.strftime('%Y-%m-%d')
    
    # Candlestick Series Data
    candles_data = []
    volume_data = []
    
    for index, row in df_chart.iterrows():
        candles_data.append({
            "time": row['Date'],
            "open": row['Open'],
            "high": row['High'],
            "low": row['Low'],
            "close": row['Close']
        })
        
        # Volume color logic
        color = 'rgba(0, 150, 136, 0.8)' if row['Close'] >= row['Open'] else 'rgba(255, 82, 82, 0.8)'
        
        volume_data.append({
            "time": row['Date'],
            "value": row['Volume'],
            "color": color
        })

    # Chart Options / Visualization Configuration
    chartOptions = {
        "layout": {
            "textColor": 'white',
            "background": {
                "type": 'solid',
                "color": '#0E1117'
            }
        },
        "grid": {
            "vertLines": { "color": "rgba(197, 203, 206, 0.1)" },
            "horzLines": { "color": "rgba(197, 203, 206, 0.1)" }
        },
        "height": 500,
        # Disable scroll/zoom via mouse wheel to prevent page scroll hijacking
        "handleScroll": False,
        "handleScale": False
    }

    # Series Configuration
    series = []
    
    # Main Chart Series
    if chart_type == "Velas":
        series.append({
            "type": 'Candlestick',
            "data": candles_data,
            "options": {
                "upColor": '#26a69a',
                "downColor": '#ef5350',
                "borderVisible": False,
                "wickUpColor": '#26a69a',
                "wickDownColor": '#ef5350'
            }
        })
    else:
        area_data = [{"time": item["time"], "value": item["close"]} for item in candles_data]
        series.append({
            "type": 'Area',
            "data": area_data,
            "options": {
                "topColor": 'rgba(38, 166, 154, 0.56)',
                "bottomColor": 'rgba(38, 166, 154, 0.04)',
                "lineColor": 'rgba(38, 166, 154, 1)',
                "lineWidth": 2,
            }
        })

    # Add Transaction Lines if exist
    if transactions:
        for tx in transactions:
            is_buy = tx['operation_type'] == "Compra"
            color = '#26a69a' if is_buy else '#ef5350' # Green / Red
            line_style = 2 # Dashed
            
            # Create a constant line for this transaction price
            tx_data = [{"time": item["time"], "value": tx['price']} for item in candles_data]
            
            series.append({
                "type": 'Line',
                "data": tx_data,
                "options": {
                    "color": color,
                    "lineWidth": 1,
                    "lineStyle": line_style,
                    "title": f"{'Compra' if is_buy else 'Venta'} {tx['quantity']:.0f} @ ${tx['price']:.2f}",
                    "crosshairMarkerVisible": False,
                    "priceLineVisible": False
                }
            })

    # Add Volume
    series.append({
        "type": 'Histogram',
        "data": volume_data,
        "options": {
            "priceFormat": { "type": 'volume' },
            "priceScaleId": '', # Overlay
        },
        "priceScale": {
            "scaleMargins": {
                "top": 0.85, # Volume only visible in bottom 15%
                "bottom": 0,
            }
        }
    })

    # Add Target Price Line if exists
    if target_price:
        target_data = [{"time": item["time"], "value": target_price} for item in candles_data]
        series.append({
            "type": 'Line',
            "data": target_data,
            "options": {
                "color": 'red',
                "lineWidth": 1,
                "lineStyle": 2, # Dashed
                "title": 'Objetivo',
                "crosshairMarkerVisible": False,
                "priceLineVisible": False
            }
        })
    
    # Add Average Purchase Price Line if exists
    if avg_price and avg_price > 0:
        avg_data = [{"time": item["time"], "value": avg_price} for item in candles_data]
        series.append({
            "type": 'Line',
            "data": avg_data,
            "options": {
                "color": '#FFD600', # Yellow
                "lineWidth": 2, # Thicker
                "lineStyle": 0, # Solid
                "title": 'Precio Promedio',
                "crosshairMarkerVisible": False,
                "priceLineVisible": False
            }
        })

    # Render Chart
    renderLightweightCharts([
        {
            "chart": chartOptions,
            "series": series
        }
    ], key=f"lw_chart_{ticker}_{chart_type}")
