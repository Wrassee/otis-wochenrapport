"""
FastAPI server for OTIS Wochenrapport Excel generation.
Provides endpoints for generating Excel files and sending emails.
"""

import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from dotenv import load_dotenv

from src.excel_generator import generate_excel

load_dotenv()

app = FastAPI(
    title="OTIS Wochenrapport API",
    description="Backend service for generating OTIS weekly report Excel files",
    version="1.0.0",
)

# CORS configuration — allow the PWA to access the API
# In development: localhost:5173 (Vite)
# In production: FRONTEND_URL env var (set in Render dashboard or render.yaml)
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://otis-wochenrapport.vercel.app",
        "https://otis-wochenrapport.pages.dev",
        frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================== Data Models =====================

class TimeEntryInput(BaseModel):
    date: str  # YYYY-MM-DD
    start_time: float  # decimal hours
    duration: float  # decimal hours
    anlagenummer: Optional[str] = None
    project_id: Optional[str] = None
    address: Optional[str] = None
    activity_code: Optional[str] = None
    is_lunch: bool = False
    zone: Optional[int] = None


class ExpenseInput(BaseModel):
    date: str  # YYYY-MM-DD
    expense_type: str  # entschaedigung_10h, hotel, transport, pikettdienst, entschaedigung_pikett, material, privatfahrzeug
    value: float = 1


class GenerateRequest(BaseModel):
    year: int
    week_number: int
    user_id: Optional[str] = None
    personnel_number: str = ""
    full_name: str = ""
    entries: list[TimeEntryInput] = []
    expenses: list[ExpenseInput] = []
    supervisor_email: Optional[str] = None


class SendEmailRequest(GenerateRequest):
    supervisor_email: str = ""


# ===================== Health Check =====================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "OTIS Wochenrapport API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
    }


# ===================== Excel Generation =====================

@app.post("/generate-excel")
async def generate_excel_endpoint(request: GenerateRequest):
    """
    Generate a filled OTIS Wochenrapport Excel file.
    
    Returns the .xlsx file as a download.
    """
    try:
        # Convert entries to dict format expected by generator
        entries_dict = [
            {
                "date": e.date,
                "start_time": e.start_time,
                "duration": e.duration,
                "anlagenummer": e.anlagenummer or "",
                "project_id": e.project_id or "",
                "address": e.address or "",
                "activity_code": e.activity_code or "",
                "is_lunch": e.is_lunch,
                "zone": e.zone or 0,
            }
            for e in request.entries
        ]

        # If no entries provided, try to fetch from Supabase
        if not entries_dict and request.user_id:
            entries_dict = await _fetch_entries_from_supabase(
                request.user_id, request.year, request.week_number
            )

        # If still no entries, try to fetch profile from Supabase
        if not request.personnel_number and request.user_id:
            profile = await _fetch_profile_from_supabase(request.user_id)
            if profile:
                request.personnel_number = profile.get("personnel_number", "")
                request.full_name = profile.get("full_name", "")

        # Convert expenses to dict format
        expenses_dict = [
            {
                "date": e.date,
                "expense_type": e.expense_type,
                "value": e.value,
            }
            for e in request.expenses
        ]

        content = generate_excel(
            year=request.year,
            week_number=request.week_number,
            personnel_number=request.personnel_number,
            full_name=request.full_name,
            entries=entries_dict,
            expenses=expenses_dict if expenses_dict else None,
        )

        filename = f"Wochenrapport_KW{request.week_number}_{request.year}.xlsx"

        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {str(e)}")


# ===================== Email Sending =====================

@app.post("/send-email")
async def send_email_endpoint(request: SendEmailRequest):
    """
    Generate Excel and send it via email to the supervisor.
    Note: Requires SMTP configuration in production.
    """
    try:
        # First generate the Excel
        entries_dict = [
            {
                "date": e.date,
                "start_time": e.start_time,
                "duration": e.duration,
                "anlagenummer": e.anlagenummer or "",
                "project_id": e.project_id or "",
                "address": e.address or "",
                "activity_code": e.activity_code or "",
                "is_lunch": e.is_lunch,
                "zone": e.zone or 0,
            }
            for e in request.entries
        ]

        content = generate_excel(
            year=request.year,
            week_number=request.week_number,
            personnel_number=request.personnel_number,
            full_name=request.full_name,
            entries=entries_dict,
        )

        # In production, send email via SMTP
        # For now, return success with info
        return {
            "status": "success",
            "message": f"Excel für KW{request.week_number} generiert",
            "supervisor_email": request.supervisor_email,
            "note": "E-Mail Versand konfigurieren in production (SMTP erforderlich)",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email sending failed: {str(e)}")


# ===================== Supabase Helpers =====================

async def _fetch_entries_from_supabase(user_id: str, year: int, week_number: int) -> list[dict]:
    """
    Fetch time entries from Supabase for a given user and week.
    Falls back gracefully if Supabase is not configured.
    """
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")

        if not supabase_url or not supabase_key:
            return []

        client = create_client(supabase_url, supabase_key)

        # Calculate week date range
        jan4 = datetime(year, 1, 4)
        day_offset = jan4.weekday()
        monday = jan4 - timedelta(days=day_offset) + timedelta(weeks=week_number - 1)
        friday = monday + timedelta(days=4)

        start_date = monday.strftime("%Y-%m-%d")
        end_date = friday.strftime("%Y-%m-%d")

        # Fetch entries
        response = client.table("time_entries").select(
            "*, locations!inner(anlagenummer, project_id, full_address, zone)"
        ).eq("user_id", user_id).gte("date", start_date).lte("date", end_date).order("date").order("start_time").execute()

        entries = []
        for item in response.data or []:
            entries.append({
                "date": item.get("date", ""),
                "start_time": item.get("start_time", 0),
                "duration": item.get("duration", 0),
                "anlagenummer": item.get("locations", {}).get("anlagenummer", ""),
                "project_id": item.get("locations", {}).get("project_id", ""),
                "address": item.get("locations", {}).get("full_address", ""),
                "activity_code": item.get("activity_code", ""),
                "is_lunch": item.get("is_lunch", False),
                "zone": item.get("locations", {}).get("zone", 0),
            })

        return entries

    except Exception as e:
        print(f"Failed to fetch from Supabase: {e}")
        return []


async def _fetch_profile_from_supabase(user_id: str) -> Optional[dict]:
    """Fetch user profile from Supabase."""
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")

        if not supabase_url or not supabase_key:
            return None

        client = create_client(supabase_url, supabase_key)
        response = client.table("profiles").select("*").eq("id", user_id).single().execute()
        return response.data

    except Exception as e:
        print(f"Failed to fetch profile: {e}")
        return None


# ===================== Main Entry Point =====================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
