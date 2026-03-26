import pandas as pd

class CorrelationAnalyzer:
    def calculate_lags(self, primary_df: pd.DataFrame, target_col: str, trends_df: pd.DataFrame, max_lag: int = 3) -> pd.DataFrame:
        p_monthly = primary_df[[target_col]].resample('MS').mean()
        t_monthly = trends_df.resample('MS').mean()
        
        merged = p_monthly.join(t_monthly, how='inner').dropna(subset=[target_col])
        results = []

        for query in t_monthly.columns:
            valid_pair = merged[[target_col, query]].dropna()
            if len(valid_pair) < 5: continue

            row = {'Search Query': query}
            corr_0 = valid_pair[target_col].corr(valid_pair[query])
            row['Correlation (Lag 0)'] = round(corr_0, 3) if not pd.isna(corr_0) else 0.0

            best_lag, best_val = 0, abs(row['Correlation (Lag 0)'])

            for lag in range(1, max_lag + 1):
                l_corr = valid_pair[target_col].shift(-lag).corr(valid_pair[query])
                l_corr = round(l_corr, 3) if not pd.isna(l_corr) else 0.0
                row[f'Correlation (Lag -{lag})'] = l_corr
                
                if abs(l_corr) > best_val:
                    best_val, best_lag = abs(l_corr), lag

            if best_val < 0.4: row['Result'] = "Noise"
            elif best_lag > 0: row['Result'] = f"Lead (Lag -{best_lag})"
            else: row['Result'] = "Synchronous"
            
            results.append(row)

        return pd.DataFrame(results).sort_values(by='Correlation (Lag 0)', ascending=False)