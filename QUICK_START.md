# Quick Start - 3D Image Generation

## 🚀 Get Started in 2 Minutes

### Prerequisites Check
- ✅ Backend running: `http://localhost:8000` 
- ✅ Frontend running: `http://localhost:5174`
- ✅ Both terminals visible with "Application startup" and "VITE ready" messages

### Step 1: Test with Demo
1. Open **frontend** browser (http://localhost:5174)
2. Click **"Load demo from backend"** button
3. 🎉 You should see a **3D visualization** appear in the preview panel

**Expected result**: A 3D surface image showing a synthetic floor plan with walls (red/elevated) and rooms (blue/depressed).

### Step 2: Upload Your Own Image

1. Click the **"Upload floor plan → POST /process"** link
2. Select a **floor plan image** (JPG, PNG, or any standard image format)
3. Wait for processing (5-10 seconds)
4. 🎉 Your **3D visualization** will appear

**Best image types**:
- Architectural floor plans (black lines on white background)
- Building layouts
- Room diagrams
- Any image with clear edges/boundaries

### Step 3: View Results

The panel shows:
- **3D Preview**: 3D surface visualization of your floor plan
- **Analysis JSON**: 
  - `project_id`: Unique identifier
  - `cost`: Estimated cost
  - `materials`: Recommended materials (RCC, Steel, Brick)
  - `score`: Quality/complexity score (0-1)
  - `explanation`: Why these materials were recommended

### Step 4: Store on Blockchain (Optional)

1. Deploy the Stellar contract (see README.md)
2. Copy the contract ID (C... address)
3. Paste it in the **"Contract ID"** field
4. Click **"Store on Blockchain"**
5. Approve transaction in Freighter wallet

---

## 🎨 How the 3D Image is Generated

Your uploaded floor plan image → **OpenCV + Matplotlib** → **3D Surface Visualization** → **PNG Image**

**Processing steps**:
1. **Edge Detection**: Finds walls and boundaries
2. **Distance Transform**: Calculates depth/distance from walls
3. **Height Mapping**: Combines edges + depth into 3D coordinates
4. **3D Rendering**: matplotlib generates 3D surface plot
5. **Encoding**: Converts to PNG and base64 for web display

---

## 📊 Understanding the 3D Visualization

**What the colors mean**:
- 🔴 **Red/Warm colors**: Walls, edges, elevated areas
- 🔵 **Blue/Cool colors**: Open spaces, rooms, depressed areas
- **Gradient**: Transitions between edges and interior

**What you see**:
- 3D perspective view from upper-left angle
- Height representing structural features
- Smooth gradient surface
- Background is dark (#0f1419) for contrast

---

## 🔧 Common Tasks

### Upload a Different Image
1. Click **"Upload floor plan → POST /process"** again
2. Select a new image
3. Previous results are replaced with new ones

### Load Demo Again
1. Click **"Load demo from backend"** 
2. Previous upload is cleared, demo is loaded

### Change Backend URL
If your API is on a different machine:
1. Edit `frontend/.env.local` (create if doesn't exist):
   ```
   VITE_API_BASE=http://your-machine-ip:8000
   ```
2. Restart frontend: `npm run dev`

### Adjust 3D Visualization Quality

Edit `backend/main.py` to customize:

**Better quality (slower)**:
```python
fig = plt.figure(figsize=(10, 8), dpi=150)  # Line 55
```

**Sharper colors**:
```python
cmap=cm.viridis,  # Change colormap (Line 65)
```

**Different angle**:
```python
ax.view_init(elev=45, azim=30)  # Change perspective (Line 72)
```

---

## ❌ Troubleshooting

| Problem | Solution |
|---------|----------|
| **3D image not showing** | Check backend logs for errors, click "Load demo" to test |
| **Upload button not working** | Ensure backend is running and CORS is enabled |
| **"Could not decode image"** | Use standard formats (JPG, PNG), check file is not corrupted |
| **Backend won't start** | Verify port 8000 is free: `netstat -ano \| findstr :8000` |
| **Frontend won't load** | Check port 5173/5174 is free, restart: `npm run dev` |

---

## 📚 More Information

- **Full Guide**: See `3D_IMAGE_GENERATION_GUIDE.md` in project root
- **Backend API Docs**: `http://localhost:8000/docs` (Swagger UI)
- **README.md**: Project overview and deployment instructions

---

## ✨ Key Features

✅ **Automatic 3D generation** from any floor plan image  
✅ **Fast processing** (< 1 second per image)  
✅ **Publication-quality** 3D visualizations  
✅ **Fallback rendering** if matplotlib unavailable  
✅ **Blockchain integration** for tamper-proof records  
✅ **Full CORS support** for cross-origin requests  

---

## 🎯 Next Steps

1. Upload your floor plan images
2. Generate 3D visualizations
3. Deploy Stellar contract for blockchain storage
4. Integrate with your structural analysis system
5. Customize colors and perspectives as needed

Enjoy! 🚀
