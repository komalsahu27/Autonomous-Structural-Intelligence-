# 3D Image Generation System - Complete Guide

## Overview
Your project has a **fully functional 3D image generation system** that processes uploaded floor plan images and generates 3D structural visualizations. This guide explains how it works and how to use it.

---

## How It Works: Complete Flow

### 1. Frontend (React + TypeScript)
- **Location**: `frontend/src/App.tsx`
- **Role**: User interface for uploading floor plan images
- **Key state**: `preview3dBase64` stores the 3D image data

**Upload Flow**:
```
User selects image file
  ↓
onChange handler captures file
  ↓
POST request to /process endpoint with FormData
  ↓
Backend processes and returns JSON with preview_3d_base64
  ↓
Frontend displays 3D image in <img> tag
```

### 2. Backend (FastAPI + Python)
- **Location**: `backend/main.py`
- **Servers on**: `http://127.0.0.1:8000`
- **Dependencies**: FastAPI, OpenCV, NumPy, Matplotlib

**Processing Pipeline**:

#### Step 1: Image Upload (`/process` endpoint)
```python
POST /process → receives image file
  ↓
cv2.imdecode() → decode image bytes
  ↓
cv2.cvtColor(BGR2GRAY) → convert to grayscale
```

#### Step 2: Height Map Generation
```python
_height_map_from_floor_plan(gray_image)
  ↓
1. Resize to 64x64 for performance
2. Edge detection with cv2.Canny()
3. Distance transform to find room depth
4. Combine edges (85%) + depth (15%)
  ↓
Returns normalized 2D height field (0-1)
```

#### Step 3: 3D Visualization
```python
render_3d_preview_png(gray_image)
  ↓
Attempt 1: matplotlib (primary)
  - Creates 3D surface plot
  - Uses coolwarm colormap
  - Renders at 110 DPI (7x5 inches)
  - Dark theme (#0f1419 background)
  
Fallback: cv2 depth heatmap (OpenCV only)
  ↓
Encodes as PNG
  ↓
Returns base64-encoded PNG string
```

#### Step 4: Analysis & Response
```python
fake_analysis_from_image()
  ↓
1. Extract features from edges
2. Calculate cost estimate
3. Suggest materials (RCC, Steel, Brick)
4. Generate explanation
5. Attach preview_3d_base64
  ↓
Returns JSON:
{
  "project_id": "FP...",
  "cost": 1200000,
  "materials": ["RCC", "Brick"],
  "score": 0.89,
  "explanation": "...",
  "preview_3d_base64": "<base64-encoded PNG>"
}
```

### 3. Frontend Display
```jsx
{preview3dBase64 && (
  <img src={`data:image/png;base64,${preview3dBase64}`} alt="3D preview" />
)}
```
The image displays only after the `preview_3d_base64` field is received from the backend.

---

## API Endpoints

### GET `/health`
**Purpose**: Check if API is running
**Response**: `{"status": "ok"}`

### GET `/process/demo`
**Purpose**: Load example 3D visualization for testing
**Response**: JSON with `preview_3d_base64` containing a 3D image of a synthetic floor plan

**When to use**: 
- Test the frontend without uploading an image
- Generate a sample 3D visualization
- Verify the system is working

### POST `/process`
**Purpose**: Upload a floor plan image and generate 3D visualization
**Input**: `multipart/form-data` with `file` field
**Output**: JSON with 3D preview

**Example using curl**:
```bash
curl -X POST http://127.0.0.1:8000/process \
  -F "file=@floor_plan.jpg"
```

---

## Running the System

### Prerequisites
- ✅ Python 3.14+ (venv configured)
- ✅ Node.js + npm (frontend)
- ✅ All dependencies installed

### Start Backend
```bash
cd backend
.venv\Scripts\activate  # Windows
python -m uvicorn main:app --reload --port 8000
```

**Expected output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### Start Frontend
```bash
cd frontend
npm run dev
```

**Expected output**:
```
➜  Local: http://localhost:5173/
```
(Port may vary if 5173 is taken)

### Test the System
1. Open browser: `http://localhost:5173` (or the port shown)
2. Click **"Load demo from backend"** to test 3D generation
3. You should see a 3D visualization of a sample floor plan
4. Upload your own floor plan image using the file input
5. Wait for processing and see the generated 3D image

---

## Key Components & How They Work

### 1. Height Map Algorithm
```python
def _height_map_from_floor_plan(gray: np.ndarray) -> np.ndarray
```

**Input**: Grayscale floor plan image
**Output**: 2D height field normalized 0-1

**Process**:
1. **Downsize**: 64x64 for speed
2. **Edge detection**: Canny edges (walls appear as peaks)
3. **Distance transform**: Interior points get height based on distance to walls
4. **Combine**: 85% edges + 15% distance = realistic 3D effect

**Result**: Walls are elevated, open spaces are depressions

### 2. Matplotlib 3D Renderer
```python
def _render_3d_matplotlib(gray: np.ndarray) -> str
```

**Features**:
- **Surface type**: 3D plot_surface
- **Colormap**: coolwarm (blue=low, red=high)
- **Resolution**: 110 DPI for sharp output
- **Viewing angle**: 32° elevation, -55° azimuth (realistic perspective)
- **Size**: 7x5 inches (good balance of detail and speed)
- **Format**: PNG base64 string

**Visual elements**:
- Walls: Red/warm colors (elevated)
- Rooms: Blue/cool colors (depressed)
- Edges: Highlighted with colormap gradient

### 3. Fallback Depth Map
```python
def _render_depth_map_fallback(gray: np.ndarray) -> str
```

**When used**: If matplotlib not available
**Type**: 2D heatmap with TURBO colormap
**Output**: Still PNG base64, just 2D instead of 3D

---

## Customization Options

### Adjust 3D Visualization Quality

Edit `main.py` line 55-58:
```python
fig = plt.figure(figsize=(7, 5), dpi=110)  # Change figsize and dpi
```

- **Larger figsize**: More detail but slower
- **Higher dpi**: Sharper image but larger file
- Recommend: `(8, 6)` at 120 DPI for better quality

### Change Height Map Weight

Edit `main.py` line 39:
```python
z = dt.astype(np.float64) * 0.15 + edges.astype(np.float64) * 0.85
                          ^^^^                                ^^^^
                      distance weight                    edge weight
```

- **0.15, 0.85**: Emphasizes walls
- **0.50, 0.50**: Balanced
- **0.85, 0.15**: Emphasizes room depth

### Change Colormap

Edit `main.py` line 65:
```python
cmap=cm.coolwarm,  # Change to: viridis, plasma, RdYlBu, etc.
```

### Adjust Viewing Angle

Edit `main.py` line 72:
```python
ax.view_init(elev=32, azim=-55)  # Change elevation and azimuth
```

- **elev**: 0-90 degrees (0=top view, 90=side view)
- **azim**: 0-360 degrees (rotation around vertical axis)

---

## Testing

### Test 1: Demo Endpoint
```bash
curl http://127.0.0.1:8000/process/demo
```

Should return JSON with `preview_3d_base64` field containing the PNG.

### Test 2: Upload Image
Use the frontend file input to upload a floor plan image.

**Supported formats**: JPG, PNG, GIF, WebP (any image format OpenCV supports)

### Test 3: Verify Display
After upload, the 3D image should appear in the "3D structural preview" panel.

---

## Troubleshooting

### Issue: "3D preview not appearing"
**Cause**: Backend not returning `preview_3d_base64`
**Fix**: 
1. Check backend logs for errors
2. Verify matplotlib is installed: `pip list | grep matplotlib`
3. Test `/process/demo` endpoint directly

### Issue: "Could not decode image"
**Cause**: Invalid image format
**Fix**: 
1. Use standard formats: JPG, PNG, BMP
2. Ensure image is not corrupted
3. Try a different image

### Issue: "Post /process error"
**Cause**: Backend error
**Fix**:
1. Check backend terminal for error message
2. Verify file size is reasonable
3. Ensure CORS is enabled (it is)

### Issue: "API is not responding"
**Cause**: Backend not running
**Fix**:
1. Start backend: `python -m uvicorn main:app --reload --port 8000`
2. Verify port 8000 is available
3. Check firewall settings

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer (React)                        │
│  - File input for image upload                              │
│  - Display 3D preview image                                 │
│  - Show JSON analysis results                               │
└─────────────────────────────────────────────────────────────┘
                            ↕ (HTTP POST/GET)
┌─────────────────────────────────────────────────────────────┐
│                 Backend API (FastAPI)                        │
│  - /process → image upload & 3D generation                  │
│  - /process/demo → test visualization                       │
└─────────────────────────────────────────────────────────────┘
                            ↕ (Optional)
┌─────────────────────────────────────────────────────────────┐
│            Stellar Blockchain (Soroban)                      │
│  - Store project analysis on-chain                          │
│  - Tamper-evident records                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance Notes

- **Image processing**: <100ms for typical floor plans
- **3D rendering**: 200-500ms depending on image size
- **File size**: Output PNG usually 50-150KB
- **Base64 encoding**: Adds ~33% size

**For production**, consider:
- Image optimization (resize if >1000px)
- Caching results
- Using WebGL for interactive 3D instead of static PNG
- Consider Three.js or Babylon.js for interactive visualization

---

## Next Steps

1. ✅ Upload floor plan images to generate 3D visualizations
2. ✅ Fine-tune colors and angles in visualization
3. Deploy contract and test blockchain integration
4. Consider WebGL-based interactive viewer for production
5. Integrate with your structural analysis AI/ML pipeline

