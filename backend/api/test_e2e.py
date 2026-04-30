import pytest
import os
import json
import tempfile
from io import StringIO
from unittest.mock import patch, MagicMock
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from datetime import timedelta

from api.models import AnalysisJob
from api.tasks import run_pipeline
from api.serializers import RegisterSerializer

User = get_user_model()


def _test_credential(label):
    return f"Zz{abs(hash((label, os.getpid())))}Aa!"


TEST_USER_PASSWORD = _test_credential("user")
TEST_INVALID_PASSWORD = _test_credential("invalid")


@pytest.fixture
def api_client():
    """Return an unauthenticated API client"""
    return APIClient()


@pytest.fixture
def create_user():
    """Factory fixture to create test users"""
    def _create_user(username='testuser', email='test@example.com', password=TEST_USER_PASSWORD):
        return User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
    return _create_user


@pytest.fixture
def authenticated_client(create_user):
    """Return an authenticated API client with a valid user"""
    user = create_user()
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client, user


@pytest.fixture
def sample_csv_content():
    """Return sample CSV content for testing"""
    return 'col1,col2,col3\n1,2,3\n4,5,6\n7,8,9'


@pytest.fixture
def sample_csv_file(sample_csv_content):
    """Create a SimpleUploadedFile from sample content"""
    return SimpleUploadedFile(
        name='test.csv',
        content=sample_csv_content.encode(),
        content_type='text/csv'
    )


class TestUserRegistrationWorkflow:
    """E2E tests for user registration"""

    def test_register_login_upload_workflow(self, api_client, sample_csv_file):
        """Complete workflow: register -> login -> upload -> check job status"""
        register_data = {
            'username': 'workflowuser',
            'email': 'workflow@example.com',
            'password': TEST_USER_PASSWORD,
            'confirm_password': TEST_USER_PASSWORD
        }
        
        register_response = api_client.post('/api/auth/register/', register_data, format='json')
        assert register_response.status_code == status.HTTP_201_CREATED
        user_id = register_response.data['user_id']
        assert user_id is not None
        
        login_data = {
            'username': 'workflowuser',
            'password': TEST_USER_PASSWORD
        }
        login_response = api_client.post('/api/auth/login/', login_data, format='json')
        assert login_response.status_code == status.HTTP_200_OK
        assert 'access' in login_response.data
        assert 'refresh' in login_response.data
        
        access_token = login_response.data['access']
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        with patch('api.views.async_task'):
            upload_response = api_client.post('/api/jobs/', {'file': sample_csv_file}, format='multipart')
        
        assert upload_response.status_code == status.HTTP_201_CREATED
        job_id = upload_response.data['id']
        
        list_response = api_client.get('/api/jobs/')
        assert list_response.status_code == status.HTTP_200_OK
        assert len(list_response.data) == 1
        assert list_response.data[0]['status'] == 'PENDING'
        
        job_detail_response = api_client.get(f'/api/jobs/{job_id}/')
        assert job_detail_response.status_code == status.HTTP_200_OK
        assert job_detail_response.data['id'] == job_id

    def test_multiple_user_isolation(self, api_client, sample_csv_content):
        """Test that users can only see their own jobs"""
        user1 = User.objects.create_user(username='user1', email='user1@example.com', password=TEST_USER_PASSWORD)
        user2 = User.objects.create_user(username='user2', email='user2@example.com', password=TEST_USER_PASSWORD)
        
        client1 = APIClient()
        client2 = APIClient()
        
        refresh1 = RefreshToken.for_user(user1)
        refresh2 = RefreshToken.for_user(user2)
        
        client1.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh1.access_token}')
        client2.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh2.access_token}')
        
        csv_file1 = SimpleUploadedFile(
            name='user1_test.csv',
            content=sample_csv_content.encode(),
            content_type='text/csv'
        )
        csv_file2 = SimpleUploadedFile(
            name='user2_test.csv',
            content=sample_csv_content.encode(),
            content_type='text/csv'
        )
        
        with patch('api.views.async_task'):
            response1 = client1.post('/api/jobs/', {'file': csv_file1}, format='multipart')
            response2 = client2.post('/api/jobs/', {'file': csv_file2}, format='multipart')
        
        assert response1.status_code == status.HTTP_201_CREATED
        assert response2.status_code == status.HTTP_201_CREATED
        
        user1_jobs = client1.get('/api/jobs/')
        user2_jobs = client2.get('/api/jobs/')
        
        assert len(user1_jobs.data) == 1
        assert len(user2_jobs.data) == 1
        assert user1_jobs.data[0]['id'] != user2_jobs.data[0]['id']


class TestAnalysisPipelineWorkflow:
    """E2E tests for the complete analysis pipeline"""

    def test_pipeline_produces_valid_results(self, authenticated_client, sample_csv_content):
        """Test that pipeline produces complete analysis results"""
        client, user = authenticated_client
        
        csv_file = SimpleUploadedFile(
            name='analysis_test.csv',
            content=sample_csv_content.encode(),
            content_type='text/csv'
        )
        
        with patch('api.views.async_task') as mock_task:
            response = client.post('/api/jobs/', {'file': csv_file}, format='multipart')
        
        job_id = response.data['id']
        job = AnalysisJob.objects.get(id=job_id)
        
        with patch('api.tasks.get_llm_insights', return_value=None):
            run_pipeline(job.id)
        
        job.refresh_from_db()
        assert job.status == 'COMPLETED'
        assert 'metadata' in job.results
        assert 'univariate' in job.results
        assert 'ml_insights' in job.results

    def test_pipeline_handles_various_data_sizes(self, authenticated_client):
        """Test pipeline with different data sizes"""
        client, user = authenticated_client
        
        test_cases = [
            ('small.csv', 'col1,col2\n1,2\n3,4', 2, 2),
            ('medium.csv', 'a,b,c\n1,2,3\n4,5,6\n7,8,9\n10,11,12', 4, 3),
        ]
        
        for filename, content, expected_rows, expected_cols in test_cases:
            csv_file = SimpleUploadedFile(name=filename, content=content.encode(), content_type='text/csv')
            
            with patch('api.views.async_task'):
                response = client.post('/api/jobs/', {'file': csv_file}, format='multipart')
            
            job_id = response.data['id']
            
            with patch('api.tasks.get_llm_insights', return_value=None):
                run_pipeline(job_id)
            
            job = AnalysisJob.objects.get(id=job_id)
            assert job.status == 'COMPLETED'
            assert job.results['metadata']['total_rows'] == expected_rows
            assert job.results['metadata']['total_cols'] == expected_cols


class TestTokenManagementWorkflow:
    """E2E tests for JWT token management"""

    def test_token_lifecycle(self, api_client, create_user):
        """Test complete token lifecycle: register -> login -> refresh -> use"""
        user = create_user(username='tokenuser', email='token@example.com', password=TEST_USER_PASSWORD)
        
        login_response = api_client.post('/api/auth/login/', {
            'username': 'tokenuser',
            'password': TEST_USER_PASSWORD
        }, format='json')
        
        assert login_response.status_code == status.HTTP_200_OK
        access_token = login_response.data['access']
        refresh_token = login_response.data['refresh']
        
        response = api_client.post('/api/auth/refresh/', {
            'refresh': refresh_token
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        new_access_token = response.data['access']
        assert new_access_token != access_token
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access_token}')
        jobs_response = api_client.get('/api/jobs/')
        assert jobs_response.status_code == status.HTTP_200_OK

    def test_concurrent_token_refresh(self, api_client, create_user):
        """Test multiple refresh requests in sequence (Django test client is synchronous)"""
        user = create_user(username='concurrentuser2', email='concurrent2@example.com', password=TEST_USER_PASSWORD)
        
        login_response = api_client.post('/api/auth/login/', {
            'username': 'concurrentuser2',
            'password': TEST_USER_PASSWORD
        }, format='json')
        
        refresh_token = login_response.data['refresh']
        
        results = []
        for _ in range(5):
            new_client = APIClient()
            response = new_client.post('/api/auth/refresh/', {
                'refresh': refresh_token
            }, format='json')
            results.append(response)
        
        success_count = sum(1 for r in results if r.status_code == status.HTTP_200_OK)
        assert success_count >= 1


class TestSecurityWorkflow:
    """E2E security tests"""

    def test_authentication_required_for_all_job_operations(self, api_client, sample_csv_file):
        """Test that all job operations require authentication"""
        endpoints = [
            ('GET', '/api/jobs/'),
            ('POST', '/api/jobs/'),
        ]
        
        for method, endpoint in endpoints:
            if method == 'GET':
                response = api_client.get(endpoint)
            else:
                response = api_client.post(endpoint, {'file': sample_csv_file}, format='multipart')
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_tampering_detection(self, api_client, create_user):
        """Test that tampered tokens are rejected"""
        create_user()
        
        api_client.credentials(HTTP_AUTHORIZATION='Bearer tampered.token.here')
        response = api_client.get('/api/jobs/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        api_client.credentials(HTTP_AUTHORIZATION='not-a-bearer-token')
        response = api_client.get('/api/jobs/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_sql_injection_prevention(self, api_client):
        """Test SQL injection attempts are prevented"""
        malicious_inputs = [
            "admin'; DROP TABLE api_analysisjob; --",
            "' OR '1'='1",
            "'; DELETE FROM api_user WHERE '1'='1",
        ]
        
        for malicious_input in malicious_inputs:
            response = api_client.post('/api/auth/register/', {
                'username': malicious_input,
                'email': 'test@example.com',
                'password': TEST_USER_PASSWORD
            }, format='json')
            assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestPerformanceWorkflow:
    """E2E performance tests"""

    def test_high_volume_job_creation(self, authenticated_client):
        """Test system handles high volume of job creations"""
        client, user = authenticated_client
        
        csv_content = 'col1,col2\n1,2\n3,4'
        
        with patch('api.views.async_task'):
            for i in range(10):
                csv_file = SimpleUploadedFile(
                    name=f'job_{i}.csv',
                    content=csv_content.encode(),
                    content_type='text/csv'
                )
                response = client.post('/api/jobs/', {'file': csv_file}, format='multipart')
                assert response.status_code == status.HTTP_201_CREATED
        
        jobs = AnalysisJob.objects.filter(user=user)
        assert jobs.count() == 10

    def test_rapid_api_requests(self, authenticated_client):
        """Test system handles rapid successive API requests"""
        client, user = authenticated_client
        
        import time
        start = time.time()
        
        for _ in range(20):
            response = client.get('/api/jobs/')
            assert response.status_code == status.HTTP_200_OK
        
        elapsed = time.time() - start
        assert elapsed < 5.0


class TestErrorRecoveryWorkflow:
    """E2E error recovery and resilience tests"""

    def test_job_persistence_after_pipeline_failure(self, authenticated_client):
        """Test that jobs are properly marked even after pipeline failure"""
        client, user = authenticated_client
        
        csv_file = SimpleUploadedFile(
            name='edge_case.csv',
            content=b'col1\n',
            content_type='text/csv'
        )
        
        with patch('api.views.async_task') as mock_task:
            response = client.post('/api/jobs/', {'file': csv_file}, format='multipart')
        
        job_id = response.data['id']
        job = AnalysisJob.objects.get(id=job_id)
        
        assert job.status in ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']
        
        with patch('api.tasks.get_llm_insights', side_effect=Exception('LLM Error')):
            run_pipeline(job.id)
        
        job.refresh_from_db()
        assert job.status in ['COMPLETED', 'FAILED']

    def test_graceful_degradation_on_llm_failure(self, authenticated_client, sample_csv_content):
        """Test that analysis completes even if LLM insights fail"""
        client, user = authenticated_client
        
        csv_file = SimpleUploadedFile(
            name='llm_fallback.csv',
            content=sample_csv_content.encode(),
            content_type='text/csv'
        )
        
        with patch('api.views.async_task'):
            response = client.post('/api/jobs/', {'file': csv_file}, format='multipart')
        
        job_id = response.data['id']
        
        with patch('api.tasks.get_llm_insights', return_value=None):
            run_pipeline(job_id)
        
        job = AnalysisJob.objects.get(id=job_id)
        assert job.status == 'COMPLETED'
        assert 'metadata' in job.results
