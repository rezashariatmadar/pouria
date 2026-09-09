from django.utils import timezone
from ninja import NinjaAPI

from apps.accounts.api import router as auth_router
from apps.catalog.admin_api import router as admin_products_router
from apps.catalog.api import router as catalog_router
from apps.orders.admin_api import router as admin_orders_router
from apps.orders.checkout_api import router as checkout_router

api = NinjaAPI(title="YadakPro API", version="1.0.0")

api.add_router("/", catalog_router)
api.add_router("/", admin_products_router)
api.add_router("/", admin_orders_router)
api.add_router("/", auth_router)
api.add_router("/", checkout_router)  # M4: payments + stock holds


@api.get("/health", tags=["system"])
def health(request):
    return {"status": "ok", "time": timezone.now().isoformat()}
