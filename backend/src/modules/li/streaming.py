from typing import AsyncIterator, Dict, Any, Optional
import anyio
import numpy as np

from backend.src.modules.li.li import LeadingIndicatorsModule


def _convert_numpy_types(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _convert_numpy_types(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_numpy_types(i) for i in obj]
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


async def stream_leading_indicator_events(
    primary_df,
    target_col: str,
    region: str,
    geo: str,
    extra_info: str,
    file_id: str,
    user_api_key: Optional[str] = None,
) -> AsyncIterator[Dict[str, Any]]:
    module = LeadingIndicatorsModule()

    yield {"status": "progress", "stage": "Sending request to LLM..."}
    generator = module.generator
    if user_api_key:
        generator = module.generator.__class__(api_key=user_api_key)

    queries = await anyio.to_thread.run_sync(
        generator.generate,
        target_col,
        region,
        extra_info or "",
    )

    if not queries:
        raise ValueError("Failed to generate queries.")

    yield {"status": "progress", "stage": "Fetching data from Google Trends..."}
    trends_df = await anyio.to_thread.run_sync(module.fetcher.fetch_data, queries, geo)

    if trends_df.empty:
        raise ValueError("Google Trends data is missing.")

    trends_key = module.storage.join_key("outputs", f"raw_trends_{file_id}.csv")
    await anyio.to_thread.run_sync(module.storage.write_csv, trends_key, trends_df, True)

    yield {"status": "progress", "stage": "Finalizing calculations..."}
    results_df = await anyio.to_thread.run_sync(
        module.analyzer.calculate_lags,
        primary_df,
        target_col,
        trends_df,
    )

    final_key = module.storage.join_key("outputs", f"correlations_{file_id}.csv")
    await anyio.to_thread.run_sync(module.storage.write_csv, final_key, results_df, False)

    top_results_df = results_df.head(10).replace({float('nan'): None})
    top_results_list = top_results_df.to_dict(orient="records")
    safe_results = _convert_numpy_types(top_results_list)

    yield {
        "status": "done",
        "data": {
            "status": "success",
            "queries_generated": queries,
            "trends_file": trends_key,
            "correlations_file": final_key,
            "top_results": safe_results,
        },
    }
