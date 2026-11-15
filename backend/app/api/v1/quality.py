from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from pydantic import BaseModel
from backend.app.digital_twins.quality import quality_twin
from backend.app.ml.resnet import resnet_classifier
import shutil
import os

router = APIRouter(prefix="/quality", tags=["Quality"])

class InspectionRequest(BaseModel):
    batch_id: str
    image_id: str
    defect_present: bool = False
    defect_type: str = "none"
    severity: int = 0
    inspection_result: str = "PASS"

# ---------------------------------------------------------------------------
# Lazy singleton for QualityTwin ResNet service
# ---------------------------------------------------------------------------
_quality_twin_svc = None

def get_quality_twin_service():
    global _quality_twin_svc
    if _quality_twin_svc is None:
        try:
            from backend.src.twins.quality_twin import QualityTwin
            _quality_twin_svc = QualityTwin()
        except Exception as e:
            # Fallback: return None so caller can handle gracefully
            import logging
            logging.getLogger(__name__).warning(f"QualityTwin service unavailable: {e}")
            _quality_twin_svc = None
    return _quality_twin_svc


@router.get("/latest")
async def get_latest_quality():
    return quality_twin.get_state()

@router.post("/inspect")
async def inspect_quality(request: InspectionRequest):
    metadata = request.model_dump()
    prediction = resnet_classifier.classify_image(metadata)
    state = await quality_twin.process_event({**metadata, **prediction})
    return {"prediction": prediction, "state": state}


@router.post("/image-inspect")
async def image_inspect_casting(
    background_tasks: BackgroundTasks,
    batch_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Accept a raw casting image (JPEG/PNG) and run ResNet-50 visual QC inference.

    - **batch_id**: Unique identifier for the production batch being inspected.
    - **file**: The casting image file (JPEG or PNG, any resolution – resized internally to 224×224).

    Returns defect classification, confidence score, defect type, and updated twin state.
    """
    # --- Validate file type ---
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Upload a JPEG or PNG image."
        )

    # --- Save to temp directory ---
    os.makedirs("temp_images", exist_ok=True)
    safe_filename = f"{batch_id}_{file.filename}".replace(" ", "_")
    file_location = os.path.join("temp_images", safe_filename)

    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # --- Run ResNet-50 inference via QualityTwin service ---
    svc = get_quality_twin_service()

    try:
        if svc is None:
            raise HTTPException(
                status_code=503,
                detail="ResNet quality inspection is unavailable because its model failed to load.",
            )
        result = svc.process_inspection_image(file_location, batch_id)
    finally:
        if os.path.isfile(file_location):
            os.remove(file_location)

    # --- Update digital twin state ---
    twin_event = {
        "batch_id": batch_id,
        "image_id": safe_filename,
        "defect_present": result.get("defect_present", False),
        "defect_type": result.get("defect_type", "none"),
        "severity": int(result.get("confidence", 0) * 10) if result.get("defect_present") else 0,
        "inspection_result": "FAIL" if result.get("defect_present") else "PASS",
    }
    state = await quality_twin.process_event(twin_event)

    # --- Queue continuous learning (placeholder for Task 4) ---
    # background_tasks.add_task(queue_for_retraining, batch_id, file_location, result)

    # --- Cleanup temp file in background ---
    background_tasks.add_task(_cleanup_temp_file, file_location)

    return {
        "batch_id": batch_id,
        "filename": safe_filename,
        "inference": result,
        "twin_state": state,
    }


def _cleanup_temp_file(path: str):
    """Remove temp image after response is sent."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
