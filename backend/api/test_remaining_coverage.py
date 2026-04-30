import os
from smtplib import SMTPException
from unittest.mock import MagicMock, patch

import pandas as pd
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers, status
from rest_framework.test import APITestCase

from api import llm_utils
from api.serializers import AnalysisJobSerializer, RegisterSerializer
from api.tasks import attach_ai_insights, load_data_safely, run_ml_engine, run_pipeline


User = get_user_model()


def _test_credential(label):
    return f"Zz{abs(hash((label, os.getpid())))}Aa!"


TEST_USER_PASSWORD = _test_credential("user")
TEST_NEW_PASSWORD = _test_credential("new")


class SerializerBranchCoverageTests(TestCase):
    def test_register_serializer_rejects_password_mismatch(self):
        serializer = RegisterSerializer(
            data={
                "username": "branch-user",
                "email": "branch@example.com",
                "password": TEST_USER_PASSWORD,
                "confirm_password": TEST_NEW_PASSWORD,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("confirm_password", serializer.errors)

    def test_register_serializer_meta_password_validator_handles_django_error(self):
        with patch(
            "api.serializers.validate_password",
            side_effect=DjangoValidationError(["weak password"]),
        ):
            with self.assertRaises(serializers.ValidationError):
                RegisterSerializer.Meta().validate_password(TEST_USER_PASSWORD)

    def test_register_serializer_meta_password_validator_returns_valid_value(self):
        with patch("api.serializers.validate_password") as mock_validate:
            self.assertEqual(
                RegisterSerializer.Meta().validate_password(TEST_USER_PASSWORD),
                TEST_USER_PASSWORD,
            )
            mock_validate.assert_called_once_with(TEST_USER_PASSWORD)

    def test_analysis_job_serializer_rejects_bad_csv_mime_type(self):
        uploaded_file = SimpleUploadedFile(
            "data.csv",
            b"col\n1\n",
            content_type="application/octet-stream",
        )

        serializer = AnalysisJobSerializer(data={"file": uploaded_file})

        self.assertFalse(serializer.is_valid())
        self.assertIn("file", serializer.errors)


class TaskBranchCoverageTests(SimpleTestCase):
    def test_load_data_safely_returns_general_read_error(self):
        with patch("api.tasks.pd.read_csv", side_effect=RuntimeError("reader exploded")):
            df, header_df, error = load_data_safely("broken.csv")

        self.assertIsNone(df)
        self.assertIsNone(header_df)
        self.assertIn("Could not read file", error)

    def test_load_data_safely_uses_latin1_fallback_after_unicode_error(self):
        df_check = pd.DataFrame({"amount": [1]})
        header_df = pd.DataFrame(columns=["amount"])
        latin_df = pd.DataFrame({"amount": [1, 2]})

        with patch(
            "api.tasks.pd.read_csv",
            side_effect=[df_check, header_df, UnicodeDecodeError("utf-8", b"x", 0, 1, "bad"), latin_df],
        ):
            df, headers, error = load_data_safely("latin.csv")

        self.assertIsNone(error)
        self.assertEqual(headers.columns.tolist(), ["amount"])
        self.assertEqual(df["amount"].tolist(), [1, 2])

    def test_load_data_safely_uses_last_resort_fallback_after_generic_error(self):
        df_check = pd.DataFrame({"amount": [1]})
        header_df = pd.DataFrame(columns=["amount"])
        fallback_df = pd.DataFrame({"amount": [3, 4]})

        with patch(
            "api.tasks.pd.read_csv",
            side_effect=[df_check, header_df, ValueError("bad parser"), fallback_df],
        ):
            df, headers, error = load_data_safely("fallback.csv")

        self.assertIsNone(error)
        self.assertEqual(headers.columns.tolist(), ["amount"])
        self.assertEqual(df["amount"].tolist(), [3, 4])

    def test_run_ml_engine_returns_empty_when_numeric_columns_are_all_null(self):
        numeric_df = pd.DataFrame({"a": [None, None, None], "b": [None, None, None]})

        result = run_ml_engine(numeric_df, {"univariate": {}})

        self.assertEqual(result["pca_data"], [])
        self.assertEqual(result["feature_influence"], {})

    @patch("api.tasks.get_llm_insights", return_value=None)
    def test_attach_ai_insights_uses_robust_quality_summary(self, _mock_llm):
        result = attach_ai_insights(
            {},
            {
                "metadata": {
                    "file_name": "robust.csv",
                    "health_score": 85,
                    "missing_values": {},
                },
                "outliers": {},
            },
            pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
        )

        self.assertIn("data quality is robust", result["ai_observations"]["summary"])
        self.assertTrue(
            any(
                suggestion.startswith("Non-Linear Mapping")
                for suggestion in result["ai_observations"]["feature_suggestions"]
            )
        )

    @patch("api.tasks.AnalysisJob.objects.get")
    @patch("api.tasks.load_data_safely", return_value=(None, None, "bad upload"))
    def test_run_pipeline_marks_job_failed_when_loader_returns_error(self, _mock_loader, mock_get):
        job = MagicMock()
        job.file.path = "bad.csv"
        mock_get.return_value = job

        run_pipeline("job-id")

        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.results, {"error": "bad upload"})
        self.assertGreaterEqual(job.save.call_count, 2)


class LLMBranchCoverageTests(SimpleTestCase):
    @patch("api.llm_utils.requests.post", side_effect=RuntimeError("network down"))
    def test_call_grok_returns_none_when_request_raises(self, mock_post):
        self.assertIsNone(llm_utils._call_grok(_test_credential("grok"), "prompt", max_retries=1))
        mock_post.assert_called_once()


class PasswordResetBranchCoverageTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reset-branches",
            email="reset-branches@example.com",
            password=TEST_USER_PASSWORD,
        )

    @patch("api.views.send_mail", side_effect=SMTPException("smtp down"))
    def test_password_reset_request_returns_503_for_smtp_exception(self, mock_send_mail):
        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("detail", response.data)
        mock_send_mail.assert_called_once()

    def test_password_reset_confirm_returns_validation_errors_for_weak_password(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {
                "uid": uid,
                "token": token,
                "new_password": str(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
