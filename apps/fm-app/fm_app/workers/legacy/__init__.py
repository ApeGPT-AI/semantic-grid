"""Legacy flows - simple, production-ready flows for basic use cases."""

from fm_app.workers.legacy.data_only_flow import data_only_flow
from fm_app.workers.legacy.multistep_flow import multistep_flow
from fm_app.workers.legacy.simple_flow import simple_flow

__all__ = ["data_only_flow", "multistep_flow", "simple_flow"]
