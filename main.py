import streamlit as st
import pandas as pd
from src.portfolio import Portfolio
from src.market_data import get_current_price, get_historical_data
from src.analyzer import analyze_stock
from src.bibliography import Bibliography

# Page Config
st.set_page_config(page_title="Agente Financiero", layout="wide")

# Title
st.title("💰 Agente Financiero Personal")

# Sidebar
st.sidebar.header("Configuración")
excel_path = "/home/emi/Documentos/Proyectos/agente-financiero/Inversiones 2025.xlsx"

# Delete Ticker Section
with st.sidebar.expander("🗑️ Zona de Peligro"):
    st.warning("Acciones irreversibles")
    del_ticker = st.text_input("Eliminar Ticker (Todo)", placeholder="Ej: AAPL").upper()
    if st.button("Eliminar Ticker"):
        if del_ticker:
            count = portfolio.delete_ticker(del_ticker)
            if count > 0:
                st.success(f"Eliminados {count} registros de {del_ticker}.")
                st.rerun()
            else:
                st.error(f"No se encontraron registros de {del_ticker} o hubo un error.")

# Load Portfolio
@st.cache_data(ttl=60) # Cache for 60 seconds or until reload
def load_portfolio():
    return Portfolio()

try:
    portfolio = load_portfolio()
    st.sidebar.success("Portafolio cargado (DB)")
except Exception as e:
    st.sidebar.error(f"Error cargando portafolio: {e}")
    st.stop()

# Tabs
# Tabs
tab1, tab2, tab3, tab4, tab5 = st.tabs(["📊 Portafolio", "💸 Operaciones", "🚀 Oportunidades", "📝 Wishlist", "📚 Bibliografía"])

with tab1:
    st.header("Mi Portafolio")
    
    # Summary Metrics
    summary = portfolio.get_portfolio_summary()
    if summary:
        cols = st.columns(len(summary))
        for i, (cat, val) in enumerate(summary.items()):
            cols[i].metric(cat, f"{val:,.2f}")
    else:
        st.info("Portafolio vacío.")
    
    # Detailed Holdings
    st.subheader("Detalle de Tenencias")
    for cat, series in portfolio.holdings.items():
        with st.expander(f"{cat} ({len(series)} activos)", expanded=True):
            st.dataframe(series)

with tab2:
    st.header("Registrar Operación")
    
    col1, col2 = st.columns(2)
    
    with col1:
        op_type = st.radio("Tipo de Operación", ["Compra", "Venta"], horizontal=True)
        ticker_op = st.text_input("Ticker", placeholder="Ej: AAPL").upper()
        broker_op = st.selectbox("Broker", ["Eco", "PPI", "Galicia", "Binance"])
        
    with col2:
        quantity_op = st.number_input("Cantidad / Monto Nominal", min_value=0.0, step=1.0)
        
        # Auto-fetch price
        current_price = 0.0
        if ticker_op:
            fetched_price = get_current_price(ticker_op)
            if fetched_price:
                current_price = fetched_price
        
        price_op = st.number_input("Precio Unitario", min_value=0.0, value=current_price, step=0.01, format="%.2f")
        category_op = st.selectbox("Categoría (solo para compras nuevas)", ["Acciones", "Bonos", "Cedear", "Cripto", "FCI", "Letras", "ON"])
        date_op = st.date_input("Fecha de Operación")
        
    if st.button("Confirmar Operación", type="primary"):
        if ticker_op and quantity_op > 0 and price_op > 0:
            qty_change = quantity_op if op_type == "Compra" else -quantity_op
            
            with st.spinner("Procesando..."):
                portfolio.update_position(ticker_op, qty_change, price_op, broker_op, date_op, category_op)
                st.success(f"Operación registrada: {op_type} {quantity_op} de {ticker_op} en {broker_op} a ${price_op} el {date_op}")
                st.rerun()
        else:
            st.error("Por favor completa todos los campos (Ticker, Cantidad, Precio).")

    st.markdown("---")
    st.subheader("📜 Historial de Transacciones")
    transactions = portfolio.get_transactions()
    if transactions:
        df_trans = pd.DataFrame(transactions)
        # Format date
        df_trans['date'] = pd.to_datetime(df_trans['date']).dt.strftime('%Y-%m-%d')
        # Calculate Total
        df_trans['total'] = df_trans['quantity'] * df_trans['price']
        
        # Reorder columns for better readability
        cols = ['date', 'ticker', 'operation_type', 'quantity', 'price', 'total', 'broker', 'category']
        # Ensure columns exist (in case of schema diffs, though unlikely now)
        cols = [c for c in cols if c in df_trans.columns]
        
        st.dataframe(df_trans[cols].sort_values(by='date', ascending=False))
    else:
        st.info("No hay transacciones registradas.")

with tab3:
    st.header("Análisis de Oportunidades")
    st.info("Analizando tus activos para detectar oportunidades de compra/venta...")
    
    tickers = portfolio.get_all_tickers()
    
    # Filter for valid tickers (simple check)
    # Adding .BA for Argentinian stocks if needed, or assuming US tickers.
    # Given the tickers (GGAL, YPF), they are likely ADSs or local. 
    # Let's try fetching as is first, or append .BA if they are local.
    # For now, let's assume they are US tickers or have the correct suffix.
    # Actually, many look like local tickers (ALUA, TXAR). 
    # Let's add a selector or try both.
    
    market_suffix = st.sidebar.selectbox("Mercado", ["EE.UU. (Sin sufijo)", "Argentina (.BA)"], index=1)
    suffix = ".BA" if "Argentina" in market_suffix else ""
    
    if st.button("Analizar Mercado"):
        progress_bar = st.progress(0)
        results = []
        
        for i, ticker in enumerate(tickers):
            full_ticker = f"{ticker}{suffix}"
            # Skip crypto/bonds for now if yfinance doesn't support them well without specific mapping
            if ticker in ['BTC', 'AL30', 'AL29']: 
                continue
                
            price = get_current_price(full_ticker)
            if price:
                history = get_historical_data(full_ticker)
                analysis = analyze_stock(full_ticker, price, history)
                
                if analysis["signals"]:
                    results.append({
                        "Ticker": ticker,
                        "Precio": price,
                        "Señales": ", ".join(analysis["signals"]),
                        "Razón": " / ".join(analysis["signals"])
                    })
            progress_bar.progress((i + 1) / len(tickers))
            
        if results:
            st.success(f"Se encontraron {len(results)} oportunidades!")
            st.dataframe(pd.DataFrame(results))
        else:
            st.warning("No se detectaron oportunidades claras con los criterios actuales.")

from src.wishlist import Wishlist

# ... (inside tab3)

with tab4:
    st.header("Wishlist")
    st.info("Gestiona tus acciones favoritas para monitorear.")
    
    wishlist = Wishlist()
    
    # Add new ticker
    col1, col2 = st.columns([3, 1])
    with col1:
        new_ticker = st.text_input("Agregar Ticker:", placeholder="Ej: AAPL, GGAL.BA")
    with col2:
        if st.button("Agregar"):
            if new_ticker:
                wishlist.add_ticker(new_ticker)
                st.success(f"{new_ticker} agregado!")
                st.rerun()

    # Display wishlist
    items = wishlist.get_items()
    if items:
        st.subheader("Tus Acciones en Seguimiento")
        for ticker in items:
            col_a, col_b, col_c = st.columns([2, 2, 1])
            with col_a:
                st.write(f"**{ticker}**")
            with col_b:
                # Show quick price
                price = get_current_price(ticker)
                if price:
                    st.write(f"${price:,.2f}")
                else:
                    st.write("N/A")
            with col_c:
                if st.button("🗑️", key=f"del_{ticker}"):
                    wishlist.remove_ticker(ticker)
                    st.rerun()
    else:
        st.write("Tu wishlist está vacía.")

with tab5:
    st.header("📚 Bibliografía")
    st.info("Biblioteca de conocimientos del mercado de capitales.")
    
    biblio = Bibliography()
    
    # Add new item
    with st.expander("Agregar Nuevo Recurso"):
        with st.form("new_biblio_item"):
            b_title = st.text_input("Título")
            b_author = st.text_input("Autor")
            b_year = st.number_input("Año", min_value=1900, max_value=2100, step=1, value=2024)
            b_category = st.selectbox("Categoría", ["Libros", "Artículos", "Papers", "Videos", "Otros"])
            b_link = st.text_input("Enlace (Opcional)")
            b_desc = st.text_area("Descripción (Opcional)")
            
            submitted = st.form_submit_button("Guardar Recurso")
            if submitted:
                if b_title and b_author:
                    biblio.add_item(b_title, b_author, b_year, b_category, b_link, b_desc)
                    st.success(f"Agregado: {b_title}")
                    st.rerun()
                else:
                    st.error("Título y Autor son obligatorios.")

    # List items
    items = biblio.get_items()
    if items:
        for item in items:
            with st.container():
                c1, c2 = st.columns([4, 1])
                with c1:
                    st.subheader(f"{item['title']} ({item['year']})")
                    st.markdown(f"**Autor:** {item['author']} | **Categoría:** {item['category']}")
                    if item['description']:
                        st.write(item['description'])
                    if item['link']:
                        st.markdown(f"[🔗 Ver Recurso]({item['link']})")
                with c2:
                    if st.button("🗑️ Eliminar", key=f"del_bib_{item['id']}"):
                        biblio.delete_item(item['id'])
                        st.rerun()
                st.markdown("---")
    else:
        st.info("No hay recursos en la bibliografía aún.")

# Footer
st.markdown("---")
st.markdown("Desarrollado con ❤️ por tu Agente Financiero")
