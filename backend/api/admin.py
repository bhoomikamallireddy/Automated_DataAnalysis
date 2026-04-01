from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, AnalysisJob

# Register your models here.

# 1. Register the Custom User
admin.site.register(User, UserAdmin)

# 2. Register AnalysisJob so you can see the jobs too!
@admin.register(AnalysisJob)
class AnalysisJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'file_name', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('file_name', 'user__username')
