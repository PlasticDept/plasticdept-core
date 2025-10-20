import os
import base64
import json
import logging
import requests
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Get GitHub configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")  # format: username/repo
GITHUB_FILE_PATH = os.getenv("GITHUB_FILE_PATH", "occupancy.json")  # default path
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")  # default branch
GITHUB_MASTER_LOC_FILE = os.getenv("GITHUB_MASTER_LOC_FILE", "master_locations.json")

# Validate required configuration
if not GITHUB_TOKEN or not GITHUB_REPO:
    logger.error("Missing required environment variables: GITHUB_TOKEN or GITHUB_REPO")
    raise ValueError("GitHub configuration is incomplete. Please check your .env file.")

app = FastAPI(
    title="Occupancy Data API",
    description="API for uploading and managing occupancy data",
    version="1.0.0"
)

# Allow CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UploadResponse(BaseModel):
    status: str
    url: str
    rows_processed: int

@app.get("/health")
async def health_check():
    """Health check endpoint to verify the API is running"""
    return {"status": "healthy", "github_repo": GITHUB_REPO}

@app.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload an Excel file with occupancy data, convert to JSON, and store in GitHub repository.
    The Excel file should contain occupancy data with appropriate column headers.
    """
    try:
        logger.info(f"Received file upload: {file.filename}")

        # 1. Read Excel into DataFrame
        if file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file.file)
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(file.file)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Unsupported file format. Please upload .xlsx, .xls, or .csv"
            )

        # Check if DataFrame is empty
        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file contains no data"
            )

        # 2. Replace NaN values with None (which will be converted to null in JSON)
        df = df.replace({np.nan: None})
            
        # 3. Convert to JSON with proper formatting
        json_data = df.to_dict(orient="records")
        class NpEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, np.integer):
                    return int(obj)
                if isinstance(obj, np.floating):
                    return float(obj)
                if isinstance(obj, np.ndarray):
                    return obj.tolist()
                if pd.isna(obj):
                    return None
                return super(NpEncoder, self).default(obj)
        json_str = json.dumps(json_data, cls=NpEncoder, indent=2)

        # 4. Check if file already exists on GitHub
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_FILE_PATH}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        }

        logger.info(f"Checking if file exists at {url}")
        resp = requests.get(url, headers=headers)
        sha = None
        if resp.status_code == 200:
            sha = resp.json().get("sha")
            logger.info(f"File exists, retrieved SHA: {sha}")
        elif resp.status_code == 404:
            logger.info("File does not exist yet, will create new file")
        else:
            logger.error(f"GitHub API error: {resp.status_code} - {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GitHub API error: {resp.json().get('message', 'Unknown error')}"
            )

        # 5. Prepare payload for GitHub commit
        content_encoded = base64.b64encode(json_str.encode()).decode()
        payload = {
            "message": f"Update occupancy data via API - {file.filename}",
            "content": content_encoded,
            "branch": GITHUB_BRANCH,
        }
        if sha:
            payload["sha"] = sha

        # 6. Commit to GitHub
        logger.info(f"Uploading data to GitHub: {len(json_data)} records")
        put_resp = requests.put(url, headers=headers, json=payload)

        if put_resp.status_code not in [200, 201]:
            logger.error(f"GitHub commit failed: {put_resp.status_code} - {put_resp.text}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=put_resp.json()
            )

        raw_url = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{GITHUB_FILE_PATH}"
        logger.info(f"Upload successful, data available at: {raw_url}")

        return UploadResponse(
            status="success",
            url=raw_url,
            rows_processed=len(json_data)
        )

    except pd.errors.EmptyDataError:
        logger.error("Empty data file uploaded")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="The uploaded file contains no data"
        )
    except pd.errors.ParserError:
        logger.error("File parsing error")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Unable to parse the file. Please check the file format."
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error processing file: {str(e)}"
        )

@app.post("/upload-master-locations", response_model=UploadResponse)
async def upload_master_locations(file: UploadFile = File(...)):
    """
    Upload an Excel/CSV file with master location data, convert to JSON, and store in GitHub repository.
    The file should contain a column named 'Location'.
    """
    try:
        logger.info(f"Received master location upload: {file.filename}")

        # 1. Read file to DataFrame
        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file.file)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Unsupported file format. Please upload .xlsx, .xls, or .csv"
            )

        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file contains no data"
            )

        # 2. Validate column
        if "Location" not in df.columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must have a 'Location' column"
            )

        # 3. Build master locations array
        master_locations = [{"locationCode": str(loc)} for loc in df["Location"].dropna().astype(str)]
        json_str = json.dumps(master_locations, indent=2)

        # 4. Check if master_locations.json exists on GitHub
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_MASTER_LOC_FILE}"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        }
        resp = requests.get(url, headers=headers)
        sha = None
        if resp.status_code == 200:
            sha = resp.json().get("sha")
            logger.info(f"Master location file exists, SHA: {sha}")
        elif resp.status_code == 404:
            logger.info("Master location file will be created")
        else:
            logger.error(f"GitHub API error: {resp.status_code} - {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GitHub API error: {resp.json().get('message', 'Unknown error')}"
            )

        # 5. Prepare payload for GitHub commit
        content_encoded = base64.b64encode(json_str.encode()).decode()
        payload = {
            "message": f"Update master locations via API - {file.filename}",
            "content": content_encoded,
            "branch": GITHUB_BRANCH,
        }
        if sha:
            payload["sha"] = sha

        # 6. Commit to GitHub
        logger.info(f"Uploading master locations to GitHub: {len(master_locations)} records")
        put_resp = requests.put(url, headers=headers, json=payload)

        if put_resp.status_code not in [200, 201]:
            logger.error(f"GitHub commit failed: {put_resp.status_code} - {put_resp.text}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=put_resp.json()
            )

        raw_url = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{GITHUB_MASTER_LOC_FILE}"
        logger.info(f"Master locations upload successful at: {raw_url}")

        return UploadResponse(
            status="success",
            url=raw_url,
            rows_processed=len(master_locations)
        )

    except pd.errors.EmptyDataError:
        logger.error("Empty master location data file uploaded")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="The uploaded file contains no data"
        )
    except pd.errors.ParserError:
        logger.error("File parsing error")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Unable to parse the file. Please check the file format."
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error processing master location file: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    # Start the FastAPI application with uvicorn server
    uvicorn.run(app, host="0.0.0.0", port=8000)
