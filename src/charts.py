import plotly.express as px
import pandas as pd
import streamlit as st
from src.market_data import get_current_price

def get_portfolio_df(portfolio):
    """
    Wrapper to get portfolio data using the centralized method.
    """
    return portfolio.get_holdings_with_valuations()

def plot_portfolio_composition(portfolio):
    """
    Plots a pie chart of the portfolio composition by Category.
    """
    df = get_portfolio_df(portfolio)
    if df.empty:
        st.info("No hay datos para graficar.")
        return

    # Group by Category
    df_cat = df.groupby("Category")["Total Value"].sum().reset_index()
    
    fig = px.pie(df_cat, values='Total Value', names='Category', 
                 title='Composición por Categoría (Valor de Mercado)',
                 hole=0.4)
    st.plotly_chart(fig, use_container_width=True)

def plot_asset_allocation(portfolio):
    """
    Plots a bar chart of the portfolio allocation by Asset (Ticker).
    """
    df = get_portfolio_df(portfolio)
    if df.empty:
        st.info("No hay datos para graficar.")
        return

    # Sort by Value
    df = df.sort_values("Total Value", ascending=False)
    
    fig = px.bar(df, x='Ticker', y='Total Value', color='Category',
                 title='Distribución por Activo (Valor de Mercado)',
                 text_auto='.2s')
    st.plotly_chart(fig, use_container_width=True)
