from django.db import models

class GeneratedPost(models.Model):
    idea = models.TextField()
    platform = models.CharField(max_length=50)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.platform}: {self.idea[:30]}..."
