# LayerSpy v2.1.0 ⚡

> **The Privacy-First, 100% Client-Side 3D Print G-Code Analyzer & Simulator**

LayerSpy **v2.1.0** is a feature-packed update introducing an intelligent cooling & overhang traffic light system, an interactive warning linter with instant severity filtering, a light/dark theme switcher in the header, and comprehensive SEO and knowledge base additions.

---

## ✨ What's New in v2.1.0

### 🔍 1. Interactive Linter Severity Filter Bar
- **Filter Chips with Live Counters:** Filter diagnostic warnings instantly by **All**, 🔴 **Critical**, 🟡 **Warning**, and 🟢 **Info**.
- **Dynamic DOM Filtering:** Immediate category filtering without re-parsing files.
- **Empty-State Feedback:** Displays clean contextual notices when a category has 0 warnings.
- **One-Click Navigation:** Directly jump to problematic layers in the 2D/3D viewport or jump to exact lines in the G-Code viewer.

### 🚦 2. Cooling & Overhang Ampelsystem (Traffic Light System)
- **Layer-Accurate Fan Tracking:** Full parsing and tracking of `M106 S<0-255>`, `M107`, and Klipper `SET_FAN_SPEED`.
- 🟢 **Optimal (Green):** Well-cooled overhangs (Fan $\ge$ 70% for PLA/PETG bridges, initial bed adhesion layers).
- 🟡 **Warning (Yellow):** Reduced cooling notice on steep features.
- 🔴 **Critical (Red):** Critical melting risks when steep overhangs ($> 60^\circ$) or bridges print with insufficient cooling fan ($< 30\%$).

### 🌗 3. Light & Dark Theme Toggle
- Dedicated header switcher allowing users to choose between **Dark Mode** (default) and a clean **Light Mode**.
- Optimized contrast and styling across all inspection tools, modals, tooltips, and charts.

### 📚 4. 3D Printing Glossary & FAQ Expansion
- Integrated knowledge base explaining advanced 3D printing concepts (VFA, Pressure Advance, Klipper kinematics, Z-Seam alignment, Volumetric Flow).
- Enhanced structured data (`FAQPage` JSON-LD schema) for improved search engine indexing.

### 🌐 5. 100% Client-Side Privacy Guarantee
- Zero server uploads — all `.gcode` analysis, WebGL rendering, and motion kinematics run 100% in your browser.

---

## 📦 Asset Downloads
- **`LayerSpy-v2.1.0.zip`** — Complete standalone release ready for offline use, static web hosting, or PWA deployment.
