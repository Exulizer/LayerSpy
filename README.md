# LayerSpy ⚡

> **The Privacy-First, 100% Client-Side 3D Print G-Code Analyzer & Simulator**

[![Website](https://img.shields.io/badge/Website-layerspy.de-00bcd4?style=flat-square)](https://layerspy.de)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20%26%20Offline-00e676?style=flat-square)](#-100-local-processing--privacy-guarantee)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE.md)
[![Release](https://img.shields.io/badge/Release-v2.1.0-blue?style=flat-square)](https://github.com/Exulizer/LayerSpy/releases)

**Website:** [https://layerspy.de](https://layerspy.de)

---

## 🔒 100% Local Processing & Privacy Guarantee

**Your files and data NEVER leave your computer.**

Unlike cloud-based slicers or online converters, LayerSpy processes, analyzes, and renders everything **100% client-side** inside your web browser:

- 🛡️ **Zero Server Uploads:** When you open or drag & drop a `.gcode` file, it is parsed directly in memory on your device using a multi-threaded Web Worker.
- 💻 **Client-Side WebGL Rendering:** 2D and 3D toolpaths are rendered locally on your GPU using Three.js and hardware-accelerated shaders.
- 💾 **Local Settings Storage:** User preferences and language selections are stored strictly in your browser's local storage (`localStorage`). No telemetry, analytics tracking of file contents, or external database queries.
- 🚀 **Confidential & NDA Ready:** Safe for proprietary engineering prototypes, commercial 3D designs, and confidential G-Code.
- 🔌 **PWA & Offline Capable:** Installable as a Progressive Web App (PWA) and fully operational without an internet connection.

---

## 🌟 Key Features

- **🚀 Next-Gen Toolpath Visualizer (2D & 3D):**
  - High-performance WebGL rendering with support for both lightweight line rendering and volumetric solid tubes.
  - Multi-threaded streaming parser supporting large multi-hundred-megabyte G-Code files seamlessly.

- **🎛️ Dynamic Zen Mode & Multi-Screen Workspace:**
  - One-click sidebar collapse (**Zen Mode ⛶**) to maximize your 3D viewport.
  - Fully responsive HUD toolbar and auto-compact layout for laptops and small monitors.

- **📐 Overhang Angle Radar & Bridge Detection:**
  - Color-coded overhang analysis (<45° Safe, 45–60° Moderate, 60–75° Steep, >75° Critical, Bridges).

- **🎯 Pressure Advance (PA) & Corner Bulge Auditor:**
  - Detects melt-zone pressure spikes and high deceleration points ($\Delta v > 60\text{ mm/s}$).
  - Live simulator with direct Klipper (`SET_PRESSURE_ADVANCE`) and Marlin (`M900`) code embedding.

- **📡 VFA & Resonance Radar:**
  - Identifies motor vibration zones and surface ripple risks on outer walls.

- **🏎️ Real Kinematics Simulation (Klipper / Marlin):**
  - Forward/backward trapezoid motion planner calculating realistic print times based on acceleration, jerk, and square corner velocity.

- **🌐 100% Bilingual Localization:**
  - Instant toggle between English and German across all inspection panels, diagnostic linter alerts, and tooltips.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5 Canvas, WebGL, CSS Custom Properties
- **3D Engine:** Three.js & OrbitControls
- **Streaming Engine:** Web Workers with `ReadableStream` chunked binary parsing & `Float32Array` buffers
- **PWA:** Service Worker caching for instant offline availability

---

## 🚀 Getting Started

### Run in Browser
Simply open [https://layerspy.de](https://layerspy.de) and drag & drop any `.gcode` file (from Bambu Studio, OrcaSlicer, PrusaSlicer, Cura, IdeaMaker, etc.).

### Run Locally / Self-Host
Clone the repository and serve the files with any static web server:

```bash
git clone https://github.com/Exulizer/LayerSpy.git
cd LayerSpy
npx serve -l 3000 .
```

Open `http://localhost:3000` in your browser.

---

## 📄 License

Distributed under the MIT License. See `LICENSE.md` for more details.
