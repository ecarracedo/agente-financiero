import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import streamlit as st
from src.market_data import get_historical_data

def plot_stock_detail(ticker: str, period: str = "1y", chart_type: str = "Velas", target_price: float = None):
    """
    Creates a detailed chart for a stock with volume and moving averages.
    Crea un gráfico detallado para una acción con volumen y medias móviles.
    
    Args:
        ticker (str): The stock symbol.
        period (str): Time period.
        chart_type (str): 'Velas' or 'Línea'.
        target_price (float): Optional target price to plot as a line.
    """
    # Fetch Data
    df = get_historical_data(ticker, period=period)
    
    if df.empty:
        st.warning(f"No hay datos históricos disponibles para {ticker}.")
        return

    # Calculate Moving Averages
    # Calculate Moving Averages - REMOVED per user request
    # df['SMA_20'] = df['Close'].rolling(window=20).mean()
    # df['SMA_50'] = df['Close'].rolling(window=50).mean()
    # df['SMA_200'] = df['Close'].rolling(window=200).mean()

    # Create Subplots: Row 1 for Price/Candles, Row 2 for Volume
    fig = make_subplots(
        rows=2, cols=1, 
        shared_xaxes=True, 
        vertical_spacing=0.05, 
        row_heights=[0.7, 0.3],
        subplot_titles=(f"Precio de {ticker}", "Volumen")
    )

    # 1. Price Chart (Candle or Line)
    if chart_type == "Velas":
        fig.add_trace(go.Candlestick(
            x=df.index,
            open=df['Open'],
            high=df['High'],
            low=df['Low'],
            close=df['Close'],
            name='OHLC'
        ), row=1, col=1)
    else:
        # Line / Area
        fig.add_trace(go.Scatter(
            x=df.index, 
            y=df['Close'],
            mode='lines',
            fill='tozeroy', # Area chart effect
            name='Cierre',
            line=dict(color='#00ff00', width=2) # Bright green default
        ), row=1, col=1)

    # Add Target Price Line if exists
    if target_price and target_price > 0:
        fig.add_hline(y=target_price, line_dash="dash", line_color="red", 
                      annotation_text=f"Objetivo: ${target_price}", 
                      annotation_position="top left",
                      row=1, col=1)

    # 2. Moving Averages - REMOVED
    # ... (same as before)

    # 3. Volume Bar Chart
    # Color volume bars based on price change
    colors = ['green' if row['Open'] - row['Close'] >= 0 
              else 'red' for index, row in df.iterrows()]
              
    fig.add_trace(go.Bar(
        x=df.index, 
        y=df['Volume'],
        marker_color=colors,
        name='Volumen'
    ), row=2, col=1)

    # Layout Updates
    # See below for dynamic range logic
    fig.update_layout(
        title_text=f"Análisis Técnico: {ticker}",
        xaxis_rangeslider_visible=False,
        height=600,
        template="plotly_dark",
        showlegend=True
    )

    # Dynamic Y-Axis Scaling logic
    # We apply this specifically to the Price subplot (Row 1)
    try:
        current_close = df['Close'].iloc[-1]
        
        if chart_type == "Velas":
            max_val = df['High'].max()
            min_val = df['Low'].min()
        else:
            # For Line/Area
            max_val = df['Close'].max()
            min_val = df['Close'].min()
            
        # condition: if current price is near the period high (> 90%)
        if current_close >= max_val * 0.90:
             # Add 40% headroom (User requested more visible space)
             upper_limit = max_val * 1.40
             # Bottom padding 10%
             lower_limit = min_val * 0.90
             
             # Adjust if Target Price is way above
             if target_price and target_price > upper_limit:
                 upper_limit = target_price * 1.05
                 
             fig.update_yaxes(range=[lower_limit, upper_limit], row=1, col=1)
        else:
             # If target price is in range, we might want to ensure it's visible?
             # Let's check max val again including target
             effective_max = max(max_val, target_price) if target_price else max_val
             
             if chart_type != "Velas":
                  upper = effective_max * 1.05
                  lower = min_val * 0.90
                  fig.update_yaxes(range=[lower, upper], row=1, col=1)
             else:
                 # for candles, if target is visible, ensure range covers it
                 if target_price and (target_price > max_val or target_price < min_val):
                      # let auto-range handle it or simple expand
                      pass

    except Exception as e:
        print(f"Error calculating dynamic range: {e}")
    
    st.plotly_chart(fig, use_container_width=True, config={'displayModeBar': True})
