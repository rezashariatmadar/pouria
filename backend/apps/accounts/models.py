from django.db import models


class OtpCode(models.Model):
    """کد یک‌بارمصرف ورود — فقط هش کد ذخیره می‌شود."""

    phone_number = models.CharField(max_length=11, db_index=True, verbose_name="شماره موبایل")
    code_hash = models.CharField(max_length=64, verbose_name="هش کد")
    expires_at = models.DateTimeField(verbose_name="زمان انقضا")
    attempts = models.PositiveIntegerField(default=0, verbose_name="تعداد تلاش")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "کد یک‌بارمصرف"
        verbose_name_plural = "کدهای یک‌بارمصرف"
        ordering = ["-created_at"]

    def __str__(self):
        return self.phone_number
