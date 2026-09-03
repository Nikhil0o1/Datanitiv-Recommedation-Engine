from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.portfolio_analysis import analyze_portfolio, get_cached_snapshot

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/analysis")
async def portfolio_analysis(session: AsyncSession = Depends(get_db)):
    snap = get_cached_snapshot()
    if not snap:
        snap = await analyze_portfolio(session)
    return {
        "analyzed_at": snap.analyzed_at,
        "plan_count": snap.plan_count,
        "decision_count": snap.decision_count,
        "autopilot_count": snap.autopilot_count,
        "quiet_count": snap.quiet_count,
        "recommendations": [
            {
                "cap_id": r.cap_id,
                "plan_name": r.plan_name,
                "program": r.program,
                "bucket": r.bucket,
                "why": r.why,
                "suggested_actions": r.suggested_actions,
            }
            for r in snap.recommendations
        ],
    }


@router.post("/refresh")
async def refresh_analysis(session: AsyncSession = Depends(get_db)):
    snap = await analyze_portfolio(session)
    return {"status": "ok", "analyzed_at": snap.analyzed_at, "plan_count": snap.plan_count}


@router.get("/facets")
async def portfolio_facets(session: AsyncSession = Depends(get_db)):
    """Distinct region / vertical values for portfolio filter dropdowns."""
    from app.services.plan_repository import load_all_plans

    plans = await load_all_plans(session)
    regions = sorted(
        {
            (p.hierarchy.region_name or p.meta.get("region") or "").strip()
            for p in plans
        }
        - {""},
    )
    verticals = sorted(
        {
            (p.hierarchy.vertical_name or p.meta.get("vertical") or p.hierarchy.business_entity_name or "").strip()
            for p in plans
        }
        - {""},
    )
    return {"regions": regions, "verticals": verticals}
