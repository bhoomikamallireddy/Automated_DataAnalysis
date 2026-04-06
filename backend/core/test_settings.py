"""
Test settings for running tests with SQLite in-memory database
"""
from core.settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

DEBUG = False

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}
