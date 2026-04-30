from django.apps import apps
from django.contrib import admin
from django.test import SimpleTestCase, TestCase
from django.urls import resolve, reverse

from api.admin import AnalysisJobAdmin
from api.apps import ApiConfig
from api.models import AnalysisJob, User
from api.views import (
    AnalysisJobViewSet,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)


class ApiAppConfigTests(SimpleTestCase):
    def test_api_app_config(self):
        config = apps.get_app_config("api")

        self.assertIsInstance(config, ApiConfig)
        self.assertEqual(config.name, "api")
        self.assertEqual(config.default_auto_field, "django.db.models.BigAutoField")


class AdminRegistrationTests(TestCase):
    def test_custom_user_and_analysis_job_are_registered(self):
        self.assertIn(User, admin.site._registry)
        self.assertIn(AnalysisJob, admin.site._registry)
        self.assertIsInstance(admin.site._registry[AnalysisJob], AnalysisJobAdmin)

    def test_analysis_job_admin_configuration(self):
        model_admin = admin.site._registry[AnalysisJob]

        self.assertEqual(
            model_admin.list_display,
            ("id", "user", "file_name", "status", "created_at"),
        )
        self.assertEqual(model_admin.list_filter, ("status",))
        self.assertEqual(model_admin.search_fields, ("file_name", "user__username"))


class UrlConfigurationTests(SimpleTestCase):
    def test_api_auth_urls_resolve_to_expected_views(self):
        url_expectations = {
            "register": RegisterView,
            "password_reset_request": PasswordResetRequestView,
            "password_reset_confirm": PasswordResetConfirmView,
        }

        for name, expected_view in url_expectations.items():
            with self.subTest(name=name):
                match = resolve(reverse(name))
                self.assertEqual(match.func.view_class, expected_view)

    def test_analysis_job_routes_resolve_to_viewset(self):
        list_match = resolve(reverse("analysisjob-list"))
        detail_match = resolve(
            reverse("analysisjob-detail", kwargs={"pk": "00000000-0000-0000-0000-000000000000"})
        )

        self.assertEqual(list_match.func.cls, AnalysisJobViewSet)
        self.assertEqual(detail_match.func.cls, AnalysisJobViewSet)

    def test_core_routes_include_admin_and_api(self):
        admin_match = resolve("/admin/")
        api_match = resolve("/api/")

        self.assertEqual(admin_match.app_name, "admin")
        self.assertEqual(api_match.url_name, "api-root")
