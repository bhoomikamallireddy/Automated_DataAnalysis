import os
from unittest.mock import MagicMock, patch

import pandas as pd
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase

from api.models import AnalysisJob
from api.serializers import AnalysisJobSerializer, RegisterSerializer
from api.tasks import run_ml_engine, run_pipeline
from api.views import AnalysisJobViewSet


User = get_user_model()


def _password(label):
    return f"Zz{abs(hash((label, os.getpid())))}Aa!"


class ModelAndSerializerCoverageTests(TestCase):
    def test_user_and_analysis_job_string_representations(self):
        user = User.objects.create_user(
            username="coverage-user",
            email="coverage-user@example.com",
            password=_password("user"),
        )
        job = AnalysisJob.objects.create(
            user=user,
            file_name="sales.csv",
            file=SimpleUploadedFile("sales.csv", b"a\n1\n", content_type="text/csv"),
            status="COMPLETED",
        )

        self.assertEqual(str(user), "coverage-user")
        self.assertEqual(str(job), "sales.csv - COMPLETED")

    def test_register_serializer_creates_user_and_hashes_password(self):
        raw_password = _password("register")
        serializer = RegisterSerializer(
            data={
                "username": "serializer-user",
                "email": "serializer@example.com",
                "password": raw_password,
                "confirm_password": raw_password,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertEqual(user.email, "serializer@example.com")
        self.assertNotEqual(user.password, raw_password)
        self.assertTrue(user.check_password(raw_password))

    def test_analysis_job_serializer_rejects_non_csv_extension(self):
        uploaded_file = SimpleUploadedFile(
            "data.txt",
            b"a\n1\n",
            content_type="text/plain",
        )

        serializer = AnalysisJobSerializer(data={"file": uploaded_file})

        self.assertFalse(serializer.is_valid())
        self.assertIn("Only CSV files are allowed.", str(serializer.errors["file"]))

    def test_analysis_job_serializer_rejects_file_over_size_limit(self):
        uploaded_file = SimpleUploadedFile(
            "large.csv",
            b"a\n1\n",
            content_type="text/csv",
        )
        uploaded_file.size = 200 * 1024 * 1024 + 1

        serializer = AnalysisJobSerializer(data={"file": uploaded_file})

        self.assertFalse(serializer.is_valid())
        self.assertIn("File too large", str(serializer.errors["file"]))


class AnalysisJobViewSetCoverageTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password=_password("owner"),
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password=_password("other"),
        )

    def test_get_queryset_returns_only_request_user_jobs(self):
        own_job = AnalysisJob.objects.create(
            user=self.user,
            file_name="own.csv",
            file=SimpleUploadedFile("own.csv", b"a\n1\n", content_type="text/csv"),
        )
        AnalysisJob.objects.create(
            user=self.other_user,
            file_name="other.csv",
            file=SimpleUploadedFile("other.csv", b"a\n2\n", content_type="text/csv"),
        )
        request = APIRequestFactory().get("/api/jobs/")
        request.user = self.user
        view = AnalysisJobViewSet()
        view.request = request

        self.assertEqual(list(view.get_queryset()), [own_job])

    @patch("api.views.async_task")
    def test_perform_create_sets_user_file_name_and_schedules_pipeline(self, mock_async_task):
        uploaded_file = SimpleUploadedFile("upload.csv", b"a\n1\n", content_type="text/csv")
        request = APIRequestFactory().post("/api/jobs/", {"file": uploaded_file}, format="multipart")
        request.user = self.user
        request.FILES["file"] = uploaded_file
        serializer = AnalysisJobSerializer(data={"file": uploaded_file})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        view = AnalysisJobViewSet()
        view.request = request

        with patch("api.views.transaction.on_commit", side_effect=lambda callback: callback()):
            view.perform_create(serializer)

        job = AnalysisJob.objects.get(user=self.user, file_name="upload.csv")
        mock_async_task.assert_called_once()
        self.assertEqual(mock_async_task.call_args.args[1], job.id)


class PasswordResetViewCoverageTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="reset-user",
            email="reset-user@example.com",
            password=_password("reset"),
        )

    @patch("api.views.send_mail")
    @override_settings(FRONTEND_URL="http://frontend.test", EMAIL_HOST_USER="noreply@example.com")
    def test_password_reset_request_sends_email_for_known_user(self, mock_send_mail):
        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": self.user.email},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "Password reset link sent.")
        mock_send_mail.assert_called_once()
        self.assertIn("http://frontend.test/password-reset-confirm/", mock_send_mail.call_args.args[1])

    def test_password_reset_request_returns_generic_success_for_unknown_email(self):
        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": "missing@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "If an account exists, a link was sent.")

    def test_password_reset_confirm_rejects_bad_uid(self):
        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": "not-a-uid", "token": "bad", "new_password": _password("new")},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Invalid request.")

    def test_password_reset_confirm_rejects_invalid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))

        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": uid, "token": "bad-token", "new_password": _password("new")},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Invalid or expired token.")

    def test_password_reset_confirm_updates_password_for_valid_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        new_password = _password("confirmed")

        response = self.client.post(
            "/api/auth/password-reset-confirm/",
            {"uid": uid, "token": token, "new_password": new_password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))


class TaskCoverageExpansionTests(TestCase):
    def test_run_ml_engine_uses_deterministic_samples(self):
        numeric_df = pd.DataFrame(
            {
                "a": list(range(1, 30)),
                "b": list(range(2, 60, 2)),
                "c": list(range(30, 1, -1)),
            }
        )
        eda_results = {
            "univariate": {
                column: {"stats": {"min": numeric_df[column].min()}}
                for column in numeric_df.columns
            }
        }

        first = run_ml_engine(numeric_df, eda_results)
        second = run_ml_engine(numeric_df, eda_results)

        self.assertEqual(first["distribution_analysis"], second["distribution_analysis"])
        self.assertEqual(first["bivariate_gallery"], second["bivariate_gallery"])

    @patch("api.tasks.AnalysisJob.objects.get")
    @patch("api.tasks.attach_ai_insights", side_effect=lambda ml, _eda, _numeric: ml)
    @patch("api.tasks.run_ml_engine", return_value={"feature_influence": {"a": 1.0}})
    @patch(
        "api.tasks.run_eda_engine",
        return_value=(
            {
                "metadata": {"file_name": "ok.csv"},
                "outliers": {},
                "univariate": {},
                "quality_metrics": {"dtype_breakdown": []},
            },
            pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
        ),
    )
    @patch("api.tasks._count_rows", return_value=2)
    @patch(
        "api.tasks.load_data_safely",
        return_value=(
            pd.DataFrame({"a": [1, 2], "b": [3, 4]}),
            pd.DataFrame(columns=["a", "b"]),
            None,
        ),
    )
    def test_run_pipeline_marks_job_completed_and_saves_results(
        self,
        _mock_loader,
        _mock_count_rows,
        _mock_eda,
        _mock_ml,
        _mock_ai,
        mock_get,
    ):
        job = MagicMock()
        job.file.path = os.path.join("uploads", "ok.csv")
        mock_get.return_value = job

        run_pipeline("job-id")

        self.assertEqual(job.status, "COMPLETED")
        self.assertEqual(job.results["metadata"]["file_name"], "ok.csv")
        self.assertIn("quality_metrics", job.results["ml_insights"])
        self.assertGreaterEqual(job.save.call_count, 2)

    @patch("api.tasks.AnalysisJob.objects.get")
    @patch("api.tasks.load_data_safely", side_effect=RuntimeError("unexpected"))
    def test_run_pipeline_marks_existing_job_failed_on_unexpected_error(self, _mock_loader, mock_get):
        job = MagicMock()
        job.file.path = "broken.csv"
        mock_get.return_value = job

        run_pipeline("job-id")

        self.assertEqual(job.status, "FAILED")
        self.assertEqual(job.results, {"error": "unexpected"})
