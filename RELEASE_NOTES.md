# LayerSpy v2.3.22 ⚡

> **The Privacy-First, 100% Client-Side 3D Print G-Code Analyzer, Kinematics Simulator & A/B Comparison Engine**

LayerSpy **v2.3.22** is a major feature & stability release bringing the **Dual G-Code A/B Comparison Engine**, **Center of Mass (CoM) & Footprint Stability Analysis**, Tool-First SEO/GEO Architecture, and a **pure single-scrollbar layout** with dynamic viewport auto-fitting.

---

## 🌟 What's New in v2.3.22

### 🔀 Dual G-Code A/B Comparison Engine
- **Client-Side Comparison:** Compare baseline (A) and modified (B) slicer profiles side-by-side with zero cloud uploads.
- **Delta Statistics Table:** Instant side-by-side delta metrics for Print Time, Filament Length & Weight, Layer Count, Retraction Count, Travel Distance, Corner Bulge Risk Points, VFA Speeds, Z-Seam Distribution, Overhangs, Bridge Length, and Volumetric Flow.
- **Synchronized Z-Height Slider:** Accurately steps through layers across files with varying layer heights.
- **0.5 mm Spatial Differential Raster:** Visual diff engine highlighting geometric toolpath deviations directly in 3D.
- **One-Click Export:** Copy formatted Markdown comparison reports for Discord, GitHub, and community forums.

### ⚖️ Center of Mass (CoM) & Footprint Stability Check
- **3D Center of Gravity:** Calculates cumulative 3D CoM per layer.
- **First-Layer Footprint:** Computes convex hull contact area (mm²) and slenderness/aspect ratio (Height vs Footprint).
- **Knockover Risk Auditor:** Real-time safety ratings (Safe, Caution, High Risk) for fast bed-slinger 3D printers.

### 📐 Pure Single-Scroll Layout & Auto-Fit Engine
- **Eliminated Double Scrollbar:** Replaced conflicting nested overflow rules on `.app-layout` with `overflow: visible !important`, ensuring a single clean browser scrollbar across all monitors.
- **Zero Blank Space Below Footer:** Constrained workspace and panel containers (`position: relative; overflow: hidden`) so the document scroll ends pixel-perfect at the footer.
- **Dynamic Workspace Sizing:** Workspace now calculates `calc(100vh - 152px)` to fit the viewport fold cleanly on desktop without cutting off bottom controls.

### 🔍 Tool-First SEO, FAQ & AI-Search (GEO) Architecture
- **Schema.org JSON-LD:** Full rich snippet integration (`SoftwareApplication`, `HowTo`, `FAQPage`).
- **Interactive FAQ Accordion:** 9 comprehensive 3D printing guide topics located cleanly below the workspace.
- **Ecosystem Cross-Links:** Direct integration with **MeshDoc** (meshdoc.de) for mesh repair and **Svender3D** (svender3d.de) for tools & calculators.
- **Google Consent Mode v2:** Default privacy-compliant consent handling.

---

## 🔧 Technical Improvements

- **Streaming Float32Array Pipeline:** Multi-threaded binary streaming parser supporting large 100MB+ G-Code files with minimal RAM footprint.
- **2D Kinematic Motion Planner:** Real-time forward/backward trapezoid planner with Klipper Square Corner Velocity (SCV) and acceleration limits.
- **PWA Service Worker:** Updated cache lifecycle (`v2.3.22`) with Network-First strategy for HTML navigation and offline fallback.

---

## 📦 Downloads & Installation

- **Release Package:** [`LayerSpy-v2.3.22.zip`](https://github.com/Exulizer/LayerSpy/releases/tag/v2.3.22)
- **Live Demo / Web App:** [https://layerspy.de](https://layerspy.de)
- **Self-Hosting:**
  ```bash
  git clone https://github.com/Exulizer/LayerSpy.git
  cd LayerSpy
  npx serve -l 3000 .
  ```

