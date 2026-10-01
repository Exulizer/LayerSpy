# LayerSpy ⚡

> **The Privacy-First, 100% Client-Side 3D Print G-Code Analyzer, Kinematics Simulator & A/B Comparison Engine**

[![Website](https://img.shields.io/badge/Website-layerspy.de-00bcd4?style=flat-square)](https://layerspy.de)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20%26%20Offline-00e676?style=flat-square)](#-100-local-processing--privacy-guarantee)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE.md)
[![Release](https://img.shields.io/badge/Release-v2.3.22-blue?style=flat-square)](https://github.com/Exulizer/LayerSpy/releases)

**Website:** [https://layerspy.de](https://layerspy.de)

---

## 🔒 100% Local Processing & Privacy Guarantee

**Your files and data NEVER leave your computer.**

Unlike cloud-based slicers or online converters, LayerSpy processes, analyzes, and renders everything **100% client-side** inside your web browser:

- 🛡️ **Zero Server Uploads:** When you open or drag & drop a `.gcode` file, it is parsed directly in memory on your device using multi-threaded Web Workers and Float32Array streaming buffers.
- 💻 **Client-Side WebGL Rendering:** 2D and 3D toolpaths are rendered locally on your GPU using Three.js and hardware-accelerated shaders.
- 💾 **Local Settings Storage:** User preferences and language selections are stored strictly in your browser's local storage (`localStorage`). No telemetry, analytics tracking of file contents, or external database queries.
- 🚀 **Confidential & NDA Ready:** Safe for proprietary engineering prototypes, commercial 3D designs, and confidential G-Code.
- 🔌 **PWA & Offline Capable:** Installable as a Progressive Web App (PWA) and fully operational without an internet connection.

---

## 🌟 Key Features

- **🚀 Next-Gen Toolpath Visualizer (2D & 3D):**
  - High-performance WebGL rendering with support for both lightweight line rendering and volumetric solid tubes.
  - Multi-threaded streaming parser supporting large multi-hundred-megabyte G-Code files seamlessly.

- **⚖️ Center of Mass & Footprint Stability Analysis:**
  - Calculates the exact 3D center of gravity (CoM), first-layer bed contact area (Footprint in mm²), and aspect ratio (Height vs Footprint).
  - Detects print tipping and bed-adhesion knockover risks on high-acceleration bed-slinger 3D printers.

- **🔀 Dual G-Code A/B Comparison Engine:**
  - Side-by-side comparison of two sliced G-Codes (File A & B) to evaluate slicing parameters (Speed, Infill, Layer Height, Kinematics).
  - Synchronized Z-height slider, comprehensive delta statistics table, and a 0.5 mm spatial differential grid in 3D.
  - One-click copy for Markdown comparison reports.

- **📐 Overhang Angle Radar & Bridge Detection:**
  - Color-coded overhang analysis (<45° Safe, 45–60° Moderate, 60–75° Steep, >75° Critical, Bridges).

- **🎯 Pressure Advance (PA) & Corner Bulge Auditor:**
  - Detects melt-zone pressure spikes and high deceleration points ($\Delta v > 60\text{ mm/s}$).
  - Live simulator with direct Klipper (`SET_PRESSURE_ADVANCE`) and Marlin (`M900`) code embedding.

- **📡 VFA & Resonance Radar:**
  - Identifies motor vibration zones and surface ripple risks on outer walls (45–65 mm/s & 90–110 mm/s corridors).

- **🏎️ Real Kinematics Simulation (Klipper / Marlin):**
  - Forward/backward trapezoid motion planner calculating realistic print times based on acceleration (M201/M204), jerk, and Square Corner Velocity (M205).

- **🌐 100% Bilingual Localization:**
  - Instant toggle between English and German across all inspection panels, diagnostic linter alerts, and tooltips.

---

## 🛠️ 3D Printing Ecosystem & Workflow

LayerSpy integrates into a comprehensive 3D printing workflow:

1. **Pre-Slicing**: [MeshDoc](https://meshdoc.de) – Repair broken STL/3MF files, reduce triangle counts, and seal non-manifold meshes in the browser.
2. **Pre-Printing**: [LayerSpy](https://layerspy.de) – Audit G-Code, simulate motion paths, inspect stability, and compare slicer profiles.
3. **Knowledge Platform**: [Svender3D](https://www.svender3d.de) – Free 3D printing tools, shrinkage calculators, and guides.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5 Canvas, WebGL, CSS Custom Properties
- **3D Engine:** Three.js & OrbitControls
- **Streaming Engine:** Web Workers with `ReadableStream` chunked binary parsing & `Float32Array` buffers
- **PWA:** Service Worker caching for instant offline availability

---

## 🚀 Getting Started

### Run in Browser
Simply open [https://layerspy.de](https://layerspy.de) and drag & drop any `.gcode` file (from Bambu Studio, OrcaSlicer, PrusaSlicer, Cura, Creality Print, IdeaMaker, etc.).
---

## 📄 License

Distributed under the MIT License. See `LICENSE.md` for more details.
