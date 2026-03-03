import os
import tempfile
from functools import lru_cache

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

app = FastAPI(title="AyaLearning Faster-Whisper ASR", version="1.0.0")


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    model_size = os.getenv("ASR_MODEL_SIZE", "small")
    device = os.getenv("ASR_DEVICE", "cpu")
    compute_type = os.getenv("ASR_COMPUTE_TYPE", "int8")
    return WhisperModel(model_size, device=device, compute_type=compute_type)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "faster-whisper"}


@app.post("/v1/audio/transcriptions")
async def transcribe_audio(
    file: UploadFile = File(...),
    model: str = Form(default="small"),
    language: str = Form(default="ja"),
    response_format: str = Form(default="json"),
):
    try:
        suffix = ".webm"
        if file.filename and "." in file.filename:
            suffix = "." + file.filename.split(".")[-1]

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        whisper_model = get_model()
        beam_size = int(os.getenv("ASR_BEAM_SIZE", "1"))
        vad_filter = os.getenv("ASR_VAD_FILTER", "true").lower() == "true"

        segments, _info = whisper_model.transcribe(
            temp_path,
            language=language or "ja",
            beam_size=beam_size,
            vad_filter=vad_filter,
            condition_on_previous_text=False,
        )

        text = "".join(segment.text for segment in segments).strip()

        if response_format != "json":
            return JSONResponse(content={"text": text})

        return {"text": text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ASR failed: {str(exc)}") from exc
    finally:
        try:
            if "temp_path" in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
        except OSError:
            pass
