import pandas as pd

try:
    file_path = "/home/emi/Documentos/Proyectos/agente-financiero/Inversiones 2025.xlsx"
    xls = pd.ExcelFile(file_path)
    print("Sheet names:", xls.sheet_names)
    
    for sheet in xls.sheet_names:
        print(f"\n--- Sheet: {sheet} ---")
        df = pd.read_excel(file_path, sheet_name=sheet)
        print("Columns:", df.columns.tolist())
        print(df.head().to_string())
except Exception as e:
    print(f"Error reading Excel: {e}")
