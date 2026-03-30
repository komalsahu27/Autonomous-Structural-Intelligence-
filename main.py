"""
ASIS backend: floor-plan placeholder processing + JSON the frontend/blockchain use.
Run: uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import base64
import io
import uuid

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Autonomous Structural Intelligence System", version="0.1.0")

# Allow local React dev server to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _height_map_from_floor_plan(gray: np.ndarray) -> np.ndarray:
    """Build a 2D height field from the plan: walls/edges rise, interior falls (distance)."""
    h, w = gray.shape[:2]
    tw, th = min(64, w), min(64, h)
    small = cv2.resize(gray, (tw, th), interpolation=cv2.INTER_AREA)
    edges = cv2.Canny(small, 40, 120)
    _, binary = cv2.threshold(small, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    dt = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    z = dt.astype(np.float64) * 0.15 + edges.astype(np.float64) * 0.85
    zmax = float(z.max()) or 1.0
    return z / zmax


def _render_3d_matplotlib(gray: np.ndarray) -> str:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import cm

    z = _height_map_from_floor_plan(gray)
    rows, cols = z.shape
    x = np.arange(cols)
    y = np.arange(rows)
    x_grid, y_grid = np.meshgrid(x, y, indexing="xy")

    fig = plt.figure(figsize=(7, 5), dpi=110)
    ax = fig.add_subplot(111, projection="3d")
    ax.plot_surface(
        x_grid,
        y_grid,
        z,
        cmap=cm.coolwarm,
        linewidth=0,
        antialiased=True,
        alpha=0.95,
        rstride=2,
        cstride=2,
    )
    ax.set_zlim(0, 1.05)
    ax.set_axis_off()
    ax.view_init(elev=32, azim=-55)
    fig.patch.set_facecolor("#0f1419")
    ax.set_facecolor("#0f1419")
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.08, facecolor="#0f1419")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


def _render_depth_map_fallback(gray: np.ndarray) -> str:
    """2D depth heatmap (OpenCV only) if matplotlib is unavailable."""
    z = _height_map_from_floor_plan(gray)
    z8 = np.clip(z * 255.0, 0, 255).astype(np.uint8)
    colored = cv2.applyColorMap(z8, cv2.COLORMAP_TURBO)
    ok, buf = cv2.imencode(".png", colored)
    if not ok:
        raise RuntimeError("cv2.imencode failed")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def render_3d_preview_png(gray: np.ndarray) -> str:
    """Render a 3D surface PNG (base64, no data-URL prefix) from the floor plan."""
    try:
        return _render_3d_matplotlib(gray)
    except Exception:
        return _render_depth_map_fallback(gray)


def _material_recommendations(edge_density: float, area_factor: float) -> tuple[list[str], str]:
    """
    Full-scope material checklist for a typical residential build (hackathon demo).
    Structural system toggles slightly with plan complexity (edge_density).
    """
    use_steel_frame = edge_density > 0.12

    # Core structure & shell
    structural = (
        [
            "RCC footings & plinth beam",
            "RCC columns, beams & floor slabs",
            "TMT reinforcement steel (Fe500/550)",
            "Ready-mix / design-mix concrete (M20–M25)",
            "Structural steel sections (ISMB/ISMC) — moment frames",
            "Metal deck slab / composite flooring",
        ]
        if use_steel_frame
        else [
            "RCC footings & plinth beam",
            "RCC columns, beams & floor slabs (load-bearing frame)",
            "TMT reinforcement steel (Fe500/550)",
            "Ready-mix / design-mix concrete (M20–M25)",
        ]
    )

    masonry_infills = [
        "Fly ash / red clay bricks OR AAC blocks",
        "Cement mortar (1:4/1:6) for masonry",
        "Concrete hollow blocks (non-load partitions, optional)",
    ]

    foundation_site = [
        "Lean concrete (PCC) under footings",
        "Waterproofing admixture for underground RCC",
        "Anti-termite treatment (soil & plinth)",
        "Hardcore / soling under floors where specified",
    ]

    roof_envelope = [
        "RCC roof slab with weather-proofing layer",
        "Roof insulation (PUF board / XPS, as climate)",
        "Roof drainage: PVC rainwater pipes & outlets",
        "Clay/cement roof tiles OR cool-roof coating (optional)",
    ]

    waterproofing = [
        "Bituminous membrane / liquid waterproofing (terraces & wet areas)",
        "Crystalline waterproofing for tanks & basements (if any)",
    ]

    finishes = [
        "Internal cement plaster + gypsum punning (dry areas)",
        "Wall putty & acrylic interior paint",
        "Weather-proof exterior paint / texture",
        "Vitrified / ceramic floor tiles + tile adhesive",
        "Granite / quartz kitchen counter (optional)",
        "False ceiling: gypsum board on metal grid (optional)",
    ]

    joinery = [
        "Main door: hardwood / engineered wood with hardware",
        "Internal flush doors with hinges & locks",
        "UPVC / aluminium windows with safety glass",
        "Aluminium sliding / casement shutters where specified",
    ]

    mep = [
        "Copper electrical wiring (ISI) in PVC conduits",
        "Distribution boards, MCBs, ELCB/RCCB",
        "LED lighting fixtures & fans",
        "CPVC / uPVC plumbing lines; PVC drainage",
        "Sanitary ware: WC, washbasin, taps (ISI)",
        "Overhead / underground water storage tanks (RCC/HDPE)",
    ]

    misc = [
        "Curing compound & construction chemicals",
        "Expansion joint fillers & sealants",
        "Scaffolding & formwork consumables (site allowance)",
    ]

    materials: list[str] = []
    for group in (
        foundation_site,
        structural,
        masonry_infills,
        roof_envelope,
        waterproofing,
        finishes,
        joinery,
        mep,
        misc,
    ):
        materials.extend(group)

    complexity = "higher partition/wall complexity" if use_steel_frame else "standard load-bearing RCC frame"
    explain = (
        f"Recommendations cover foundation through MEP for a full house build ({complexity}). "
        f"Plan metrics: edge density {edge_density:.2f}, area factor {area_factor:.2f}. "
        "Adjust grades with local codes, soil report, and structural design."
    )
    return materials, explain


def _synthetic_floor_gray() -> np.ndarray:
    """Simple plan for /process/demo 3D preview."""
    img = np.ones((420, 420), dtype=np.uint8) * 255
    cv2.rectangle(img, (60, 60), (360, 360), 0, 4)
    cv2.line(img, (210, 60), (210, 360), 0, 3)
    cv2.line(img, (60, 210), (360, 210), 0, 3)
    cv2.rectangle(img, (80, 80), (190, 190), 0, 2)
    return img


def fake_analysis_from_image(gray: np.ndarray) -> dict:
    """
    Hackathon stub: derive simple numeric features from the floor plan
    to vary cost/score. Replace with your real OpenCV + ML pipeline.
    """
    h, w = gray.shape[:2]
    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.mean(edges > 0))
    area_factor = (w * h) / 1_000_000.0

    # Toy rules so demos look plausible
    base_cost = 800_000 + int(area_factor * 400_000) + int(edge_density * 200_000)
    score = min(0.95, 0.65 + edge_density * 0.25 + min(area_factor, 1.0) * 0.05)

    materials, explanation = _material_recommendations(edge_density, area_factor)

    preview_b64 = render_3d_preview_png(gray)
    
    # Generate height map data for interactive 3D visualization
    height_map = _height_map_from_floor_plan(gray)
    height_map_data = height_map.tolist()
    
    return {
        "project_id": f"FP{uuid.uuid4().hex[:6].upper()}",
        "cost": base_cost,
        "materials": materials,
        "score": round(score, 2),
        "explanation": explanation,
        "preview_3d_base64": preview_b64,
        "height_map_data": height_map_data,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/process/demo")
def process_demo():
    """Fixed example JSON — use when you skip image upload during the hackathon demo."""
    demo_gray = _synthetic_floor_gray()
    preview_b64 = render_3d_preview_png(demo_gray)
    height_map = _height_map_from_floor_plan(demo_gray)
    demo_edge = 0.08
    demo_area = 0.18
    demo_materials, demo_explain = _material_recommendations(demo_edge, demo_area)
    return {
        "project_id": "FP101",
        "cost": 1_200_000,
        "materials": demo_materials,
        "score": 0.89,
        "explanation": demo_explain,
        "preview_3d_base64": preview_b64,
        "height_map_data": height_map.tolist(),
    }


@app.post("/process")
async def process_floor_plan(file: UploadFile = File(...)):
    """POST /process — multipart form with `file` = floor plan image."""

    try:
        data = await file.read()
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return fake_analysis_from_image(gray)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/process/json")
def process_json(payload: dict):
    """
    Optional: echo/validate JSON from the client (same shape as /process output).
    """
    required = {"project_id", "cost", "materials", "score", "explanation"}
    if not required.issubset(payload.keys()):
        raise HTTPException(status_code=400, detail=f"Expected keys: {required}")
    return payload
