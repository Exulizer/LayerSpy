# LayerSpy v2.3.8 ⚡

> **The Privacy-First, 100% Client-Side 3D Print G-Code Analyzer, Kinematics Simulator & A/B Comparison Engine**

LayerSpy **v2.3.8** introduces the **Dual G-Code A/B Comparison Engine**, **Center of Mass (CoM) & Footprint Stability Analysis**, Tool-First SEO architecture, and ecosystem cross-linking.

---

## 🌟 New Features in v2.3.8

- **🔀 Dual G-Code A/B Comparison Engine:**
  - Load a baseline file (A) and compare against a modified profile (B) 100% client-side in the browser.
  - Comprehensive delta statistics table: Print Time, Filament Length & Weight, Layer Count, Retract Count, Travel Distance, Bulge-Risk Corners, VFA Corridors, Z-Seam Distribution, Overhangs, Bridge Length, and Volumetric Flow.
  - **Synchronized Z-Height Slider:** Synchronously steps through layers across files with varying layer heights.
  - **0.5 mm Spatial Differential Raster:** Visual diff engine highlighting geometric toolpath deviations directly in 3D.
  - One-click copy for Markdown comparison reports for Discord and forum sharing.

- **⚖️ Center of Mass & Footprint Stability Analysis:**
  - Automated 3D Center of Gravity calculation.
  - First-layer bed contact area (Footprint in mm²) and height-to-footprint aspect ratio calculation.
  - Real-time knockover and bed-adhesion safety warnings for high-acceleration bed-slinger 3D printers.

- **🚀 Tool-First SEO & Rich Schema.org:**
  - Complete JSON-LD structured data (`WebApplication`, `HowTo`, `FAQPage`) for enhanced SERP visibility and AI search discovery (GEO).
  - High-performance semantic content and 9 comprehensive FAQ sections located cleanly below the interactive workspace.

- **🛠️ 3D Printing Workflow Ecosystem:**
  - Seamless linking with **MeshDoc** (meshdoc.de) for pre-slicing STL/3MF mesh repair and **Svender3D** (svender3d.de) as the central 3D printing platform.

---

## 🔧 Improvements & Optimizations

- **Streaming Float32Array Pipeline:** Multi-threaded parsing of multi-hundred-megabyte G-Code files using Web Worker transferables.
- **True Trapezoidal Motion Planner:** Real-time 2D kinematics simulation calculating acceleration, jerk, and Square Corner Velocity.
- **Viewport Responsiveness:** Enforced 340px sidebar width limits (`min-width: 0`, `overflow-x: hidden`) eliminating horizontal overflow across all screen sizes.

---

## 📦 Distribution Packages

- **`LayerSpy-v2.3.8.zip`** — Complete standalone release package ready for static web hosting or offline PWA deployment.
