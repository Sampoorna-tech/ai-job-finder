from fastapi import FastAPI, Query
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import os
import httpx
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="India IT Job Finder")

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JSEARCH_KEY = os.getenv("JSEARCH_KEY")


class Job(BaseModel):
    title: str
    company: Optional[str]
    city: Optional[str]
    location: Optional[str]
    exp_min: Optional[int]
    exp_max: Optional[int]
    salary_min: Optional[int]
    salary_max: Optional[int]
    salary_currency: Optional[str]
    salary_est_min: Optional[int]
    salary_est_max: Optional[int]
    posted_at: Optional[datetime]
    source: str
    apply_url: Optional[str]


def estimate_salary_inr(
    title: str,
    city: Optional[str],
    exp_min: Optional[int],
    exp_max: Optional[int],
    salary_min: Optional[int],
    salary_max: Optional[int],
):
    """
    Very simple heuristic salary estimator in INR / year.

    - If salary is already present from source, we do NOT estimate.
    - Otherwise we guess range based on:
      • Title (junior / mid / senior / lead)
      • City tier (Tier 1 / 2 / 3)
      • Experience if provided
    """
    # if real salary present, no estimate
    if salary_min or salary_max:
        return None, None

    norm_title = title.lower()
    norm_city = (city or "").lower()

    # guess experience
    if exp_min is not None or exp_max is not None:
        yrs = exp_max or exp_min or 2
    else:
        # guess by title keywords
        if any(k in norm_title for k in ["intern", "trainee"]):
            yrs = 0
        elif any(k in norm_title for k in ["senior", "sr.", "lead", "architect", "principal"]):
            yrs = 7
        elif any(k in norm_title for k in ["manager", "head", "director"]):
            yrs = 10
        else:
            yrs = 3

    # city tier
    tier1_cities = {
        "mumbai", "bombay", "bengaluru", "bangalore", "hyderabad", "chennai",
        "pune", "gurugram", "gurgaon", "noida", "delhi", "new delhi"
    }
    tier2_cities = {"ahmedabad", "jaipur", "indore", "surat", "kochi", "coimbatore", "bhopal"}

    if any(c in norm_city for c in tier1_cities):
        tier = 1
    elif any(c in norm_city for c in tier2_cities):
        tier = 2
    else:
        tier = 3

    # job level
    if yrs <= 2:
        level = "junior"
    elif yrs <= 6:
        level = "mid"
    elif yrs <= 12:
        level = "senior"
    else:
        level = "lead"

    # base ranges (LPA) for tier1 – tweak to your liking
    if level == "junior":
        base_min, base_max = 4, 8      # 4–8 LPA
    elif level == "mid":
        base_min, base_max = 8, 18     # 8–18 LPA
    elif level == "senior":
        base_min, base_max = 18, 35    # 18–35 LPA
    else:
        base_min, base_max = 30, 55    # 30–55 LPA

    # adjust for tier2/3
    if tier == 2:
        base_min *= 0.8
        base_max *= 0.8
    elif tier == 3:
        base_min *= 0.65
        base_max *= 0.65

    # convert LPA → INR/year
    return int(base_min * 100000), int(base_max * 100000)


@app.get("/jobs", response_model=List[Job])
async def get_jobs(
    role: str = Query(..., min_length=2, description="e.g. 'Java Developer'"),
    city: Optional[str] = Query(None, description="e.g. 'Pune'"),
    exp_min: Optional[int] = Query(None, description="min years experience"),
    exp_max: Optional[int] = Query(None, description="max years experience"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
):
    """
    Fetch IT jobs for India using JSearch (RapidAPI)
    and return normalized jobs with salary estimations where missing.
    """
    if not JSEARCH_KEY:
        raise RuntimeError("Set JSEARCH_KEY env var with your RapidAPI key for jsearch.")

    # Build the search query
    query = f"{role} in India"
    if city:
        query = f"{role} in {city}, India"

    params = {
        "query": query,
        "page": page,
        "num_pages": 3,   # keep this 1 for now to reduce API usage
    }

    headers = {
        "X-RapidAPI-Key": JSEARCH_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.get(
                "https://jsearch.p.rapidapi.com/search",
                params=params,
                headers=headers,
            )

            # If JSearch says "Too Many Requests"
            if resp.status_code == 429:
                print("JSearch rate limit hit (429). Returning empty list.")
                return []  # empty jobs so frontend shows "no jobs" instead of breaking

            resp.raise_for_status()

        except httpx.HTTPError as exc:
            print(f"Error while calling JSearch: {exc}")
            return []  # again, return empty list on error

    data = resp.json().get("data", [])

    jobs: list[Job] = []
    for item in data[:size]:
        title = item.get("job_title") or "Unknown"
        company = item.get("employer_name")
        job_city = item.get("job_city") or item.get("job_location")

        salary_min = item.get("job_min_salary")
        salary_max = item.get("job_max_salary")
        currency = item.get("job_salary_currency") or "INR"

        est_min, est_max = estimate_salary_inr(
            title=title,
            city=job_city,
            exp_min=exp_min,
            exp_max=exp_max,
            salary_min=salary_min,
            salary_max=salary_max,
        )

        posted_str = item.get("job_posted_at") or item.get("job_offer_expiration_datetime_utc")
        posted_at = None
        if posted_str:
            try:
                posted_at = datetime.fromisoformat(posted_str.replace("Z", "+00:00"))
            except Exception:
                posted_at = None

        jobs.append(Job(
            title=title,
            company=company,
            city=job_city.split(",")[0].strip() if job_city else None,
            location=job_city,
            exp_min=exp_min,
            exp_max=exp_max,
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=currency,
            salary_est_min=est_min,
            salary_est_max=est_max,
            posted_at=posted_at,
            source="jsearch",
            apply_url=item.get("job_apply_link") or item.get("job_google_link")
        ))

    return jobs


