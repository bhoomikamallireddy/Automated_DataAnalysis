"""
Test settings for running tests with SQLite in-memory database
"""
from core import settings as base_settings

globals().update(
    {
        name: getattr(base_settings, name)
        for name in dir(base_settings)
        if name.isupper()
    }
)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
        'ATOMIC_REQUESTS': False,
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
