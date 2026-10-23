import json
import os
import builtins
import importlib.util
import sys
import tempfile
import types
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
from django.test import SimpleTestCase

from api import llm_utils
from api.tasks import (
    _count_rows,
    attach_ai_insights,
    load_data_safely,
    run_eda_engine,
    run_ml_engine,
    sanitize_for_json,
)


def _test_credential(label):
    return f"Zz{abs(hash((label, os.getpid())))}Aa!"


TEST_LLM_API_KEY = _test_credential("llm")
TEST_GROK_API_KEY = _test_credential("grok")
TEST_EMPTY_SECRET = str()


class LLMProviderUnitTests(SimpleTestCase):
    def _load_llm_utils_with_importer(self, importer):
        module_path = os.path.join(os.path.dirname(llm_utils.__file__), "llm_utils.py")
        module_name = f"api.llm_utils_import_fallback_test_{id(importer)}"
        spec = importlib.util.spec_from_file_location(module_name, module_path)
        module = importlib.util.module_from_spec(spec)

        with patch.object(builtins, "__import__", side_effect=importer):
            try:
                sys.modules[module_name] = module
                spec.loader.exec_module(module)
            finally:
                sys.modules.pop(module_name, None)

        return module

    def test_llm_utils_import_uses_google_genai_fallback(self):
        original_import = builtins.__import__
        fallback_genai = types.SimpleNamespace(Client=lambda *a, **k: "google_genai")
        fallback_types = types.SimpleNamespace(GenerateContentConfig=lambda **k: "google_genai_config")

        def import_with_google_genai(name, globals=None, locals=None, fromlist=(), level=0):
            if name == "google" and tuple(fromlist or ()) == ("genai",):
                raise ImportError(name)
            if name == "google_genai":
                if tuple(fromlist or ()) == ("types",):
                    return types.SimpleNamespace(types=fallback_types)
                return fallback_genai
            return original_import(name, globals, locals, fromlist, level)

        module = self._load_llm_utils_with_importer(import_with_google_genai)

        self.assertEqual(module.genai.Client(), "google_genai")
        self.assertEqual(module.types.GenerateContentConfig(), "google_genai_config")

    def test_llm_utils_import_uses_direct_genai_fallback(self):
        original_import = builtins.__import__
        fallback_genai = types.SimpleNamespace(Client=lambda *a, **k: "direct_genai")
        fallback_types = types.SimpleNamespace(GenerateContentConfig=lambda **k: "direct_genai_config")

        def import_with_direct_genai(name, globals=None, locals=None, fromlist=(), level=0):
            normalized_fromlist = tuple(fromlist or ())
            if (name, normalized_fromlist) in {
                ("google", ("genai",)),
                ("google_genai", ()),
                ("google_genai", ("types",)),
            }:
                raise ImportError(name)
            if name == "genai":
                if normalized_fromlist == ("types",):
                    return types.SimpleNamespace(types=fallback_types)
                return fallback_genai
            return original_import(name, globals, locals, fromlist, level)

        module = self._load_llm_utils_with_importer(import_with_direct_genai)

        self.assertEqual(module.genai.Client(), "direct_genai")
        self.assertEqual(module.types.GenerateContentConfig(), "direct_genai_config")

    def test_llm_utils_import_uses_local_shim_when_genai_packages_missing(self):
        original_import = builtins.__import__

        def import_without_genai(name, globals=None, locals=None, fromlist=(), level=0):
            normalized_fromlist = tuple(fromlist or ())
            if (name, normalized_fromlist) in {
                ("google", ("genai",)),
                ("google.genai", ("types",)),
                ("google_genai", ()),
                ("google_genai", ("types",)),
                ("genai", ()),
                ("genai", ("types",)),
            }:
                raise ImportError(name)
            return original_import(name, globals, locals, fromlist, level)

        module = self._load_llm_utils_with_importer(import_without_genai)

        self.assertIsNone(module.genai.Client())
        self.assertIsNone(module.types.GenerateContentConfig())

    def test_normalize_response_coerces_frontend_shapes(self):
        normalized = llm_utils._normalize_response(
            {
                "summary": 123,
                "cleaning_tips": ["Fill blanks", "Cap outliers"],
                "feature_suggestions": [
                    {"title": "Revenue ratio"},
                    "Customer segment: group by type",
                    {"description": "Lag features"},
                    "Ignored extra item",
                ],
                "hypotheses": [
                    {"question": "Does churn vary by region?"},
                    {"investigation_focus": "Are outliers concentrated?"},
                    "Ignored extra hypothesis",
                ],
            }
        )

        self.assertEqual(normalized["summary"], "123")
        self.assertEqual(normalized["cleaning_tips"], "Fill blanks. Cap outliers")
        self.assertEqual(
            normalized["feature_suggestions"],
            ["Revenue ratio", "Customer segment: group by type", "Lag features"],
        )
        self.assertEqual(
            normalized["hypotheses"],
            ["Does churn vary by region?", "Are outliers concentrated?"],
        )

    @patch("api.llm_utils.genai.Client")
    def test_call_gemini_parses_markdown_wrapped_json(self, mock_client_class):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = "```json\n{\"summary\":\"ok\"}\n```"
        mock_client.models.generate_content.return_value = mock_response

        self.assertEqual(llm_utils._call_gemini(TEST_LLM_API_KEY, "prompt"), {"summary": "ok"})

    @patch("api.llm_utils.genai.Client", side_effect=Exception("boom"))
    def test_call_gemini_returns_none_on_client_error(self, _mock_client_class):
        self.assertIsNone(llm_utils._call_gemini(TEST_LLM_API_KEY, "prompt"))

    def test_parse_grok_response_returns_none_without_content(self):
        self.assertIsNone(llm_utils._parse_grok_response({"choices": [{"message": {}}]}))

    def test_clean_helpers_return_empty_for_non_lists_and_empty_dicts(self):
        self.assertEqual(llm_utils._clean_list_items("not-a-list", max_items=3), [])
        self.assertEqual(llm_utils._clean_hypotheses("not-a-list", max_items=3), [])
        self.assertEqual(llm_utils._extract_string_value({}), "")

    @patch("api.llm_utils.requests.post")
    def test_call_grok_parses_successful_response(self, mock_post):
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = {
            "choices": [{"message": {"content": json.dumps({"summary": "ok"})}}]
        }
        mock_post.return_value = mock_response

        self.assertEqual(llm_utils._call_grok(TEST_GROK_API_KEY, "prompt"), {"summary": "ok"})
        _, kwargs = mock_post.call_args
        self.assertEqual(kwargs["headers"]["Authorization"], f"Bearer {TEST_GROK_API_KEY}")
        self.assertEqual(kwargs["json"]["messages"][1]["content"], "prompt")

    @patch("api.llm_utils.time.sleep")
    @patch("api.llm_utils.requests.post")
    def test_call_grok_retries_rate_limit_then_returns_none(self, mock_post, mock_sleep):
        mock_post.return_value = MagicMock(status_code=429)

        self.assertIsNone(llm_utils._call_grok(TEST_GROK_API_KEY, "prompt", max_retries=2))
        self.assertEqual(mock_post.call_count, 2)
        self.assertEqual(mock_sleep.call_count, 2)

    @patch.dict(os.environ, {"GEMINI_API_KEY": TEST_EMPTY_SECRET, "XAI_API_KEY": TEST_GROK_API_KEY})
    @patch("api.llm_utils._call_grok", return_value={"summary": "fallback", "hypotheses": []})
    def test_get_llm_insights_uses_grok_when_gemini_key_missing(self, mock_grok):
        result = llm_utils.get_llm_insights({"metadata": {"rows": 3}})

        self.assertEqual(result["summary"], "fallback")
        mock_grok.assert_called_once()


class TaskHelperUnitTests(SimpleTestCase):
    def _temp_csv(self, content):
        temp_file = tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8")
        temp_file.write(content)
        temp_file.close()
        self.addCleanup(lambda: os.path.exists(temp_file.name) and os.remove(temp_file.name))
        return temp_file.name

    def test_count_rows_uses_wc_result_when_available(self):
        mock_completed = MagicMock(returncode=0, stdout="4 /tmp/data.csv")
        with patch("api.tasks.subprocess.run", return_value=mock_completed):
            self.assertEqual(_count_rows("/tmp/data.csv"), 3)

    def test_count_rows_adjusts_wc_result_when_file_lacks_trailing_newline(self):
        file_path = self._temp_csv("a,b\n1,2\n3,4")
        mock_completed = MagicMock(returncode=0, stdout=f"2 {file_path}")

        with patch("api.tasks.subprocess.run", return_value=mock_completed):
            self.assertEqual(_count_rows(file_path), 2)

    def test_count_rows_returns_zero_for_empty_file_after_wc_result(self):
        file_path = self._temp_csv("")
        mock_completed = MagicMock(returncode=0, stdout=f"0 {file_path}")

        with patch("api.tasks.subprocess.run", return_value=mock_completed):
            self.assertEqual(_count_rows(file_path), 0)

    def test_count_rows_falls_back_to_pandas_chunks(self):
        file_path = self._temp_csv("a,b\n1,2\n3,4\n")

        with patch("api.tasks.subprocess.run", side_effect=FileNotFoundError):
            self.assertEqual(_count_rows(file_path), 2)

    def test_count_rows_returns_zero_when_both_strategies_fail(self):
        with patch("api.tasks.subprocess.run", side_effect=FileNotFoundError):
            with patch("api.tasks.pd.read_csv", side_effect=ValueError("bad csv")):
                self.assertEqual(_count_rows("missing.csv"), 0)

    def test_load_data_safely_handles_empty_file(self):
        file_path = self._temp_csv("")

        df, header_df, error = load_data_safely(file_path)

        self.assertIsNone(df)
        self.assertIsNone(header_df)
        self.assertEqual(error, "The uploaded file is empty (0 bytes).")

    def test_load_data_safely_coerces_numeric_object_columns(self):
        file_path = self._temp_csv("amount,label\n1,a\n2,b\nN/A,c\n4,d\n")

        df, header_df, error = load_data_safely(file_path)

        self.assertIsNone(error)
        self.assertEqual(list(header_df.columns), ["amount", "label"])
        self.assertTrue(pd.api.types.is_numeric_dtype(df["amount"]))

    def test_sanitize_for_json_converts_numpy_pandas_and_null_bytes(self):
        sanitized = sanitize_for_json(
            {
                np.int64(1): [np.float64(2.5), np.array([1, 2]), np.nan],
                "bad": "a\x00b",
            }
        )

        self.assertEqual(sanitized[1], [2.5, [1, 2], None])
        self.assertEqual(sanitized["bad"], "ab")

    def test_run_eda_engine_builds_quality_metrics_and_univariate_stats(self):
        df = pd.DataFrame(
            {
                "sales": [10, None, 30, 40, 50, 60],
                "profit": [1, None, 3, None, 5, 6],
                "segment": ["a", "b", "a", "b", "a", "b"],
            }
        )
        header_df = df.head(0)

        eda_results, numeric_df = run_eda_engine(df, header_df, total_rows=6, file_name="sales.csv")

        self.assertEqual(eda_results["metadata"]["total_cols"], 3)
        self.assertIn("sales", eda_results["univariate"])
        self.assertIn("profit", eda_results["outliers"])
        self.assertEqual(
            eda_results["quality_metrics"]["null_correlation"]["labels"],
            ["sales", "profit"],
        )
        self.assertEqual(list(numeric_df.columns), ["sales", "profit"])

    def test_run_ml_engine_returns_empty_shape_for_insufficient_numeric_data(self):
        result = run_ml_engine(pd.DataFrame({"only_one": [1, 2, 3]}), {"univariate": {}})

        self.assertEqual(result["pca_data"], [])
        self.assertEqual(result["feature_influence"], {})

    def test_run_ml_engine_generates_pca_distribution_and_correlations(self):
        numeric_df = pd.DataFrame(
            {
                "a": [1, 2, 3, 4, 5, 6, 7],
                "b": [2, 4, 6, 8, 10, 12, 14],
                "c": [7, 6, 5, 4, 3, 2, 1],
            }
        )
        eda_results = {
            "univariate": {
                column: {"stats": {"min": float(numeric_df[column].min())}}
                for column in numeric_df.columns
            }
        }

        result = run_ml_engine(numeric_df, eda_results)

        self.assertGreater(len(result["pca_data"]), 0)
        self.assertEqual(set(result["feature_influence"]), {"a", "b", "c"})
        self.assertEqual(set(result["distribution_analysis"]), {"a", "b", "c"})
        self.assertEqual(set(result["influential_correlations"]["x"]), {"a", "b", "c"})

    @patch("api.tasks.get_llm_insights", return_value=None)
    def test_attach_ai_insights_uses_rule_based_fallback(self, _mock_get_llm):
        numeric_df = pd.DataFrame({"a": [1, 2, 3], "b": [2, 4, 6]})
        eda_results = {
            "metadata": {
                "file_name": "fallback.csv",
                "health_score": 75,
                "missing_values": {"a": 1, "b": 0},
            },
            "outliers": {"a": 2, "b": 0},
        }

        result = attach_ai_insights({"feature_influence": {"a": 0.9}}, eda_results, numeric_df)

        self.assertTrue(result["ai_observations"]["is_fallback"])
        self.assertIn("Critical quality issues", result["ai_observations"]["summary"])
        self.assertTrue(
            any(
                suggestion.startswith("Missingness Indicators")
                for suggestion in result["ai_observations"]["feature_suggestions"]
            )
        )

    @patch(
        "api.tasks.get_llm_insights",
        return_value={
            "summary": "LLM summary",
            "hypotheses": ["A?", "B?"],
            "cleaning_tips": "Clean it",
            "feature_suggestions": ["One", "Two", "Three"],
        },
    )
    def test_attach_ai_insights_preserves_successful_llm_response(self, _mock_get_llm):
        numeric_df = pd.DataFrame({"a": [1, 2, 3], "b": [2, 4, 6]})
        eda_results = {
            "metadata": {"file_name": "ok.csv", "health_score": 99, "missing_values": {}},
            "outliers": {"a": 0},
        }

        result = attach_ai_insights({}, eda_results, numeric_df)

        self.assertFalse(result["ai_observations"]["is_fallback"])
        self.assertEqual(result["ai_observations"]["summary"], "LLM summary")
