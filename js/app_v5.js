
// --- i18n Localization ---


function setLanguage(lang) {
    if (!window.i18n || !window.i18n[lang]) return;
        // Update footer links for subpages
        ['datenschutz', 'impressum', 'kontakt'].forEach(page => {
            document.querySelectorAll('a[href^="' + page + '"]').forEach(a => {
                a.href = lang === 'en' ? page + '_en.html' : page + '.html';
            });
        });

    window.currentLang = lang;
    localStorage.setItem('layerspy_lang', lang);
    document.documentElement.lang = lang;
    if(window.translateModals) window.translateModals();
    
    // Reset explanation box to translate the prompt, or just force the user to click again to get the new language explanation.
    const explBox = document.getElementById('explanation-output');
    if (explBox && !explBox.querySelector('[data-i18n]')) {
        explBox.innerHTML = '<span data-i18n="msg.click">' + window.t("msg.click") + '</span>';
    }
    
    // Update active state of buttons
    const langEnBtn = document.getElementById('lang-en');
    const langDeBtn = document.getElementById('lang-de');
    if (langEnBtn && langDeBtn) {
        langEnBtn.style.background = lang === 'en' ? 'var(--accent-color)' : 'transparent';
        langEnBtn.style.color = lang === 'en' ? '#fff' : 'rgba(255,255,255,0.5)';
        langDeBtn.style.background = lang === 'de' ? 'var(--accent-color)' : 'transparent';
        langDeBtn.style.color = lang === 'de' ? '#fff' : 'rgba(255,255,255,0.5)';
    }

    // Replace text for all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (window.i18n[lang][key]) {
            el.innerHTML = window.i18n[lang][key]; // innerHTML allows HTML entities if any
        }
    });

    // Translate title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (window.i18n[lang][key]) {
            el.setAttribute('title', window.i18n[lang][key]);
        }
    });

    // Translate data-tooltip attributes
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.getAttribute('data-i18n-tooltip');
        if (window.i18n[lang][key]) {
            el.setAttribute('data-tooltip', window.i18n[lang][key]);
        }
    });
}

// Helper for dynamic strings
window.t = function(key) {
    return (window.i18n && window.i18n[window.currentLang] && window.i18n[window.currentLang][key]) ? window.i18n[window.currentLang][key] : key;
};

// Apply on load
document.addEventListener('DOMContentLoaded', () => {
    // Setup listeners
    const langEnBtn = document.getElementById('lang-en');
    const langDeBtn = document.getElementById('lang-de');
    if (langEnBtn) langEnBtn.addEventListener('click', () => setLanguage('en'));
    if (langDeBtn) langDeBtn.addEventListener('click', () => setLanguage('de'));
    
    // Initial language setup
    setTimeout(() => setLanguage(window.currentLang), 50);
});

class GCodeViewer {
    constructor() {
        this.canvas = document.getElementById('gcode-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Canvas state
        this.scale = 1.8;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isMouseDown = false;
        this.wasDragging = false;
        this.startX = 0;
        this.startY = 0;
        
        // GCode data state
        this.originalLines = [];
        this.layerList = []; // Array of layer objects: { z: height, paths: [] }
        this.currentLayerIdx = 0;
        this.selectedLineIndex = -1;
        
        // Playback state
        this.playbackIndex = -1; // -1 means show all
        this.isPlaying = false;
        this.playRequestId = null;
        
        // Advanced Features (Linting, Folding, Bookmarks)
        this.foldedRanges = []; // {start: int, end: int}
        this.bookmarks = new Set();
        this.lintWarnings = {}; // map of lineIndex -> array of warning strings
        
        // Pagination state
        this.gcodeViewMode = 'layer'; // 'layer' or 'all'
        this.gcodePageSize = '50';
        this.gcodeCurrentPage = 1;
        this.gcodeTotalPages = 1;
        
        // Controls state
        this.currentTemp = 205;
        this.currentBed = 60;
        this.currentRetract = 0.8;
        this.currentFan = 100;
        this.currentFlow = 100;
        this.currentSpeed = 100;
        this.currentZOffset = 0.00;

        // Environment config (Standard 220 x 220 mm bed)
        this.bedSize = 220;
        this.halfBed = this.bedSize / 2;
        
        this.appliedState = null;
        
        // 3D View State
        this.is3DMode = false;
        this.viewMode3D = 'lines'; // 'lines', 'solid'
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.gcode3DObject = null;
        this.nozzle3D = null;
        this.bed3D = null;
        
        this.init3D();
        this.initEvents();
        this.resizeCanvas();
    }

    saveAppliedState() {
        this.appliedState = {
            temp: this.currentTemp,
            bed: this.currentBed,
            retract: this.currentRetract,
            fan: this.currentFan,
            flow: this.currentFlow,
            speed: this.currentSpeed,
            zoffset: this.currentZOffset,
            xoffset: this.currentXOffset,
            yoffset: this.currentYOffset
        };
        this.checkPendingUpdates();
    }

    checkPendingUpdates() {
        if (!this.appliedState) return;
        
        const checkWidget = (inputId, valId, stateKey, currentVal) => {
            const input = document.getElementById(inputId);
            const valSpan = document.getElementById(valId);
            if (!input) return;
            const widget = input.closest('.widget, .analyse-card');
            if (!widget) return;
            
            // Check for tiny floating point differences, especially for offsets and retracts
            const isDifferent = Math.abs(currentVal - this.appliedState[stateKey]) > 0.001;
            
            if (isDifferent) {
                widget.classList.add('pending-update');
                if (valSpan) valSpan.classList.add('is-modified');
            } else {
                if (valSpan) valSpan.classList.remove('is-modified');
                if (!widget.querySelector('.is-modified')) {
                    widget.classList.remove('pending-update');
                }
            }
        };

        checkWidget('temp-slider', 'temp-val', 'temp', this.currentTemp);
        checkWidget('bed-slider', 'bed-val', 'bed', this.currentBed);
        checkWidget('retract-slider', 'retract-val', 'retract', this.currentRetract);
        checkWidget('fan-slider', 'fan-val', 'fan', this.currentFan);
        checkWidget('speed-slider', 'speed-val', 'speed', this.currentSpeed);
        checkWidget('zoffset-slider', 'zoffset-val', 'zoffset', this.currentZOffset);
        checkWidget('xoffset-slider', 'xoffset-val', 'xoffset', this.currentXOffset);
        checkWidget('yoffset-slider', 'yoffset-val', 'yoffset', this.currentYOffset);
    }

    liveUpdateDebounced() {
        clearTimeout(this.liveUpdateTimer);
        this.liveUpdateTimer = setTimeout(() => {
            if(this.updateTimeUI) this.updateTimeUI();
            this.updateGcodeListAsync();
        }, 150);
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    init3D() {
        const canvas = document.getElementById('gcode-3d-canvas');
        if (!canvas || !window.THREE) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#050506');

        this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 10000);
        this.camera.position.set(0, -300, 250);
        this.camera.up.set(0, 0, 1);

        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
                        
        // Add subtle lights for solid mode
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, -100, 200);
        this.scene.add(dirLight);

        // Grid/Bed
        const grid = new THREE.GridHelper(this.bedSize, 22, 0x444444, 0x222222);
        grid.rotation.x = Math.PI / 2;
        this.scene.add(grid);
        this.bed3D = grid;

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true; // Makes panning feel natural
        
        // Optimize mouse buttons if desired (Left = Rotate, Right = Pan, Middle = Zoom)
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };

        // Start render loop
        const animate = () => {
            requestAnimationFrame(animate);
            if (this.is3DMode) {
                this.controls.update();
                this.renderer.render(this.scene, this.camera);
            }
        };
        animate();
    }

    toggle3DMode(enable3D) {
        this.is3DMode = enable3D;
        const c2d = document.getElementById('gcode-canvas');
        const c3d = document.getElementById('gcode-3d-canvas');
        const selectMode = document.getElementById('view-mode-select');
        const btn2d = document.getElementById('view-2d-btn');
        const btn3d = document.getElementById('view-3d-btn');
        
        if (enable3D) {
            c2d.style.display = 'none';
            c3d.style.display = 'block';
            selectMode.style.display = 'block';
                        btn3d.classList.add('active');
            btn3d.style.background = 'rgba(255,255,255,0.1)';
            btn2d.classList.remove('active');
            btn2d.style.background = 'transparent';
            
            // Resize renderer
            const rect = c3d.parentElement.getBoundingClientRect();
            this.renderer.setSize(rect.width, rect.height - 40); // Rough estimate, resizeCanvas fixes it
            this.resizeCanvas();
            this.rebuild3DScene();
        } else {
            c3d.style.display = 'none';
            c2d.style.display = 'block';
            selectMode.style.display = 'none';
                        btn2d.classList.add('active');
            btn2d.style.background = 'rgba(255,255,255,0.1)';
            btn3d.classList.remove('active');
            btn3d.style.background = 'transparent';
            this.draw(); // Ensure 2D is up to date
        }
    }

    initEvents() {
        // Resize handling
        window.addEventListener('resize', () => this.resizeCanvas());
        const centerPanel = document.querySelector('.center-panel');
        if (centerPanel) {
            new ResizeObserver(() => this.resizeCanvas()).observe(centerPanel);
        }

        // Panel Toggle Buttons
        const toggleLeft = document.getElementById('toggle-left-panel');
        if (toggleLeft) {
            toggleLeft.addEventListener('click', () => {
                const panel = document.querySelector('.left-panel');
                if (panel) {
                    panel.classList.toggle('panel-collapsed');
                    toggleLeft.innerText = panel.classList.contains('panel-collapsed') ? '▶' : '◀';
                }
            });
        }
        
        const toggleRight = document.getElementById('toggle-right-panel');
        if (toggleRight) {
            toggleRight.addEventListener('click', () => {
                const panel = document.querySelector('.right-panel');
                if (panel) {
                    panel.classList.toggle('panel-collapsed');
                    toggleRight.innerText = panel.classList.contains('panel-collapsed') ? '◀' : '▶';
                }
            });
        }

        // Mausrad-Fix für alle Slider und Kinematik-Felder
        document.querySelectorAll('.slider, .k-input').forEach(input => {
            input.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                const step = parseFloat(input.getAttribute('step')) || 1;
                const min = input.hasAttribute('min') ? parseFloat(input.getAttribute('min')) : 0;
                const max = input.hasAttribute('max') ? parseFloat(input.getAttribute('max')) : Infinity;
                let val = parseFloat(input.value) || 0;
                
                if (e.deltaY < 0) {
                    val = Math.min(max, val + step);
                } else {
                    val = Math.max(min, val - step);
                }
                
                input.value = val;
                input.dispatchEvent(new Event('input'));
            }, { passive: false });
        });

        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));

        // File upload
        document.getElementById('file-input').addEventListener('change', (e) => this.onFileLoad(e));
        
        // Drag and Drop (Global)
        const uploadBtnLabel = document.querySelector('label[for="file-input"]');
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (uploadBtnLabel) {
                uploadBtnLabel.style.borderColor = 'var(--accent-hover)';
                uploadBtnLabel.style.backgroundColor = 'rgba(0, 188, 212, 0.2)';
            }
        });
        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (uploadBtnLabel) {
                uploadBtnLabel.style.borderColor = '';
                uploadBtnLabel.style.backgroundColor = '';
            }
        });
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (uploadBtnLabel) {
                uploadBtnLabel.style.borderColor = '';
                uploadBtnLabel.style.backgroundColor = '';
            }
            if (e.dataTransfer && e.dataTransfer.files.length > 0) {
                this.onFileLoad(e);
            }
        });
        
        // Demo Button
        const demoBtn = document.getElementById('demo-btn');
        if (demoBtn) {
           demoBtn.addEventListener('click', () => {
            this.loadDemo();
           });
        }

        document.getElementById('layer-slider').addEventListener('input', (e) => {
            this.currentLayerIdx = parseInt(e.target.value, 10);
            this.playbackIndex = -1;
            this.gcodeCurrentPage = 1; // Reset to page 1 on layer change
            this.updateLayerIndicator();
            this.draw();
            if(this.gcodeViewMode === 'layer') this.updateGcodeListAsync();
        });

        

        // View Mode Listeners
        document.getElementById('view-2d-btn').addEventListener('click', () => this.toggle3DMode(false));
        document.getElementById('view-3d-btn').addEventListener('click', () => this.toggle3DMode(true));
        document.getElementById('view-mode-select').addEventListener('change', (e) => {
            this.viewMode3D = e.target.value;
            this.rebuild3DScene();
        });

        // View Mode Listeners
        document.getElementById('view-2d-btn').addEventListener('click', () => this.toggle3DMode(false));
        document.getElementById('view-3d-btn').addEventListener('click', () => this.toggle3DMode(true));
        document.getElementById('view-mode-select').addEventListener('change', (e) => {
            this.viewMode3D = e.target.value;
            this.rebuild3DScene();
        });

        // Pagination Controls
        const modeSelect = document.getElementById('gcode-view-mode');
        const sizeSelect = document.getElementById('gcode-page-size');
        const prevBtn = document.getElementById('gcode-page-prev');
        const nextBtn = document.getElementById('gcode-page-next');
        
        if(modeSelect) modeSelect.addEventListener('change', (e) => {
            this.gcodeViewMode = e.target.value;
            this.gcodeCurrentPage = 1;
            this.updateGcodeListAsync();
        });
        if(sizeSelect) sizeSelect.addEventListener('change', (e) => {
            this.gcodePageSize = e.target.value;
            this.gcodeCurrentPage = 1;
            this.updateGcodeListAsync();
        });
        if(prevBtn) prevBtn.addEventListener('click', () => {
            if(this.gcodeCurrentPage > 1) {
                this.gcodeCurrentPage--;
                this.updateGcodeListAsync();
            }
        });
        if(nextBtn) nextBtn.addEventListener('click', () => {
            if(this.gcodeCurrentPage < this.gcodeTotalPages) {
                this.gcodeCurrentPage++;
                this.updateGcodeListAsync();
            }
        });

        // Playback controls
        document.getElementById('play-toggle').addEventListener('click', () => {
            if (this.isPlaying) this.pause();
            else this.play();
        });
        document.getElementById('play-step-fwd').addEventListener('click', () => {
            this.pause();
            this.stepForward();
        });
        document.getElementById('play-step-back').addEventListener('click', () => {
            this.pause();
            this.stepBackward();
        });
        document.getElementById('playback-slider').addEventListener('input', (e) => {
            this.pause();
            this.playbackIndex = parseInt(e.target.value, 10);
            this.draw();
        });

        document.getElementById('temp-slider').addEventListener('input', (e) => {
            this.currentTemp = parseInt(e.target.value, 10);
            document.getElementById('temp-val').innerText = `${this.currentTemp} °C`;
        });

        document.getElementById('bed-slider').addEventListener('input', (e) => {
            this.currentBed = parseInt(e.target.value, 10);
            document.getElementById('bed-val').innerText = `${this.currentBed} °C`;
            e.target.classList.add('modified-value');
            this.checkPendingUpdates();
        });

        document.getElementById('retract-slider').addEventListener('input', (e) => {
            this.currentRetract = parseFloat(e.target.value);
            document.getElementById('retract-val').innerText = `${this.currentRetract.toFixed(1)} mm`;
            e.target.classList.add('modified-value');
            this.checkPendingUpdates();
        });

        document.getElementById('fan-slider').addEventListener('input', (e) => {
            this.currentFan = parseInt(e.target.value, 10);
            document.getElementById('fan-val').innerText = `${this.currentFan} %`;
            e.target.classList.add('modified-value');
            this.checkPendingUpdates();
        });



        document.getElementById('speed-slider').addEventListener('input', (e) => {
            this.currentSpeed = parseInt(e.target.value, 10);
            document.getElementById('speed-val').innerText = `${this.currentSpeed} %`;
            e.target.classList.add('modified-value');
            this.checkPendingUpdates();
        });

        document.getElementById('zoffset-slider').addEventListener('input', (e) => {
            this.currentZOffset = parseFloat(e.target.value);
            document.getElementById('zoffset-val').innerText = `${(this.currentZOffset > 0 ? '+' : '')}${this.currentZOffset.toFixed(2)} mm`;
            e.target.classList.add('modified-value');
            this.checkPendingUpdates();
        });

        document.getElementById('xoffset-slider').addEventListener('input', (e) => {
            this.currentXOffset = parseFloat(e.target.value);
            document.getElementById('xoffset-val').innerText = `${(this.currentXOffset > 0 ? '+' : '')}${this.currentXOffset.toFixed(1)} mm`;
            e.target.classList.add('modified-value');
            this.checkPendingUpdates();
        });

        document.getElementById('yoffset-slider').addEventListener('input', (e) => {
            this.currentYOffset = parseFloat(e.target.value);
            document.getElementById('yoffset-val').innerText = `${(this.currentYOffset > 0 ? '+' : '')}${this.currentYOffset.toFixed(1)} mm`;
            e.target.classList.add('modified-value');
            this.checkPendingUpdates();
        });

        // Kinematics Inputs Event Delegation
        document.querySelectorAll('.k-input').forEach(input => {
            input.addEventListener('input', () => {
                input.classList.add('pending-update');
            });
            input.addEventListener('change', () => {
                input.classList.remove('pending-update');
                input.classList.add('modified-value');
            });
        });

        // --- UX ENHANCEMENTS: Scroll-to-change & Manual Input ---
        
        // 1. Hover-Scroll for Sliders
        document.querySelectorAll('.slider').forEach(slider => {
            slider.addEventListener('wheel', (e) => {
                e.preventDefault();
                const step = parseFloat(slider.step) || 1;
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                let val = parseFloat(slider.value);
                
                if (e.deltaY < 0) val += step; // Scroll up -> increase
                else val -= step;              // Scroll down -> decrease
                
                // Fix floating point math errors
                val = Math.round(val * 1000) / 1000;
                slider.value = Math.max(min, Math.min(max, val));
                slider.dispatchEvent(new Event('input'));
            });
        });

        // 2. Hover-Scroll for Number Inputs (Kinematics matrix)
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('wheel', (e) => {
                e.preventDefault();
                const step = parseFloat(input.step) || 1;
                let val = parseFloat(input.value) || 0;
                
                if (e.deltaY < 0) val += step;
                else val -= step;
                
                input.value = Math.max(0, val);
                input.dispatchEvent(new Event('change'));
            });
        });

        // 3. Manual Input via Click on Badges (Inline Edit)
        document.querySelectorAll('.widget-title .accent').forEach(badge => {
            badge.style.cursor = 'pointer';
            badge.title = 'Klicken für manuelle Eingabe';
            
            badge.addEventListener('click', (e) => {
                const slider = badge.parentElement.nextElementSibling;
                if (!slider || !slider.classList.contains('slider')) return;
                
                // Verhindere doppeltes Klicken
                if (badge.querySelector('input')) return;
                
                const currentVal = slider.value;
                const originalHtml = badge.innerHTML;
                
                // Setze temporäres Input-Feld in den Badge
                badge.innerHTML = `<input type="number" value="${currentVal}" step="${slider.step || 1}" style="width: 50px; background: #1b1b22; color: var(--accent-color); border: 1px solid var(--accent-color); border-radius: 4px; padding: 2px 4px; font-family: inherit; font-size: inherit; outline: none; text-align: center;">`;
                
                const input = badge.querySelector('input');
                input.focus();
                input.select(); // Markiere die Zahl sofort zum Überschreiben
                
                const finishEdit = () => {
                    // Falls das Element schon vom Slider-Event überschrieben wurde, abbrechen
                    if (!document.body.contains(input)) return; 
                    
                    const newVal = input.value;
                    if (newVal !== null && newVal.trim() !== '' && !isNaN(newVal)) {
                        const parsed = parseFloat(newVal);
                        const min = parseFloat(slider.min);
                        const max = parseFloat(slider.max);
                        slider.value = Math.max(min, Math.min(max, parsed));
                        
                        // Das Slider-Event feuern (dieses aktualisiert den Badge-Text inkl. Einheit automatisch!)
                        slider.dispatchEvent(new Event('input'));
                    } else {
                        badge.innerHTML = originalHtml;
                    }
                };
                
                input.addEventListener('blur', finishEdit);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') input.blur();
                    if (e.key === 'Escape') badge.innerHTML = originalHtml;
                });
            });
        });

        // G-Code List Event Delegation for Click
        document.getElementById('gcode-view').addEventListener('click', (e) => {
            const li = e.target.closest('.gcode-line');
            if (li) {
                const index = parseInt(li.dataset.index, 10);
                this.selectLine(index);
            }
        });

        // Visuelles Feedback in den Widget-Boxen beim Ändern
        document.querySelectorAll('.slider, .k-input').forEach(input => {
            const handler = (e) => {
                this.checkPendingUpdates();
            };
            input.addEventListener('input', handler);
            input.addEventListener('change', handler);
        });

        // Apply Button Listener
        document.getElementById('apply-btn').addEventListener('click', () => {
            const applyBtn = document.getElementById('apply-btn');
            applyBtn.innerHTML = '<span style="font-size: 1rem; display: flex; align-items: center; line-height: 1;">⏳</span><span>Berechne...</span>';
            applyBtn.disabled = true;
            
            // Mark all pending widgets as actively updating
            document.querySelectorAll('.pending-update').forEach(w => {
                w.classList.add('widget-updating');
                // w.classList.remove('pending-update'); (will be removed by checkPendingUpdates)
            });
            
            this.updateGcodeListAsync().then(() => {
                applyBtn.innerHTML = '<span style="font-size: 1rem; display: flex; align-items: center; line-height: 1;">⚡</span><span>Berechnen</span>';
                applyBtn.disabled = false;
                this.saveAppliedState();
            });
        });

        // Download
        document.getElementById('download-btn').addEventListener('click', () => this.exportGCode());
        
        // Reset Settings
        document.getElementById('reset-btn').addEventListener('click', () => this.resetSettings());
        
        const recalcBtn = document.getElementById('recalc-time-btn');
        if (recalcBtn) {
            recalcBtn.addEventListener('click', async () => {
                if (!this.originalLines || this.originalLines.length === 0) return;
                recalcBtn.innerHTML = 'Berechne...';
                document.querySelectorAll('.k-input').forEach(input => {
                    input.classList.remove('modified-value');
                });
                await this.parseGcodeAsync(true);
                this.updateTimeUI();
                recalcBtn.innerHTML = 'Berechnet ✓';
                setTimeout(() => recalcBtn.innerHTML = 'Druckzeit neu berechnen', 2000);
            });
        }
        
        const resetKBtn = document.getElementById('reset-kinematics-btn');
        if (resetKBtn) {
            resetKBtn.addEventListener('click', async () => {
                if (this.initialKinematicsInputs) {
                    for (const [id, val] of Object.entries(this.initialKinematicsInputs)) {
                        const el = document.getElementById(id);
                        if (el) {
                            el.value = val;
                            el.classList.remove('modified-value');
                        }
                    }
                    if (this.originalLines && this.originalLines.length > 0) {
                        await this.parseGcodeAsync(true);
                        this.updateTimeUI();
                    }
                }
            });
        }
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.tab).style.display = 'flex';
            });
        });

        // Modifikationen Filter
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const filter = e.target.dataset.filter;
                const modView = document.getElementById('mod-view');
                
                // Reset all filter classes
                modView.className = 'gcode-list';
                
                if (filter !== 'all') {
                    modView.classList.add(`filter-${filter}`);
                }
            });
        });

        // Color Mode & Travel Mode
        // Color Mode & Travel Mode
        const colorModeGroup = document.getElementById('color-mode-group');
        if (colorModeGroup) {
            const btns = colorModeGroup.querySelectorAll('.mode-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    btns.forEach(b => {
                        b.classList.remove('active');
                        b.style.background = 'transparent';
                    });
                    btn.classList.add('active');
                    btn.style.background = 'var(--accent-color)';
                    
                    this.colorMode = btn.dataset.mode;
                    const legend = document.getElementById('heatmap-legend');
                    const lLow = document.getElementById('legend-low');
                    const lHigh = document.getElementById('legend-high');
                    if (legend) {
                        if (this.colorMode === 'heatmap') {
                            legend.style.display = 'flex';
                            if (lLow) { lLow.setAttribute('data-i18n', 'view.speed_low'); lLow.innerText = window.t ? window.t('view.speed_low') : '10 mm/s'; }
                            if (lHigh) { lHigh.setAttribute('data-i18n', 'view.speed_high'); lHigh.innerText = window.t ? window.t('view.speed_high') : '50+ mm/s'; }
                        } else {
                            legend.style.display = 'none';
                        }
                    }
                    this.rebuild3DScene();
                    this.draw();
                });
            });
        }
        
        const showTravelBtn = document.getElementById('show-travel-btn');
        if (showTravelBtn) {
            showTravelBtn.addEventListener('change', (e) => {
                this.showTravelMoves = e.target.checked;
                this.rebuild3DScene();
                this.draw();
            });
        }
    }

    resetSettings(skipUpdate = false) {
        // Falls noch keine Datei geladen wurde, nutze Fallbacks
        this.currentTemp = this.defaultTemp !== undefined ? this.defaultTemp : 205;
        this.currentBed = this.defaultBed !== undefined ? this.defaultBed : 60;
        this.currentRetract = this.defaultRetract !== undefined ? this.defaultRetract : 0.8;
        this.currentFan = this.defaultFan !== undefined ? this.defaultFan : 100;
        this.currentFlow = this.defaultFlow !== undefined ? this.defaultFlow : 100;
        this.currentSpeed = this.defaultSpeed !== undefined ? this.defaultSpeed : 100;
        this.currentZOffset = this.defaultZOffset !== undefined ? this.defaultZOffset : 0.00;
        this.currentXOffset = 0.0;
        this.currentYOffset = 0.0;
        
        // Settings
        this.colorMode = 'normal';
        this.showTravelMoves = false;

        document.getElementById('temp-slider').value = this.currentTemp;
        document.getElementById('temp-val').innerText = `${this.currentTemp} °C`;
        
        document.getElementById('bed-slider').value = this.currentBed;
        document.getElementById('bed-val').innerText = `${this.currentBed} °C`;
        
        document.getElementById('retract-slider').value = this.currentRetract;
        document.getElementById('retract-val').innerText = `${this.currentRetract} mm`;
        
        document.getElementById('fan-slider').value = this.currentFan;
        document.getElementById('fan-val').innerText = `${this.currentFan} %`;
        
        document.getElementById('speed-slider').value = this.currentSpeed;
        document.getElementById('speed-val').innerText = `${this.currentSpeed} %`;
        
        document.getElementById('zoffset-slider').value = this.currentZOffset;
        document.getElementById('zoffset-val').innerText = `0.00 mm`;
        
        document.getElementById('xoffset-slider').value = this.currentXOffset;
        document.getElementById('xoffset-val').innerText = `0.0 mm`;
        
        document.getElementById('yoffset-slider').value = this.currentYOffset;
        document.getElementById('yoffset-val').innerText = `0.0 mm`;

        if (!skipUpdate) {
            this.updateGcodeListAsync().then(() => this.saveAppliedState());
        } else {
            this.saveAppliedState();
        }
        
    }

    resizeCanvas() {
        // Resize 2D Canvas
        this.canvas.width = this.canvas.parentElement.clientWidth;
        // Adjust for the control bar height manually or let flex handle it (flex is handling it, but we need the actual height)
        this.canvas.height = this.canvas.parentElement.clientHeight;
        
        // Resize 3D Canvas
        if (this.renderer) {
            const c3d = document.getElementById('gcode-3d-canvas');
            if (c3d && c3d.parentElement) {
                const rect = c3d.parentElement.getBoundingClientRect();
                this.camera.aspect = rect.width / rect.height;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(rect.width, rect.height);
            }
        }
        
        this.draw();
    }

    // --- Mouse Event Handlers ---
    onMouseDown(e) {
        this.isMouseDown = true;
        this.wasDragging = false;
        this.startX = e.clientX - this.offsetX;
        this.startY = e.clientY - this.offsetY;
    }

    onMouseMove(e) {
        if (!this.isMouseDown) return;
        this.wasDragging = true;
        this.offsetX = e.clientX - this.startX;
        this.offsetY = e.clientY - this.startY;
        this.draw();
    }

    onMouseUp(e) {
        this.isMouseDown = false;
    }

    onMouseLeave(e) {
        this.isMouseDown = false;
        this.wasDragging = false;
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            this.scale *= zoomFactor;
        } else {
            this.scale /= zoomFactor;
        }
        this.scale = Math.max(0.2, Math.min(this.scale, 20));
        this.draw();
    }

    onClick(e) {
        if (this.wasDragging) {
            this.wasDragging = false;
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - (this.canvas.width / 2 + this.offsetX)) / this.scale - this.currentXOffset;
        const worldY = -((mouseY - (this.canvas.height / 2 + this.offsetY)) / this.scale) - this.currentYOffset;
        const threshold = 5 / this.scale; 
        
        let closestPath = null;
        let minDistance = Infinity;

        if (this.layerList.length > 0) {
            const paths = this.layerList[this.currentLayerIdx].paths;

            for (const path of paths) {
                const d = this.distanceToSegment(worldX, worldY, path.x1, path.y1, path.x2, path.y2);
                if (d <= threshold && d < minDistance) {
                    minDistance = d;
                    closestPath = path;
                }
            }
        }

        if (closestPath) {
            this.selectLine(closestPath.lineIndex);
        }
    }

    distanceToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        return Math.hypot(px - projX, py - projY);
    }

    // --- Logic & Parsing ---
    async loadDemo() {
        const hero = document.getElementById('welcome-hero');
        if (hero) hero.style.display = 'none';
        const seoText = document.querySelector('.seo-content');
        if (seoText) seoText.style.display = 'none';
        
        // Slide up the control bar smoothly
        const controlBar = document.getElementById('main-control-bar');
        if (controlBar) {
            controlBar.style.maxHeight = '300px';
            controlBar.style.opacity = '1';
            controlBar.style.transform = 'translateY(0)';
            controlBar.style.padding = '15px 25px';
            controlBar.style.borderTop = '1px solid var(--border-color)';
        }
        const overlay = document.getElementById('loading-overlay');
        const overlayText = document.querySelector('.loading-text');
        if (overlay) overlay.classList.add('visible');
        if (overlayText) overlayText.innerText = 'Lade Demo G-Code...';
        
        try {
            let demoGcode = window.demoGcode;
            if (!demoGcode) {
                // Fallback to fetch if window.demoGcode is not injected
                const response = await fetch('gcode/example_layerspy.gcode');
                if (!response.ok) throw new Error('Demo file not found');
                demoGcode = await response.text();
            }
            
            setTimeout(async () => {
                try {
                this.originalLines = demoGcode.split(/\r?\n/);
                this.slicerBaseTime = 0;
                this.originalJsTime = null;
                
                await this.parseGcodeAsync();
                await this.updateGcodeListAsync();
                this.saveAppliedState();
                
                document.getElementById('download-btn').disabled = false;
                if (overlay) overlay.classList.remove('visible');
            } catch(err) {
                alert("ERROR: " + err.message);
                console.error(err);
                if (overlay) overlay.classList.remove('visible');
            }
        }, 50);
        } catch(e) {
            console.error(e);
            if (overlay) overlay.classList.remove('visible');
            alert("Konnte Demo-Datei nicht laden. Läuft das Projekt über einen Webserver?");
        }
    }

    onFileLoad(e) {
        let file;
        if (e.dataTransfer && e.dataTransfer.files) {
            file = e.dataTransfer.files[0];
        } else if (e.target && e.target.files) {
            file = e.target.files[0];
        }
        if (!file) return;
        
        // Allow only .gcode files
        if (!file.name.toLowerCase().endsWith('.gcode')) {
            alert('Bitte nur .gcode Dateien hochladen!');
            return;
        }

        const hero = document.getElementById('welcome-hero');
        if (hero) hero.style.display = 'none';
        const seoText = document.querySelector('.seo-content');
        if (seoText) seoText.style.display = 'none';
        
        // Slide up the control bar smoothly
        const controlBar = document.getElementById('main-control-bar');
        if (controlBar) {
            controlBar.style.maxHeight = '300px';
            controlBar.style.opacity = '1';
            controlBar.style.transform = 'translateY(0)';
            controlBar.style.padding = '15px 25px';
            controlBar.style.borderTop = '1px solid var(--border-color)';
        }
        const overlay = document.getElementById('loading-overlay');
        const overlayText = document.querySelector('.loading-text');
        overlay.classList.add('visible');
        overlayText.innerText = 'Lese Datei...';
        
        const canvas = document.getElementById('gcode-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                await new Promise(r => setTimeout(r, 50));
                
                this.originalLines = text.split(/\r?\n/);
                this.slicerBaseTime = 0;
                this.originalJsTime = null;
                
                await this.parseGcodeAsync();
                await this.updateGcodeListAsync();
                this.saveAppliedState();
                
                document.getElementById('download-btn').disabled = false;
                overlay.classList.remove('visible');
            } catch(err) {
                alert("ERROR: " + err.message + "\n" + err.stack);
                console.error(err);
                overlay.classList.remove('visible');
            }
        };
        reader.readAsText(file);
    }

    async parseGcodeAsync(forceRecalc = false) {
        const overlayText = document.querySelector('.loading-text');
        overlayText.innerText = 'Starte Analyse...';
        
        // Memory cleanup before massive allocation
        if (this.layerList) this.layerList.length = 0;
        
        return new Promise((resolve, reject) => {
            const k = {
                vmax: {
                    x: parseFloat(document.getElementById('k-vmax-x').value) || 500,
                    y: parseFloat(document.getElementById('k-vmax-y').value) || 500,
                    z: parseFloat(document.getElementById('k-vmax-z').value) || 10,
                    e: parseFloat(document.getElementById('k-vmax-e').value) || 50
                },
                accel: {
                    print: parseFloat(document.getElementById('k-accel-x').value) || 1000,
                    travel: parseFloat(document.getElementById('k-taccel-x').value) || 1500,
                    z: parseFloat(document.getElementById('k-accel-z').value) || 100,
                    e: parseFloat(document.getElementById('k-accel-e').value) || 5000
                },
                jerk: {
                    x: parseFloat(document.getElementById('k-jerk-x').value) || 8,
                    y: parseFloat(document.getElementById('k-jerk-y').value) || 8,
                    z: parseFloat(document.getElementById('k-jerk-z').value) || 0.4,
                    e: parseFloat(document.getElementById('k-jerk-e').value) || 5
                }
            };

            
            const workerBlob = new Blob([`self.onmessage = function(e) {
    const { lines, k, halfBed, forceRecalc } = e.data;
    
    let foundTemp = null;
    let foundBed = null;
    let foundRetract = null;
    let foundFan = null;
    let slicerBaseTime = 0;
    
    let foundK = {
        vmax: {x: null, y: null, z: null, e: null},
        accel: {x: null, y: null, z: null, e: null},
        jerk: {x: null, y: null, z: null, e: null},
        taccel: null
    };
    
    // Pass 1: Find Defaults and Kinematics
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const c1 = line[0];
        if (c1 !== 'M' && c1 !== ';' && c1 !== 'G' && c1 !== 'E') continue;

        const cleanLine = line.trim().toUpperCase();
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('time') && lowerLine.startsWith(';')) {
            if (lowerLine.includes('estimated printing time (normal mode) =')) {
                const match = lowerLine.match(/estimated printing time (normal mode) = (?:([0-9]+)ds*)?(?:([0-9]+)hs*)?(?:([0-9]+)ms*)?(?:([0-9]+)ss*)?/);
                if (match) {
                    const d = parseInt(match[1]) || 0;
                    const h = parseInt(match[2]) || 0;
                    const m = parseInt(match[3]) || 0;
                    const s = parseInt(match[4]) || 0;
                    const parsedSec = d * 86400 + h * 3600 + m * 60 + s;
                    if (parsedSec > 0 && slicerBaseTime === 0) slicerBaseTime = parsedSec;
                }
            }
            const curaMatch = lowerLine.match(/;time:([0-9]+)/);
            if (curaMatch) slicerBaseTime = parseInt(curaMatch[1]);
        }
        
        // Prusa/SuperSlicer Kinematics comments
        if (c1 === ';') {
            if (lowerLine.startsWith('; machine_max_acceleration_x = ')) {
                foundK.accel.x = parseFloat(lowerLine.split('=')[1]);
                foundK.accel.print = foundK.accel.x;
            } else if (lowerLine.startsWith('; machine_max_acceleration_y = ')) {
                foundK.accel.y = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_acceleration_z = ')) {
                foundK.accel.z = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_acceleration_e = ')) {
                foundK.accel.e = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_feedrate_x = ')) {
                foundK.vmax.x = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_feedrate_y = ')) {
                foundK.vmax.y = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_feedrate_z = ')) {
                foundK.vmax.z = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_feedrate_e = ')) {
                foundK.vmax.e = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_jerk_x = ')) {
                foundK.jerk.x = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_jerk_y = ')) {
                foundK.jerk.y = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_jerk_z = ')) {
                foundK.jerk.z = parseFloat(lowerLine.split('=')[1]);
            } else if (lowerLine.startsWith('; machine_max_jerk_e = ')) {
                foundK.jerk.e = parseFloat(lowerLine.split('=')[1]);
            }
            continue;
        }

        if (foundTemp === null && (cleanLine.startsWith('M104') || cleanLine.startsWith('M109'))) {
            const match = cleanLine.match(/S([0-9.]+)/);
            if (match) foundTemp = parseInt(match[1], 10);
        }
        if (foundBed === null && (cleanLine.startsWith('M140') || cleanLine.startsWith('M190'))) {
            const match = cleanLine.match(/S([0-9.]+)/);
            if (match) foundBed = parseInt(match[1], 10);
        }
        if (foundFan === null && cleanLine.startsWith('M106')) {
            const match = cleanLine.match(/S([0-9]+)/);
            if (match) foundFan = Math.round((parseInt(match[1], 10) / 255) * 100);
        }
        if (foundRetract === null && cleanLine.match(/E-[0-9.]+/)) {
            const match = cleanLine.match(/E-([0-9.]+)/);
            if (match) foundRetract = parseFloat(match[1]);
        }
        
        // Kinematics overrides from file
        if (cleanLine.startsWith('M203 ')) {
            const x = cleanLine.match(/X([0-9.]+)/); if(x) foundK.vmax.x = parseFloat(x[1]);
            const y = cleanLine.match(/Y([0-9.]+)/); if(y) foundK.vmax.y = parseFloat(y[1]);
            const z = cleanLine.match(/Z([0-9.]+)/); if(z) foundK.vmax.z = parseFloat(z[1]);
            const e = cleanLine.match(/E([0-9.]+)/); if(e) foundK.vmax.e = parseFloat(e[1]);
        }
        if (cleanLine.startsWith('M201 ')) {
            const x = cleanLine.match(/X([0-9.]+)/); if(x) foundK.accel.x = parseFloat(x[1]);
            const y = cleanLine.match(/Y([0-9.]+)/); if(y) foundK.accel.y = parseFloat(y[1]);
            const z = cleanLine.match(/Z([0-9.]+)/); if(z) foundK.accel.z = parseFloat(z[1]);
            const e = cleanLine.match(/E([0-9.]+)/); if(e) foundK.accel.e = parseFloat(e[1]);
        }
        if (cleanLine.startsWith('M204 ')) {
            const p = cleanLine.match(/P([0-9.]+)/);
            const t = cleanLine.match(/T([0-9.]+)/);
            const s = cleanLine.match(/S([0-9.]+)/);
            if(p) { foundK.accel.x = parseFloat(p[1]); foundK.accel.y = parseFloat(p[1]); }
            if(s) { foundK.accel.x = parseFloat(s[1]); foundK.accel.y = parseFloat(s[1]); }
            if(t) foundK.taccel = parseFloat(t[1]);
        }
        if (cleanLine.startsWith('M205 ')) {
            const x = cleanLine.match(/X([0-9.]+)/); if(x) foundK.jerk.x = parseFloat(x[1]);
            const y = cleanLine.match(/Y([0-9.]+)/); if(y) foundK.jerk.y = parseFloat(y[1]);
            const z = cleanLine.match(/Z([0-9.]+)/); if(z) foundK.jerk.z = parseFloat(z[1]);
            const e = cleanLine.match(/E([0-9.]+)/); if(e) foundK.jerk.e = parseFloat(e[1]);
        }
    }

    // Apply file overrides to K ONLY on initial load
    if (!forceRecalc) {
        if (foundK.vmax.x !== null) k.vmax.x = foundK.vmax.x;
        if (foundK.vmax.y !== null) k.vmax.y = foundK.vmax.y;
        if (foundK.vmax.z !== null) k.vmax.z = foundK.vmax.z;
        if (foundK.vmax.e !== null) k.vmax.e = foundK.vmax.e;

        if (foundK.accel.x !== null) k.accel.print = foundK.accel.x;
        if (foundK.taccel !== null) k.accel.travel = foundK.taccel;
        else if (foundK.accel.y !== null) k.accel.travel = foundK.accel.y;
        if (foundK.accel.z !== null) k.accel.z = foundK.accel.z;
        if (foundK.accel.e !== null) k.accel.e = foundK.accel.e;

        if (foundK.jerk.x !== null) k.jerk.x = foundK.jerk.x;
        if (foundK.jerk.y !== null) k.jerk.y = foundK.jerk.y;
        if (foundK.jerk.z !== null) k.jerk.z = foundK.jerk.z;
        if (foundK.jerk.e !== null) k.jerk.e = foundK.jerk.e;
    }

    let layerList = [{ z: 0, paths: [] }];
    let currentZ = 0;
    let lastX = 0, lastY = 0, tempX = 0, tempY = 0;
    let lastExtrusionZ = -999;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let maxZ = 0;
    let totalE = 0, totalRetracts = 0;
    let currentF = 3000;
    let currentFeatureType = 'Unknown';
    let estimatedPrintTimeSeconds = 0;
    let lastDx = 0, lastDy = 0, lastLineDist = 0, lastE = 0;
    let isRelativeE = false;

    const totalLines = lines.length;
    const chunkSize = 20000;

    let processChunk = function(startIndex) {
        const chunkEnd = Math.min(startIndex + chunkSize, totalLines);
        for(let j = startIndex; j < chunkEnd; j++) {
            const cleanLine = lines[j].trim();
            if (cleanLine.startsWith(';')) {
                if (cleanLine.toUpperCase().startsWith(';TYPE:')) {
                    currentFeatureType = cleanLine.substring(6).trim();
                } else if (cleanLine.toUpperCase().startsWith('; TYPE:')) {
                    currentFeatureType = cleanLine.substring(7).trim();
                }
                continue;
            }

            if (cleanLine === 'M83') isRelativeE = true;
            if (cleanLine === 'M82') isRelativeE = false;
            if (cleanLine.startsWith('G92') && cleanLine.includes('E')) {
                const g92E = cleanLine.match(/E([-+]?[0-9]*.?[0-9]+)/);
                if (g92E) lastE = parseFloat(g92E[1]);
            }

            const isExtruding = cleanLine.includes('E') && !cleanLine.includes('E-');
            
            const xMatch = cleanLine.match(/X([-+]?[0-9]*.?[0-9]+)/);
            const yMatch = cleanLine.match(/Y([-+]?[0-9]*.?[0-9]+)/);
            const zMatch = cleanLine.match(/Z([-+]?[0-9]*.?[0-9]+)/);
            const eMatch = cleanLine.match(/E([-+]?[0-9]*.?[0-9]+)/);
            const fMatch = cleanLine.match(/F([-+]?[0-9]*.?[0-9]+)/);

            if (fMatch) currentF = parseFloat(fMatch[1]);
            if (zMatch) {
                currentZ = parseFloat(zMatch[1]);
                if (currentZ > maxZ) maxZ = currentZ;
            }
            
            if (xMatch) tempX = parseFloat(xMatch[1]) - halfBed;
            if (yMatch) tempY = parseFloat(yMatch[1]) - halfBed;

            if (cleanLine.startsWith('G1') || cleanLine.startsWith('G0')) {
                const dx = tempX - lastX;
                const dy = tempY - lastY;
                let lineDist = Math.sqrt(dx*dx + dy*dy);
                
                if (zMatch) {
                    const dz = currentZ - (lastExtrusionZ === -999 ? 0 : lastExtrusionZ);
                    lineDist = Math.max(lineDist, Math.abs(dz));
                }
                
                if (currentF > 0 && lineDist > 0) {
                    const isTravel = !isExtruding;
                    let v_req = currentF / 60; 
                    let accel = isTravel ? k.accel.travel : k.accel.print;
                    
                    if (zMatch && dx === 0 && dy === 0) {
                        v_req = Math.min(v_req, k.vmax.z);
                        accel = k.accel.z;
                    } else {
                        v_req = Math.min(v_req, Math.min(k.vmax.x, k.vmax.y));
                    }

                    let cosTheta = 0;
                    if (lineDist > 0 && lastLineDist > 0) {
                        const dot = (dx * lastDx + dy * lastDy) / (lineDist * lastLineDist);
                        cosTheta = Math.max(-1, Math.min(1, dot));
                    }
                    
                    let jerk = k.jerk.x;
                    let v_c = jerk;
                    
                    if (cosTheta > 0.99) v_c = v_req;
                    else if (cosTheta > 0) v_c = jerk + (v_req - jerk) * (cosTheta * cosTheta);
                    v_c = Math.min(v_c, v_req);

                    const v_diff = v_req - v_c;
                    const t_accel_decel = 2 * (v_diff / accel);
                    const d_accel_decel = (v_req * v_req - v_c * v_c) / accel;

                    if (d_accel_decel > lineDist) {
                        const max_v = Math.sqrt(v_c * v_c + accel * lineDist);
                        estimatedPrintTimeSeconds += 2 * (max_v - v_c) / accel;
                    } else {
                        const d_cruise = lineDist - d_accel_decel;
                        const t_cruise = d_cruise / v_req;
                        estimatedPrintTimeSeconds += t_accel_decel + t_cruise;
                    }
                }
                
                if (xMatch) {
                    const realX = tempX + halfBed;
                    if (realX < minX) minX = realX;
                    if (realX > maxX) maxX = realX;
                }
                if (yMatch) {
                    const realY = tempY + halfBed;
                    if (realY < minY) minY = realY;
                    if (realY > maxY) maxY = realY;
                }
                
                let currentDeltaE = 0;
                if (eMatch) {
                    const eVal = parseFloat(eMatch[1]);
                    if (isRelativeE) {
                        currentDeltaE = eVal;
                        if (eVal > 0) totalE += eVal;
                        else if (eVal < 0) totalRetracts++;
                    } else {
                        currentDeltaE = eVal - lastE;
                        if (eVal > lastE) totalE += (eVal - lastE);
                        else if (eVal < lastE) totalRetracts++;
                        lastE = eVal;
                    }
                }

                lastDx = dx; lastDy = dy; lastLineDist = lineDist;

                if (isExtruding && Math.abs(currentZ - lastExtrusionZ) > 0.001) {
                    lastExtrusionZ = currentZ;
                    if (layerList.length === 1 && !layerList[0].paths.some(p => p.type === 'extrude')) {
                        layerList[0].z = currentZ;
                    } else {
                        layerList.push({ z: currentZ, paths: [] });
                    }
                }

                // Skip zero-length or extremely short extrusions to prevent circle artifacts (moiré/dots)
                const deltaX = tempX - lastX;
                const deltaY = tempY - lastY;
                const isZeroLength = Math.abs(deltaX) < 0.0001 && Math.abs(deltaY) < 0.0001;
                
                if (!isExtruding || !isZeroLength) {
                    layerList[layerList.length - 1].paths.push({
                        lineIndex: j,
                        type: isExtruding ? 'extrude' : 'travel',
                        featureType: currentFeatureType,
                        x1: lastX, y1: lastY,
                        x2: tempX, y2: tempY,
                        feedrate: currentF
                    });
                }

                lastX = tempX; lastY = tempY;
            }
        }

        const percent = Math.round((chunkEnd / totalLines) * 100);
        self.postMessage({ type: 'progress', percent: percent });

        if (chunkEnd < totalLines) {
            setTimeout(() => processChunk(chunkEnd), 0);
        } else {
            finalize();
        }
    };

    let finalize = function() {
        layerList = layerList.filter(l => l.paths.length > 0);

        // Removed flow logic

        let finalTimeSec = estimatedPrintTimeSeconds;
        if (slicerBaseTime > 0 && estimatedPrintTimeSeconds > 0 && !forceRecalc) {
            finalTimeSec = slicerBaseTime; 
        }

        const stats = {
            minX: minX === Infinity ? 0 : minX,
            maxX: maxX === -Infinity ? 0 : maxX,
            minY: minY === Infinity ? 0 : minY,
            maxY: maxY === -Infinity ? 0 : maxY,
            maxZ: maxZ,
            totalE: totalE,
            totalRetracts: totalRetracts,
            originalPrintTimeSec: finalTimeSec,
            estimatedPrintTimeSeconds: estimatedPrintTimeSeconds
        };

        const defaults = {
            foundTemp, foundBed, foundFan, foundRetract, slicerBaseTime
        };

        self.postMessage({
            type: 'done',
            layerList: layerList,
            stats: stats,
            defaults: defaults,
            foundK: foundK
        });
    };

    processChunk(0);
};
`], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(workerBlob);

            const worker = new Worker(workerUrl);
            worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'progress') {
                    if (overlayText) overlayText.innerText = `Analysiere Geometrie... ${msg.percent}%`;
                } else if (msg.type === 'done') {
                    this.layerList = msg.layerList;
                    
                    if (!forceRecalc) {
                        const kDefaults = {
                            'k-vmax-x': 500, 'k-vmax-y': 500, 'k-vmax-z': 10, 'k-vmax-e': 50,
                            'k-accel-x': 1000, 'k-accel-y': 1000, 'k-accel-z': 100, 'k-accel-e': 5000,
                            'k-taccel-x': 1500, 'k-taccel-y': 1500, 'k-taccel-z': 100, 'k-taccel-e': 5000,
                            'k-jerk-x': 8, 'k-jerk-y': 8, 'k-jerk-z': 0.4, 'k-jerk-e': 5
                        };
                        for (const [id, val] of Object.entries(kDefaults)) {
                            const el = document.getElementById(id);
                            if (el) { el.value = val; el.classList.remove('modified-value'); }
                        }
                        
                        const foundK = msg.foundK;
                        if (foundK.vmax.x !== null) document.getElementById('k-vmax-x').value = foundK.vmax.x;
                        if (foundK.vmax.y !== null) document.getElementById('k-vmax-y').value = foundK.vmax.y;
                        if (foundK.vmax.z !== null) document.getElementById('k-vmax-z').value = foundK.vmax.z;
                        if (foundK.vmax.e !== null) document.getElementById('k-vmax-e').value = foundK.vmax.e;
                        if (foundK.accel.x !== null) {
                            document.getElementById('k-accel-x').value = foundK.accel.x;
                            document.getElementById('k-taccel-x').value = foundK.taccel !== null ? foundK.taccel : foundK.accel.x;
                        }
                        if (foundK.accel.y !== null) {
                            document.getElementById('k-accel-y').value = foundK.accel.y;
                            document.getElementById('k-taccel-y').value = foundK.taccel !== null ? foundK.taccel : foundK.accel.y;
                        }
                        if (foundK.accel.z !== null) {
                            document.getElementById('k-accel-z').value = foundK.accel.z;
                            document.getElementById('k-taccel-z').value = foundK.accel.z;
                        }
                        if (foundK.accel.e !== null) {
                            document.getElementById('k-accel-e').value = foundK.accel.e;
                            document.getElementById('k-taccel-e').value = foundK.accel.e;
                        }
                        if (foundK.jerk.x !== null) document.getElementById('k-jerk-x').value = foundK.jerk.x;
                        if (foundK.jerk.y !== null) document.getElementById('k-jerk-y').value = foundK.jerk.y;
                        if (foundK.jerk.z !== null) document.getElementById('k-jerk-z').value = foundK.jerk.z;
                        if (foundK.jerk.e !== null) document.getElementById('k-jerk-e').value = foundK.jerk.e;
                    }
            
                    if (!forceRecalc) {
                        const d = msg.defaults;
                        this.defaultTemp = d.foundTemp !== null ? d.foundTemp : 205;
                        this.defaultBed = d.foundBed !== null ? d.foundBed : 60;
                        this.originalTempFound = d.foundTemp !== null;
                        this.originalBedFound = d.foundBed !== null;
                        this.originalFanFound = d.foundFan !== null;
                        this.defaultFan = d.foundFan !== null ? d.foundFan : 100;
                        this.originalRetractFound = d.foundRetract !== null;
                        this.defaultRetract = d.foundRetract !== null ? d.foundRetract : 0.8;
                        this.slicerBaseTime = d.slicerBaseTime;
                        this.defaultFlow = d.foundFlow !== null && d.foundFlow !== undefined ? d.foundFlow : 100;
                        this.defaultSpeed = d.foundSpeed !== null && d.foundSpeed !== undefined ? d.foundSpeed : 100;
                        this.defaultZOffset = d.foundZOffset !== null && d.foundZOffset !== undefined ? d.foundZOffset : 0.00;
                        
                        this.resetSettings(true);
                    }
                    
                    this.stats = msg.stats;
                    
                    this.selectedLineIndex = -1;
                    
                    if (!forceRecalc) {
                        this.originalJsTime = msg.stats.estimatedPrintTimeSeconds;
                        this.initialKinematicsInputs = {};
                        document.querySelectorAll('.k-input').forEach(input => {
                            this.initialKinematicsInputs[input.id] = input.value;
                            input.classList.remove('modified-value');
                        });
                    }
                    
                    this.updateStatsUI();
                    
                    const slider = document.getElementById('layer-slider');
                    slider.max = Math.max(0, this.layerList.length - 1);
                    slider.value = 0;
                    this.currentLayerIdx = 0;
                    
                    this.updateLayerIndicator();
                    
                    this.rebuild3DScene();
                    this.draw();
                    
                    this.runLinter();
                    
                    worker.terminate();
                    resolve();
                }
            };
            
            worker.onerror = (err) => {
                worker.terminate();
                reject(err);
            };
            
            worker.postMessage({
                lines: this.originalLines,
                k: k,
                halfBed: this.halfBed,
                forceRecalc: forceRecalc
            });
        });
    }

    modifyLine(originalLine, flowFactor, speedFactor) {
        let tempLine = originalLine;
        let modTypes = [];
        
        if (tempLine.trim() === '' || tempLine.trim().startsWith(';')) return { text: tempLine, types: [] };

        if (this.currentTemp !== this.defaultTemp && (tempLine.match(/\bM104\b/) || tempLine.match(/\bM109\b/))) {
            tempLine = tempLine.replace(/S\s*[0-9.]+/, `S${this.currentTemp}`);
            modTypes.push('temp');
        }
        
        if (this.currentBed !== this.defaultBed && (tempLine.match(/\bM140\b/) || tempLine.match(/\bM190\b/))) {
            tempLine = tempLine.replace(/S\s*[0-9.]+/, `S${this.currentBed}`);
            modTypes.push('bed');
        }

        if (this.currentFan !== this.defaultFan && tempLine.match(/\bM106\b/)) {
            if (tempLine.includes('S')) {
                tempLine = tempLine.replace(/S\s*[0-9.]+/, `S${Math.round((this.currentFan / 100.0) * 255)}`);
            } else {
                tempLine += ` S${Math.round((this.currentFan / 100.0) * 255)}`;
            }
            modTypes.push('fan');
        }

        // Only modify negative E (retracts) if the user changed the retract slider
        if (this.currentRetract !== this.defaultRetract && tempLine.match(/E\s*-[0-9.]+/)) {
            tempLine = tempLine.replace(/E\s*-[0-9.]+/, `E-${this.currentRetract}`);
            modTypes.push('retract');
        }
        else if (this.currentFlow !== 100 && tempLine.match(/E([0-9.]+)/)) {
            tempLine = tempLine.replace(/E([0-9.]+)/, (match, p1) => {
                return `E${(parseFloat(p1) * flowFactor).toFixed(5)}`;
            });
            modTypes.push('flow');
        }

        if (this.currentSpeed !== 100 && tempLine.match(/F([0-9.]+)/)) {
            tempLine = tempLine.replace(/F([0-9.]+)/, (match, p1) => {
                return `F${(parseFloat(p1) * speedFactor).toFixed(1)}`;
            });
            modTypes.push('speed');
        }
        
        let modified = tempLine;
        if (this.currentXOffset !== 0.0) {
            const xMatch = modified.match(/X([-+]?[0-9]*\.?[0-9]+)/);
            if (xMatch) {
                const newX = parseFloat(xMatch[1]) + this.currentXOffset;
                modified = modified.replace(/X[-+]?[0-9]*\.?[0-9]+/, `X${newX.toFixed(3)}`);
                if (!modTypes.includes('offset')) modTypes.push('offset');
            }
        }
        if (this.currentYOffset !== 0.0) {
            const yMatch = modified.match(/Y([-+]?[0-9]*\.?[0-9]+)/);
            if (yMatch) {
                const newY = parseFloat(yMatch[1]) + this.currentYOffset;
                modified = modified.replace(/Y[-+]?[0-9]*\.?[0-9]+/, `Y${newY.toFixed(3)}`);
                if (!modTypes.includes('offset')) modTypes.push('offset');
            }
        }
        if (this.currentZOffset !== 0.0) {
            const zMatch = modified.match(/Z([-+]?[0-9]*\.?[0-9]+)/);
            if (zMatch) {
                const newZ = parseFloat(zMatch[1]) + this.currentZOffset;
                modified = modified.replace(/Z[-+]?[0-9]*\.?[0-9]+/, `Z${newZ.toFixed(3)}`);
                if (!modTypes.includes('offset')) modTypes.push('offset');
            }
        }

        return { text: modified, types: modTypes };
    }

      async updateGcodeListAsync() {
        if (this.originalLines.length === 0) {
            document.querySelectorAll('.widget-updating').forEach(w => w.classList.remove('widget-updating'));
            return;
        }
        
        const hero = document.getElementById('welcome-hero');
        if (hero) hero.style.display = 'none';
        const seoText = document.querySelector('.seo-content');
        if (seoText) seoText.style.display = 'none';
        
        // Slide up the control bar smoothly
        const controlBar = document.getElementById('main-control-bar');
        if (controlBar) {
            controlBar.style.maxHeight = '300px';
            controlBar.style.opacity = '1';
            controlBar.style.transform = 'translateY(0)';
            controlBar.style.padding = '15px 25px';
            controlBar.style.borderTop = '1px solid var(--border-color)';
        }
        const overlay = document.getElementById('loading-overlay');
        const overlayText = document.querySelector('.loading-text');
        
        let isInitialLoad = overlay.classList.contains('visible');
        
        let activeLoaderText = null;
        if (!isInitialLoad && this.lastActiveWidget) {
            let loaderSpan = this.lastActiveWidget.querySelector('.inline-progress');
            if (!loaderSpan) {
                loaderSpan = document.createElement('span');
                loaderSpan.className = 'inline-progress';
                loaderSpan.style.color = 'var(--accent-color)';
                loaderSpan.style.fontSize = '12px';
                loaderSpan.style.marginLeft = '10px';
                
                const titleEl = this.lastActiveWidget.querySelector('.widget-title');
                if (titleEl) {
                    const firstSpan = titleEl.querySelector('span');
                    if (firstSpan) firstSpan.insertAdjacentElement('afterend', loaderSpan);
                } else {
                    const h3 = this.lastActiveWidget.querySelector('h3');
                    if (h3) h3.appendChild(loaderSpan);
                }
            }
            activeLoaderText = loaderSpan;
            activeLoaderText.innerText = '⏳ ...';
        }

        const list = document.getElementById('gcode-view');
        const canvas = document.getElementById('gcode-canvas');
        const modView = document.getElementById('mod-view');
        const scrollTop = list.scrollTop;
        
        let htmlChunks = [];
        let modChunks = [];
        const flowFactor = this.currentFlow / 100.0;
        const speedFactor = this.currentSpeed / 100.0;
        
        const totalLines = this.originalLines.length;
        const chunkSize = 20000;

        // --- PAGINATION LOGIC ---
        let startLine = 0;
        let endLine = totalLines - 1;

        if (this.gcodeViewMode === 'layer' && this.layerList && this.layerList.length > 0) {
            const currentLayer = this.layerList[this.currentLayerIdx];
            if (currentLayer && currentLayer.paths && currentLayer.paths.length > 0) {
                if (this.currentLayerIdx === 0) {
                    startLine = 0;
                } else {
                    const prevLayer = this.layerList[this.currentLayerIdx - 1];
                    if (prevLayer && prevLayer.paths && prevLayer.paths.length > 0) {
                        startLine = prevLayer.paths[prevLayer.paths.length - 1].lineIndex + 1;
                    } else {
                        startLine = currentLayer.paths[0].lineIndex;
                    }
                }
                endLine = currentLayer.paths[currentLayer.paths.length - 1].lineIndex;
            }
        }

        let totalDisplayLines = endLine - startLine + 1;
        let pageSize = totalDisplayLines;
        if (this.gcodePageSize !== 'all') {
            pageSize = parseInt(this.gcodePageSize, 10);
        }

        this.gcodeTotalPages = Math.ceil(totalDisplayLines / pageSize) || 1;
        if (this.gcodeCurrentPage > this.gcodeTotalPages) this.gcodeCurrentPage = this.gcodeTotalPages;
        if (this.gcodeCurrentPage < 1) this.gcodeCurrentPage = 1;

        let pageStart = startLine + (this.gcodeCurrentPage - 1) * pageSize;
        let pageEnd = Math.min(pageStart + pageSize - 1, endLine);

        // Update UI controls
        const pageInfo = document.getElementById('gcode-page-info');
        if (pageInfo) pageInfo.innerText = `${this.gcodeCurrentPage} / ${this.gcodeTotalPages}`;
        
        const prevBtn = document.getElementById('gcode-page-prev');
        if (prevBtn) prevBtn.disabled = this.gcodeCurrentPage <= 1;
        
        const nextBtn = document.getElementById('gcode-page-next');
        if (nextBtn) nextBtn.disabled = this.gcodeCurrentPage >= this.gcodeTotalPages;

        let skipUntil = -1;
        for(let i = 0; i < totalLines; i += chunkSize) {
            const chunkEnd = Math.min(i + chunkSize, totalLines);
            for(let j = i; j < chunkEnd; j++) {
                if (j <= skipUntil) continue;
                
                const originalLine = this.originalLines[j];
                const cleanLine = originalLine.trim();
                if (cleanLine === "") continue;

                if (cleanLine.startsWith(';') && (
                    cleanLine.toLowerCase().includes('thumbnail') || 
                    (cleanLine.length > 60 && !cleanLine.substring(2).trim().includes(' '))
                )) {
                    continue;
                }

                const isFoldable = cleanLine.toUpperCase().startsWith(';LAYER:') || cleanLine.toUpperCase().startsWith(';TYPE:');
                let foldBtnHtml = '';
                if (isFoldable) {
                    const fold = this.foldedRanges.find(r => r.start === j);
                    if (fold) {
                        skipUntil = fold.end;
                        foldBtnHtml = `<button class="fold-btn" onclick="window.gcodeApp.toggleFold(${j})">+</button>`;
                    } else {
                        foldBtnHtml = `<button class="fold-btn" onclick="window.gcodeApp.toggleFold(${j})">-</button>`;
                    }
                } else {
                    foldBtnHtml = `<span style="display:inline-block;width:24px;"></span>`;
                }

                const isBookmarked = this.bookmarks.has(j);
                const bookmarkBtnHtml = `<button class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="window.gcodeApp.toggleBookmark(${j})" style="color: ${isBookmarked ? 'gold' : '#555'}; background: transparent; border: none; cursor: pointer; font-size: 16px;">★</button>`;

                const isVisible = (j >= pageStart && j <= pageEnd);
                
                // We must check if it's modified for the modChunks
                const modResult = this.modifyLine(cleanLine, flowFactor, speedFactor);
                const modifiedLine = modResult.text;
                const isChanged = modifiedLine !== cleanLine;
                
                if (!isVisible && !isChanged) continue;
                
                const modTypes = modResult.types;
                const escapedLine = modifiedLine.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                let classes = 'gcode-line';
                if (this.selectedLineIndex === j) classes += ' active';
                if (isChanged) classes += ' modified';
                if (modTypes.length > 0) {
                    modTypes.forEach(t => classes += ` mod-item-${t}`);
                }

                let badgeHtml = '';
                if (this.lintWarnings && this.lintWarnings[j]) {
                    this.lintWarnings[j].forEach(w => {
                        badgeHtml += `<span class="mod-badge badge-warning" style="background:#e74c3c; color:white; border-color:#c0392b;">⚠️ ${w}</span> `;
                    });
                }
                
                if (isChanged && modTypes.length > 0) {
                    modTypes.forEach(t => {
                        let label = t;
                        if (t === 'temp') label = 'Hotend';
                        if (t === 'bed') label = 'Bed';
                        if (t === 'fan') label = 'Fan';
                        if (t === 'retract') label = 'Retract';
                        if (t === 'flow') label = 'Flow';
                        if (t === 'speed') label = 'Speed';
                        if (t === 'offset') label = 'Offset';
                        badgeHtml += `<span class="mod-badge badge-${t}">${label}</span> `;
                    });
                } else if (isChanged) {
                    badgeHtml = '<span class="mod-badge">Geändert</span> ';
                }

                const liHtml = `
                    <li class="${classes}" id="line-${j}" data-index="${j}" style="display: flex; align-items: center; gap: 8px;">
                        ${foldBtnHtml}
                        ${bookmarkBtnHtml}
                        <span style="flex-grow:1;">${escapedLine}</span> 
                        <small style="color: var(--text-muted); min-width: 150px; text-align:right;">${badgeHtml}Zeile ${j + 1}</small>
                    </li>
                `;
                
                if (isVisible) htmlChunks.push(liHtml);
                if (isChanged) modChunks.push(liHtml);
            }
            
            const percent = Math.round((i / totalLines) * 100);
            if (isInitialLoad && overlayText) {
                overlayText.innerText = `Erstelle Liste... ${percent}%`;
            } else if (activeLoaderText) {
                activeLoaderText.innerText = `⏳ ${percent}%`;
            }
            await new Promise(r => setTimeout(r, 0));
        }

        // Wenn Temp/Bed/Fan/Retract nicht im G-Code vorhanden waren, aber geändert wurden, simulieren wir den Chunk für die UI!
        if (this.currentTemp !== this.defaultTemp && !this.originalTempFound) {
            const injectedHtml = `
                <li class="gcode-line modified mod-item-temp">
                    <span>M104 S${this.currentTemp} ; (Injected)</span>
                    <small style="color: var(--text-muted)"><span class="mod-badge badge-temp">Hotend</span> Start</small>
                </li>
            `;
            modChunks.unshift(injectedHtml);
        }

        if (this.currentBed !== this.defaultBed && !this.originalBedFound) {
            const injectedHtml = `
                <li class="gcode-line modified mod-item-bed">
                    <span>M140 S${this.currentBed} ; (Injected)</span>
                    <small style="color: var(--text-muted)"><span class="mod-badge badge-bed">Heizbett</span> Start</small>
                </li>
            `;
            modChunks.unshift(injectedHtml);
        }
        if (this.currentFan !== this.defaultFan && !this.originalFanFound) {
            const injectedHtml = `
                <li class="gcode-line modified mod-item-fan">
                    <span>M106 S${Math.round((this.currentFan / 100.0) * 255)} ; (Injected)</span>
                    <small style="color: var(--text-muted)"><span class="mod-badge badge-fan">Lüfter</span> Start</small>
                </li>
            `;
            modChunks.unshift(injectedHtml);
        }
        
        if (this.currentRetract !== this.defaultRetract && !this.originalRetractFound) {
            const injectedHtml = `
                <li class="gcode-line modified mod-item-retract">
                    <span>; Retract: ${this.currentRetract} mm (Absolute Mode/Neu)</span>
                    <small style="color: var(--text-muted)"><span class="mod-badge badge-retract">Retract</span> Global</small>
                </li>
            `;
            modChunks.unshift(injectedHtml);
        }
        const isKinematicsModified = document.querySelectorAll('.k-input.modified-value').length > 0;
        if (isKinematicsModified) {
            const kinHtml = `
                <li class="gcode-line modified mod-item-kinematics">
                    <span>; Kinematik überschrieben (M201, M203, M204, M205)</span>
                    <small style="color: var(--text-muted)"><span class="mod-badge badge-speed">Kinematics</span> Global</small>
                </li>
            `;
            modChunks.unshift(kinHtml);
        }

        list.innerHTML = htmlChunks.join('');
        // No need to restore scrollTop if we are paginating, scrolling to top is better
        if (this.gcodePageSize !== 'all') {
            list.scrollTop = 0;
        } else {
            list.scrollTop = scrollTop;
        }
        
        if (modChunks.length > 0) {
            modView.innerHTML = modChunks.join('');
        } else {
            modView.innerHTML = '<li style="color: var(--text-muted); padding: 20px; text-align: center;" data-i18n="mods.none">' + window.t("mods.none") + '</li>';
        }

        overlay.classList.remove('visible');
        
        document.querySelectorAll('.widget-updating').forEach(w => {
            w.classList.remove('widget-updating');
            const inlineProg = w.querySelector('.inline-progress');
            if (inlineProg) inlineProg.remove();
        });
        this.lastActiveWidget = null;

        this.draw();
    }

    updateLayerIndicator() {
        const val = document.getElementById('layer-val');
        if (val) {
            if (this.layerList && this.layerList.length > 0) {
                const z = this.layerList[this.currentLayerIdx].z.toFixed(2);
                val.innerText = `Layer: ${this.currentLayerIdx} (${z} mm)`;
            } else {
                val.innerText = `Layer: 0`;
            }
        }
        this.syncPlaybackUI();
    }

    play() {
        if (!this.layerList || !this.layerList.length) return;
        const currentLayer = this.layerList[this.currentLayerIdx];
        if (!currentLayer.paths.length) return;
        
        // If we are at the end, restart
        if (this.playbackIndex >= currentLayer.paths.length - 1 || this.playbackIndex === -1) {
            this.playbackIndex = 0;
        }
        
        this.isPlaying = true;
        document.getElementById('play-toggle').innerText = '⏸️';
        this.playbackLoop();
    }
    
    pause() {
        this.isPlaying = false;
        document.getElementById('play-toggle').innerText = '▶️';
        if (this.playRequestId) cancelAnimationFrame(this.playRequestId);
    }
    
    stepForward() {
        if (!this.layerList || !this.layerList.length) return;
        const currentLayer = this.layerList[this.currentLayerIdx];
        if (this.playbackIndex === -1) this.playbackIndex = currentLayer.paths.length - 1;
        
        if (this.playbackIndex < currentLayer.paths.length - 1) {
            this.playbackIndex++;
            this.syncPlaybackUI();
            this.draw();
        }
    }
    
    stepBackward() {
        if (!this.layerList || !this.layerList.length) return;
        const currentLayer = this.layerList[this.currentLayerIdx];
        if (this.playbackIndex === -1) this.playbackIndex = currentLayer.paths.length - 1;
        
        if (this.playbackIndex > 0) {
            this.playbackIndex--;
            this.syncPlaybackUI();
            this.draw();
        }
    }
    
    playbackLoop() {
        if (!this.isPlaying) return;
        
        const currentLayer = this.layerList[this.currentLayerIdx];
        
        // Advance by a few paths per frame for smooth speed.
        const speedMultiplier = Math.max(1, Math.floor(currentLayer.paths.length / 300));
        this.playbackIndex += speedMultiplier;
        
        if (this.playbackIndex >= currentLayer.paths.length - 1) {
            this.playbackIndex = currentLayer.paths.length - 1;
            this.pause();
        }
        
        this.syncPlaybackUI();
        this.draw();
        
        if (this.isPlaying) {
            this.playRequestId = requestAnimationFrame(() => this.playbackLoop());
        }
    }
    
    syncPlaybackUI() {
        const slider = document.getElementById('playback-slider');
        if (!slider) return;
        if (!this.layerList || !this.layerList.length) {
            slider.max = 0;
            slider.value = 0;
            return;
        }
        const currentLayer = this.layerList[this.currentLayerIdx];
        const max = Math.max(0, currentLayer.paths.length - 1);
        
        if (slider.max != max) slider.max = max;
        slider.value = this.playbackIndex === -1 ? max : this.playbackIndex;
        
        // Highlight corresponding G-Code line in the list
        if (this.playbackIndex !== -1 && currentLayer.paths[this.playbackIndex]) {
            const path = currentLayer.paths[this.playbackIndex];
            this.selectedLineIndex = path.lineIndex;
            
            const prevActive = document.querySelector('.gcode-line.active');
            if (prevActive) {
                if (prevActive.id === `line-${path.lineIndex}`) return; // Already active
                prevActive.classList.remove('active');
            }
            
            const lineEl = document.getElementById(`line-${path.lineIndex}`);
            if (lineEl) {
                lineEl.classList.add('active');
                this.safeScrollToLine(lineEl, 'auto', 'nearest');
            }
        }
    }

    safeScrollToLine(lineEl, behavior, block) {
        const container = document.getElementById('gcode-view');
        if (!container || !lineEl) return;

        const cRect = container.getBoundingClientRect();
        const lRect = lineEl.getBoundingClientRect();

        if (block === 'nearest') {
            if (lRect.top < cRect.top) {
                container.scrollTo({ top: container.scrollTop + (lRect.top - cRect.top), behavior });
            } else if (lRect.bottom > cRect.bottom) {
                container.scrollTo({ top: container.scrollTop + (lRect.bottom - cRect.bottom), behavior });
            }
        } else {
            const targetTop = container.scrollTop + (lRect.top - cRect.top) - (container.clientHeight / 2) + (lineEl.clientHeight / 2);
            container.scrollTo({ top: targetTop, behavior });
        }
    }

    selectLine(index) {
        this.selectedLineIndex = index;
        this.draw();

        const prevActive = document.querySelector('.gcode-line.active');
        if (prevActive) prevActive.classList.remove('active');

        const lineEl = document.getElementById(`line-${index}`);
        
        if (lineEl) {
            lineEl.classList.add('active');
            this.safeScrollToLine(lineEl, 'smooth', 'center');
        } else if (this.gcodePageSize !== 'all') {
            // Jump to correct layer/page
            let startLine = 0;
            if (this.gcodeViewMode === 'layer' && this.layerList && this.layerList.length > 0) {

                let targetLayerIdx = -1;
                for(let i=0; i<this.layerList.length; i++) {
                    const l = this.layerList[i];
                    if(l.paths.length > 0) {
                        if (index <= l.paths[l.paths.length - 1].lineIndex) {
                            targetLayerIdx = i;
                            break;
                        }
                    }
                }
                if (targetLayerIdx !== -1 && targetLayerIdx !== this.currentLayerIdx) {
                    this.currentLayerIdx = targetLayerIdx;
                    document.getElementById('layer-slider').value = targetLayerIdx;
                    this.updateLayerIndicator();
                }
                
                const currentLayer = this.layerList[this.currentLayerIdx];
                if (this.currentLayerIdx === 0) {
                    startLine = 0;
                } else {
                    const prevLayer = this.layerList[this.currentLayerIdx - 1];
                    if (prevLayer && prevLayer.paths && prevLayer.paths.length > 0) {
                        startLine = prevLayer.paths[prevLayer.paths.length - 1].lineIndex + 1;
                    } else {
                        startLine = currentLayer.paths[0].lineIndex;
                    }
                }
            }

            const relativeLine = index - startLine;
            if (relativeLine >= 0) {
                const pageSize = parseInt(this.gcodePageSize, 10);
                const targetPage = Math.floor(relativeLine / pageSize) + 1;
                
                if (targetPage !== this.gcodeCurrentPage || !document.getElementById(`line-${index}`)) {
                    this.gcodeCurrentPage = targetPage;
                    this.updateGcodeListAsync().then(() => {
                        const newEl = document.getElementById(`line-${index}`);
                        if (newEl) {
                            newEl.classList.add('active');
                            this.safeScrollToLine(newEl, 'smooth', 'center');
                        }
                    });
                }
            }
        }

        if (this.originalLines[index]) {
            const flowFactor = this.currentFlow / 100.0;
            const speedFactor = this.currentSpeed / 100.0;
            const interpretedLine = this.modifyLine(this.originalLines[index].trim(), flowFactor, speedFactor);
            this.interpretLine(interpretedLine.text);
        }
    }

    interpretLine(line) {
        const cleanLine = line.trim();
        const box = document.getElementById("explanation-output");
        
        if (cleanLine.startsWith("G28")) {
            box.style.borderColor = "#4caf50";
            box.innerHTML = window.t("expl.g28");
        } 
        else if (cleanLine.startsWith("G1") || cleanLine.startsWith("G0")) {
            box.style.borderColor = "#ff9800";
            const fMatch = cleanLine.match(/F([0-9.]+)/);
            const speed = fMatch ? (parseFloat(fMatch[1]) / 60).toFixed(1) : (window.currentLang === "en" ? "Slicing setting" : "Slicing-Vorgabe");
            const extrudes = cleanLine.includes("E") && !cleanLine.includes("E-");
            const extTxt = extrudes ? window.t("expl.g1.ext") : window.t("expl.g1.noext");
            box.innerHTML = window.t("expl.g1").replace("{speed}", speed).replace("{extrudes}", extTxt);
        }
        else if (cleanLine.includes("E-") || (cleanLine.startsWith("G1") && cleanLine.match(/E-([0-9.]+)/))) {
            box.style.borderColor = "#e91e63";
            const eMatch = cleanLine.match(/E-([0-9.]+)/);
            const val = eMatch ? eMatch[1] : "?";
            box.innerHTML = window.t("expl.retract").replace("{val}", val);
        }
        else if (cleanLine.startsWith("M104") || cleanLine.startsWith("M109")) {
            box.style.borderColor = "#f44336";
            const sMatch = cleanLine.match(/S([0-9.]+)/);
            const temp = sMatch ? sMatch[1] : (window.currentLang === "en" ? "unknown" : "unbekannt");
            const wait = cleanLine.startsWith("M109") ? window.t("expl.m104.wait") : window.t("expl.m104.nowait");
            box.innerHTML = window.t("expl.m104").replace("{temp}", temp).replace("{wait}", wait);
        }
        else if (cleanLine.startsWith("M140") || cleanLine.startsWith("M190")) {
            box.style.borderColor = "#f44336";
            const sMatch = cleanLine.match(/S([0-9.]+)/);
            const temp = sMatch ? sMatch[1] : (window.currentLang === "en" ? "unknown" : "unbekannt");
            box.innerHTML = window.t("expl.m140").replace("{temp}", temp);
        }
        else if (cleanLine.startsWith("M106")) {
            box.style.borderColor = "#03a9f4";
            const sMatch = cleanLine.match(/S([0-9.]+)/);
            const speed = sMatch ? Math.round((parseFloat(sMatch[1]) / 255) * 100) : 100;
            box.innerHTML = window.t("expl.m106").replace("{speed}", speed);
        }
        else if (cleanLine.startsWith("M107")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.m107");
        }
        else if (cleanLine.includes("SET_VELOCITY_LIMIT")) {
            box.style.borderColor = "#9c27b0";
            box.innerHTML = window.t("expl.klipper.vel");
        }
        else if (cleanLine.includes("SET_PRESSURE_ADVANCE")) {
            box.style.borderColor = "#9c27b0";
            box.innerHTML = window.t("expl.klipper.pa");
        }
        else if (cleanLine.startsWith("G90")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.g90");
        }
        else if (cleanLine.startsWith("G91")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.g91");
        }
        else if (cleanLine.startsWith("M82")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.m82");
        }
        else if (cleanLine.startsWith("M83")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.m83");
        }
        else if (cleanLine.startsWith("G92")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.g92");
        }
        else if (cleanLine.startsWith("M20") || cleanLine.startsWith("M201") || cleanLine.startsWith("M203") || cleanLine.startsWith("M204") || cleanLine.startsWith("M205")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.kinematics");
        }
        else if (cleanLine.startsWith("M84")) {
            box.style.borderColor = "#607d8b";
            box.innerHTML = window.t("expl.m84");
        }
        else if (cleanLine.startsWith("M") || cleanLine.startsWith("G")) {
            box.style.borderColor = "#9e9e9e";
            const cmd = cleanLine.split(" ")[0] || cleanLine;
            box.innerHTML = window.t("expl.firmware").replace("{cmd}", cmd);
        } else {
            const info = window.currentLang === "en" ? "Click on a G-Code command (e.g. G1, M104) to see an explanation." : "Klicke auf einen G-Code Befehl (z.B. G1, M104), um eine Erklärung zu sehen.";
            box.innerHTML = "💡 <strong>Info:</strong> " + info;
            box.style.borderColor = "var(--border-color)";
        }
    }

    updateStatsUI() {
        if (!this.stats) return;
        
        // 1. Update Analyse Tab
        const xRange = (this.stats.maxX - this.stats.minX).toFixed(1);
        const yRange = (this.stats.maxY - this.stats.minY).toFixed(1);
        const zMax = this.stats.maxZ.toFixed(2);
        
        document.getElementById('ana-x').innerText = `${xRange} mm`;
        document.getElementById('ana-y').innerText = `${yRange} mm`;
        document.getElementById('ana-z').innerText = `${zMax} mm`;
        
        const vol = (xRange * yRange * zMax / 1000).toFixed(2);
        document.getElementById('ana-vol').innerText = `${vol} cm³`;
        
        document.getElementById('ana-e').innerText = `${this.stats.totalE.toFixed(2)} mm`;
        
        // 2. Update Stats Banner
        const filamentLengthM = this.stats.totalE / 1000;
        const filamentWeightG = (filamentLengthM * Math.PI * Math.pow(1.75/2, 2) * 1.24).toFixed(1);
        
        document.getElementById('stat-filament').innerText = `${filamentWeightG} g (${filamentLengthM.toFixed(2)} m)`;
        
        this.updateTimeUI();
    }
    
    updateTimeUI() {
        if (!this.stats) return;
        
        const speedFactor = this.currentSpeed / 100.0;
        const newTimeSec = this.stats.originalPrintTimeSec / speedFactor;
        
        document.getElementById('stat-time').innerText = this.formatTime(newTimeSec);
        
        const savedBox = document.getElementById('stat-saved-box');
        const savedLabel = savedBox.querySelector('.stat-label');
        const savedSpan = document.getElementById('stat-saved');
        
        if (this.originalJsTime) {
            const savedSec = this.originalJsTime - newTimeSec;
            if (savedSec > 60) {
                savedBox.style.display = 'flex';
                if(savedLabel) savedLabel.innerText = '⚡ Du sparst';
                savedSpan.innerText = this.formatTime(savedSec);
                savedSpan.style.color = 'var(--text-success)';
            } else if (savedSec < -60) {
                savedBox.style.display = 'flex';
                if(savedLabel) savedLabel.innerText = '🐌 Dauert länger';
                savedSpan.innerText = this.formatTime(Math.abs(savedSec));
                savedSpan.style.color = 'var(--text-danger)';
            } else {
                savedBox.style.display = 'none';
            }
        } else {
            if (speedFactor > 1.0) {
                savedBox.style.display = 'flex';
                if(savedLabel) savedLabel.innerText = '⚡ Du sparst';
                const savedSec = this.stats.originalPrintTimeSec - newTimeSec;
                savedSpan.innerText = this.formatTime(savedSec);
                savedSpan.style.color = 'var(--text-success)';
            } else {
                savedBox.style.display = 'none';
            }
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '--:--';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    // --- 3D RENDERING LOGIC ---
    rebuild3DScene() {
        if (!this.is3DMode || !this.scene) return;

        // Cleanup old geometry
        if (this.gcode3DObject) {
            this.scene.remove(this.gcode3DObject);
            if (this.gcode3DObject.geometry) this.gcode3DObject.geometry.dispose();
            if (this.gcode3DObject.material) this.gcode3DObject.material.dispose();
        }
        
        // Remove old instanced meshes if they exist
        if (this.instancedMesh) {
            this.scene.remove(this.instancedMesh);
            this.instancedMesh.geometry.dispose();
            this.instancedMesh.material.dispose();
            this.instancedMesh = null;
        }
        if (this.sphereInstancedMesh) {
            this.scene.remove(this.sphereInstancedMesh);
            this.sphereInstancedMesh.geometry.dispose();
            this.sphereInstancedMesh.material.dispose();
            this.sphereInstancedMesh = null;
        }

        if (!this.layerList || this.layerList.length === 0) return;

        const useSolid = this.viewMode3D === 'solid';
        
        // Count total extrude segments for buffer allocation
        let totalSegments = 0;
        this.layerList.forEach(layer => {
            layer.paths.forEach(p => {
                if (p.type === 'extrude') totalSegments++;
            });
        });
        
        if (totalSegments === 0) return;

        // 1. Always create a LineSegments for Travel Moves if enabled
        if (this.showTravelMoves) {
            let travelCount = 0;
            this.layerList.forEach(layer => {
                layer.paths.forEach(p => { if (p.type === 'travel') travelCount++; });
            });
            
            if (travelCount > 0) {
                let activePoints = [];
                let activeColors = [];
                const tMat = new THREE.LineDashedMaterial({ color: 0x00aaff, dashSize: 0.5, gapSize: 0.5, transparent: true, opacity: 0.5,
                side: THREE.DoubleSide
            });
            
                this.layerList.forEach((layer, lIdx) => {
                    layer.paths.forEach(p => {
                        if (p.type === 'travel' && lIdx <= this.currentLayerIdx) {
                            activePoints.push(new THREE.Vector3(p.x1, p.y1, layer.z));
                            activePoints.push(new THREE.Vector3(p.x2, p.y2, layer.z));
                            activeColors.push(0, 0.66, 1, 0, 0.66, 1);
                        }
                    });
                });
                if (activePoints.length > 0) {
                    const tGeo = new THREE.BufferGeometry().setFromPoints(activePoints);
                    tGeo.setAttribute('color', new THREE.Float32BufferAttribute(activeColors, 3));
                    const travelLines = new THREE.LineSegments(tGeo, tMat);
                    travelLines.computeLineDistances();
                    travelLines.name = 'travelLines';
                    this.scene.add(travelLines);
                    this.travelLinesObj = travelLines;
                }
            }
        } else if (this.travelLinesObj) {
            this.scene.remove(this.travelLinesObj);
            this.travelLinesObj.geometry.dispose();
            this.travelLinesObj.material.dispose();
            this.travelLinesObj = null;
        }

        if (useSolid) {
            // Instanced Mesh for cylinders (fastest way to render solid tubes)
            // Reduced segments from 24/16 to 6/6 for massive performance improvement
            const cylinderGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 6);
            cylinderGeo.translate(0, 0.5, 0); // Pivot at bottom
            cylinderGeo.rotateX(Math.PI / 2); // Point along Z in local space (which will be Y in ThreeJS)
            
            const sphereGeo = new THREE.SphereGeometry(0.2, 6, 6);
            
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0xffffff, 
                roughness: 0.5,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
            
            this.instancedMesh = new THREE.InstancedMesh(cylinderGeo, mat, totalSegments);
            this.sphereInstancedMesh = new THREE.InstancedMesh(sphereGeo, mat, totalSegments * 2);
            
            const dummy = new THREE.Object3D();
            const dummySphere = new THREE.Object3D();
            const color = new THREE.Color();
            
            let idx = 0;
            let sphereIdx = 0;
            this.layerList.forEach((layer, lIdx) => {
                layer.paths.forEach(path => {
                    if (path.type !== 'extrude') return;
                    
                    const dx = path.x2 - path.x1;
                    const dy = path.y2 - path.y1;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    
                    // Position at start
                    dummy.position.set(path.x1, path.y1, layer.z);
                    // Orient towards end
                    dummy.lookAt(path.x2, path.y2, layer.z);
                    dummy.scale.set(1, 1, len);
                    dummy.updateMatrix();
                    
                    this.instancedMesh.setMatrixAt(idx, dummy.matrix);
                    
                    // Sphere at start
                    dummySphere.position.set(path.x1, path.y1, layer.z);
                    dummySphere.scale.set(1, 1, 1);
                    dummySphere.updateMatrix();
                    this.sphereInstancedMesh.setMatrixAt(sphereIdx, dummySphere.matrix);
                    
                    // Sphere at end
                    dummySphere.position.set(path.x2, path.y2, layer.z);
                    dummySphere.updateMatrix();
                    this.sphereInstancedMesh.setMatrixAt(sphereIdx + 1, dummySphere.matrix);
                    
                    // Color based on heatmap, feature, flow, or normal
                    if (this.colorMode === 'heatmap') {
                        const speedMms = Math.round(path.feedrate / 60);
                        const hue = Math.max(0, 240 - (speedMms * 1.5));
                        color.setHSL(hue / 360, 1.0, 0.5);
                    } else if (this.colorMode === 'feature') {
                        const ft = path.featureType ? path.featureType.toLowerCase() : '';
                        if (ft.includes('external perimeter')) color.setHex(0xffaa00);
                        else if (ft.includes('perimeter')) color.setHex(0x00ff00);
                        else if (ft.includes('infill')) color.setHex(0xff0000);
                        else if (ft.includes('support')) color.setHex(0x00ffff);
                        else if (ft.includes('skirt') || ft.includes('brim')) color.setHex(0x0000ff);
                        else color.setHex(0xffb300);
                    } else {
                        color.setHex(0xffb300); // Standard yellow
                    }
                    this.instancedMesh.setColorAt(idx, color);
                    this.sphereInstancedMesh.setColorAt(sphereIdx, color);
                    this.sphereInstancedMesh.setColorAt(sphereIdx + 1, color);
                    
                    // Store layer info for playback hiding
                    path.instanceIdx = idx;
                    idx++;
                    sphereIdx += 2;
                });
            });
            
            this.instancedMesh.instanceMatrix.needsUpdate = true;
            this.instancedMesh.instanceColor.needsUpdate = true;
            this.scene.add(this.instancedMesh);
            
            this.sphereInstancedMesh.instanceMatrix.needsUpdate = true;
            this.sphereInstancedMesh.instanceColor.needsUpdate = true;
            this.scene.add(this.sphereInstancedMesh);
            
        } else {
            // LineSegments (Fastest)
            const positions = new Float32Array(totalSegments * 6); // 2 verts per segment, 3 floats per vert
            const colors = new Float32Array(totalSegments * 6);
            let idx = 0;
            const tempColor = new THREE.Color();

            this.layerList.forEach((layer) => {
                layer.paths.forEach(path => {
                    if (path.type !== 'extrude') return;

                    positions[idx * 6] = path.x1;
                    positions[idx * 6 + 1] = path.y1;
                    positions[idx * 6 + 2] = layer.z;

                    positions[idx * 6 + 3] = path.x2;
                    positions[idx * 6 + 4] = path.y2;
                    positions[idx * 6 + 5] = layer.z;

                    if (this.colorMode === 'heatmap') {
                        const normalizedF = Math.max(0, Math.min(1, (path.feedrate - 600) / 2400));
                        const hue = (1 - normalizedF) * 240;
                        tempColor.setHSL(hue / 360, 1.0, 0.5);
                    } else if (this.colorMode === 'feature') {
                        const ft = path.featureType ? path.featureType.toLowerCase() : '';
                        if (ft.includes('external perimeter')) tempColor.setHex(0xffaa00);
                        else if (ft.includes('perimeter')) tempColor.setHex(0x00ff00);
                        else if (ft.includes('infill')) tempColor.setHex(0xff0000);
                        else if (ft.includes('support')) tempColor.setHex(0x00ffff);
                        else if (ft.includes('skirt') || ft.includes('brim')) tempColor.setHex(0x0000ff);
                        else tempColor.setHex(0xffb300);
                    } else {
                        tempColor.setHex(0xffb300);
                    }

                    colors[idx * 6] = tempColor.r;
                    colors[idx * 6 + 1] = tempColor.g;
                    colors[idx * 6 + 2] = tempColor.b;
                    colors[idx * 6 + 3] = tempColor.r;
                    colors[idx * 6 + 4] = tempColor.g;
                    colors[idx * 6 + 5] = tempColor.b;
                    
                    path.vertexIdx = idx * 6; // To hide later
                    idx++;
                });
            });

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            const material = new THREE.LineBasicMaterial({ vertexColors: true,
                side: THREE.DoubleSide
            });
            this.gcode3DObject = new THREE.LineSegments(geometry, material);
            this.scene.add(this.gcode3DObject);
        }
        
        // Nozzle Indicator (sphere)
        if (!this.nozzle3D) {
            const sphereGeo = new THREE.SphereGeometry(0.8, 16, 16);
            const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            this.nozzle3D = new THREE.Mesh(sphereGeo, sphereMat);
            this.scene.add(this.nozzle3D);
        }

        // Highlight Indicator (line)
        if (!this.highlight3D) {
            const hlMat = new THREE.LineBasicMaterial({ color: 0x00ffff, depthTest: false });
            const hlGeo = new THREE.BufferGeometry();
            hlGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,0], 3));
            this.highlight3D = new THREE.Line(hlGeo, hlMat);
            this.highlight3D.renderOrder = 999;
            this.highlight3D.frustumCulled = false; // Disable culling so it doesn't disappear when zoomed in
            this.scene.add(this.highlight3D);
        }
        
        // Center the scene if not done
        if (this.bed3D) {
            this.bed3D.position.set(0, 0, 0);
        }
        if (this.gcode3DObject) {
            this.gcode3DObject.position.set(0, 0, 0);
        }
        if (this.instancedMesh) {
            this.instancedMesh.position.set(0, 0, 0);
        }
        
        this.update3DPlayback();
    }

    update3DPlayback() {
        if (!this.is3DMode || !this.scene || this.layerList.length === 0) return;
        
        // Offset
        if (this.gcode3DObject) this.gcode3DObject.position.set(this.currentXOffset, this.currentYOffset, 0);
        if (this.instancedMesh) this.instancedMesh.position.set(this.currentXOffset, this.currentYOffset, 0);
        
        let lastX = 0, lastY = 0, lastZ = 0;
        let foundPath = false;
        
        // For BufferGeometry (Lines), we can use setDrawRange.
        // For InstancedMesh, we set count.
        
        // Calculate total items to draw up to the current layer and playbackIndex
        let totalItemsToDraw = 0;
        
        for (let l = 0; l <= this.currentLayerIdx; l++) {
            const layer = this.layerList[l];
            let pathsToCount = layer.paths.length;
            
            if (l === this.currentLayerIdx) {
                pathsToCount = this.playbackIndex === -1 ? layer.paths.length : this.playbackIndex + 1;
            }
            
            for (let p = 0; p < pathsToCount; p++) {
                const path = layer.paths[p];
                if (path.type === 'extrude') {
                    totalItemsToDraw++;
                    lastX = path.x2;
                    lastY = path.y2;
                    lastZ = layer.z;
                    foundPath = true;
                }
            }
        }
        
        if (this.gcode3DObject) {
            this.gcode3DObject.geometry.setDrawRange(0, totalItemsToDraw * 2); // 2 verts per segment
        }
        if (this.instancedMesh) {
            this.instancedMesh.count = totalItemsToDraw;
        }
        if (this.sphereInstancedMesh) {
            this.sphereInstancedMesh.count = totalItemsToDraw * 2;
        }
        
        if (this.nozzle3D) {
            if (foundPath) {
                this.nozzle3D.visible = true;
                this.nozzle3D.position.set(lastX + this.currentXOffset, lastY + this.currentYOffset, lastZ);
            } else {
                this.nozzle3D.visible = false;
            }
        }
        
        let foundHighlight = false;
        if (this.selectedLineIndex !== -1) {
            // Sucht den Pfad zur ausgewählten Zeile
            for (let l = 0; l < this.layerList.length; l++) {
                const layer = this.layerList[l];
                for (let p = 0; p < layer.paths.length; p++) {
                    const path = layer.paths[p];
                    if (path.lineIndex === this.selectedLineIndex && (path.type === 'extrude' || path.type === 'travel')) {
                        if (this.highlight3D) {
                            const pos = this.highlight3D.geometry.attributes.position.array;
                            pos[0] = path.x1 + this.currentXOffset;
                            pos[1] = path.y1 + this.currentYOffset;
                            pos[2] = layer.z; 
                            pos[3] = path.x2 + this.currentXOffset;
                            pos[4] = path.y2 + this.currentYOffset;
                            pos[5] = layer.z;
                            this.highlight3D.geometry.attributes.position.needsUpdate = true;
                            this.highlight3D.geometry.computeBoundingBox();
                            this.highlight3D.geometry.computeBoundingSphere();
                            this.highlight3D.visible = true;
                        }
                        foundHighlight = true;
                        break;
                    }
                }
                if (foundHighlight) break;
            }
        }
        if (!foundHighlight && this.highlight3D) {
            this.highlight3D.visible = false;
        }
    }

    draw() {
        if (this.is3DMode) {
            this.update3DPlayback();
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2 + this.offsetX, this.canvas.height / 2 + this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // 1. Draw Bed
        this.ctx.strokeStyle = '#2e2e38';
        this.ctx.lineWidth = 1 / this.scale;
        this.ctx.strokeRect(-this.halfBed, -this.halfBed, this.bedSize, this.bedSize);

        // Grid
        this.ctx.strokeStyle = '#1b1b22';
        this.ctx.lineWidth = 0.5 / this.scale;
        for (let i = -this.halfBed; i <= this.halfBed; i += 20) {
            this.ctx.beginPath(); this.ctx.moveTo(i, -this.halfBed); this.ctx.lineTo(i, this.halfBed); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(-this.halfBed, i); this.ctx.lineTo(this.halfBed, i); this.ctx.stroke();
        }

        if (this.layerList.length > 0) {
            
            this.ctx.save();
            // Modell optisch verschieben entsprechend der Offsets
            this.ctx.translate(this.currentXOffset, -this.currentYOffset);
            
            // Use physical line widths (e.g. 0.4mm nozzle) to prevent moiré when zooming.
            // The browser's anti-aliasing will naturally blend sub-pixel lines into a solid block.
            const coreLw = 0.4;
            const borderLw = 0.5;
            const prevLw = 0.4;
            const sf = 1 / this.scale;

            // Dynamically adjust alpha to reduce moire when heavily zoomed out and lines overlap
            const dynamicAlpha = Math.max(0.4, Math.min(1.0, this.scale * 1.5));

            // --- OPTIMIZATION: Draw Context / Previous Layer Faded ---
            if (this.currentLayerIdx > 0) {
                const prevLayer = this.layerList[this.currentLayerIdx - 1];
                this.ctx.beginPath();
                prevLayer.paths.forEach(path => {
                    if (path.type === 'extrude') {
                        this.ctx.moveTo(path.x1, -path.y1);
                        this.ctx.lineTo(path.x2, -path.y2);
                    }
                });
                this.ctx.strokeStyle = `rgba(0, 188, 212, ${0.15 * Math.min(1, this.scale)})`; // Fade out even more when zoomed out
                this.ctx.lineWidth = prevLw;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.stroke();
            }

            const currentLayer = this.layerList[this.currentLayerIdx];
            let highlightedPath = null;
            
            // Limit paths for playback
            const activePaths = this.playbackIndex === -1 
                ? currentLayer.paths 
                : currentLayer.paths.slice(0, this.playbackIndex + 1);

            // --- OPTIMIZATION: Batch render Travel Paths ---
            if (this.showTravelMoves) {
                this.ctx.beginPath();
                activePaths.forEach(path => {
                    if (path.lineIndex === this.selectedLineIndex) { highlightedPath = path; return; }
                    if (path.type === 'travel') {
                        this.ctx.moveTo(path.x1, -path.y1);
                        this.ctx.lineTo(path.x2, -path.y2);
                    }
                });
                this.ctx.strokeStyle = `rgba(0, 170, 255, ${dynamicAlpha})`;
                this.ctx.lineWidth = 0.5 / this.scale;
                this.ctx.stroke();
            } else {
                // Find highlighted path even if not drawing travel
                activePaths.forEach(path => {
                    if (path.lineIndex === this.selectedLineIndex) highlightedPath = path;
                });
            }

            // --- OPTIMIZATION: Batch render Extrude Paths ---
            this.ctx.globalAlpha = dynamicAlpha;
            
            if (this.colorMode === 'heatmap' || this.colorMode === 'feature') {
                // INDIVIDUAL RENDER MODE (Heatmap, Flow or Feature)
                // Pass 1: Draw black borders for all segments (Skip if zoomed out to remove moiré)
                if (this.scale > 1.2) {
                    this.ctx.beginPath();
                    activePaths.forEach(path => {
                        if (path.lineIndex === this.selectedLineIndex) return;
                        if (path.type === 'extrude') {
                            this.ctx.moveTo(path.x1, -path.y1);
                            this.ctx.lineTo(path.x2, -path.y2);
                        }
                    });
                    this.ctx.strokeStyle = '#000000'; // Dark border for 3D look
                    this.ctx.lineWidth = borderLw;
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';
                    this.ctx.stroke();
                }
                
                // Pass 2: Draw colored cores
                activePaths.forEach(path => {
                    if (path.lineIndex === this.selectedLineIndex) return;
                    if (path.type === 'extrude') {
                        this.ctx.beginPath();
                        this.ctx.moveTo(path.x1, -path.y1);
                        this.ctx.lineTo(path.x2, -path.y2);
                        
                        if (this.colorMode === 'heatmap') {
                            const speedMms = Math.round(path.feedrate / 60);
                            const hue = Math.max(0, 240 - (speedMms * 1.5));
                            this.ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
                        } else {
                            const ft = path.featureType ? path.featureType.toLowerCase() : '';
                            if (ft.includes('external perimeter')) this.ctx.strokeStyle = '#ffaa00';
                            else if (ft.includes('perimeter')) this.ctx.strokeStyle = '#00ff00';
                            else if (ft.includes('infill')) this.ctx.strokeStyle = '#ff0000';
                            else if (ft.includes('support')) this.ctx.strokeStyle = '#00ffff';
                            else if (ft.includes('skirt') || ft.includes('brim')) this.ctx.strokeStyle = '#0000ff';
                            else this.ctx.strokeStyle = '#ffb300';
                        }
                        
                        this.ctx.lineWidth = coreLw; // Inner core
                        this.ctx.lineCap = 'round';
                        this.ctx.lineJoin = 'round';
                        this.ctx.stroke();
                    }
                });
            } else {
                // NORMAL RENDER MODE
                this.ctx.beginPath();
                activePaths.forEach(path => {
                    if (path.lineIndex === this.selectedLineIndex) return; 
                    if (path.type === 'extrude') {
                        this.ctx.moveTo(path.x1, -path.y1);
                        this.ctx.lineTo(path.x2, -path.y2);
                    }
                });
                
                // Pass 1: Border (Skip when zoomed out to completely remove dark moiré/noise)
                if (this.scale > 1.2) {
                    this.ctx.strokeStyle = '#000000';
                    this.ctx.lineWidth = borderLw;
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';
                    this.ctx.stroke();
                }
                
                // Pass 2: Core
                this.ctx.strokeStyle = '#ffb300'; // Slicer-like yellow/orange for plastic
                this.ctx.lineWidth = coreLw; // Inner core
                this.ctx.stroke();
            }
            
            this.ctx.globalAlpha = 1.0;
            
            // Draw nozzle indicator if scrubbing or playing
            if (this.playbackIndex !== -1 && activePaths.length > 0) {
                const lastPath = activePaths[activePaths.length - 1];
                this.ctx.beginPath();
                this.ctx.arc(lastPath.x2, -lastPath.y2, 1.5 * sf, 0, Math.PI * 2);
                this.ctx.fillStyle = '#ff0000'; // Red core
                this.ctx.fill();
                this.ctx.strokeStyle = '#ffffff'; // White border
                this.ctx.lineWidth = 0.5 * sf;
                this.ctx.stroke();
            }

            // Highlight chosen line
            if (highlightedPath) {
                this.ctx.beginPath();
                this.ctx.moveTo(highlightedPath.x1, -highlightedPath.y1);
                this.ctx.lineTo(highlightedPath.x2, -highlightedPath.y2);
                this.ctx.strokeStyle = '#00ffff'; // Cyan for selected line to match 3D
                this.ctx.lineWidth = Math.max(1.0, 1.5 * sf); // Keep width consistent when zoomed
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.stroke();
            }
            this.ctx.restore(); // Restore from offset translation
        }

        this.ctx.restore(); // Restore from global pan/zoom
    }
    runLinter() {
        this.lintWarnings = {};
        this.speedDistribution = {};
        let currentTemp = 0;
        
        for (let i = 0; i < this.originalLines.length; i++) {
            const line = this.originalLines[i].trim().toUpperCase();
            if (!line || line.startsWith(';')) continue;
            
            // Track Temperature
            if (line.startsWith('M104') || line.startsWith('M109')) {
                const match = line.match(/S([0-9.]+)/);
                if (match) currentTemp = parseFloat(match[1]);
            }
            
            // Lint Cold Extrusion
            const isExtruding = line.includes('E') && !line.includes('E-');
            if (isExtruding && currentTemp > 0 && currentTemp < 170) {
                if (!this.lintWarnings[i]) this.lintWarnings[i] = [];
                this.lintWarnings[i].push('Cold Extrusion: Extrusion bei < 170°C');
            }
            
            // Lint Syntax Error (G1 with no parameters)
            if (line === 'G1' || line === 'G0') {
                if (!this.lintWarnings[i]) this.lintWarnings[i] = [];
                this.lintWarnings[i].push('Syntax: G0/G1 ohne Koordinaten');
            }
            
            // Collect Speed & Lint Extreme Feedrate
            const fMatch = line.match(/F([0-9.]+)/);
            if (fMatch) {
                const f = parseFloat(fMatch[1]);
                if (f > 18000) {
                    if (!this.lintWarnings[i]) this.lintWarnings[i] = [];
                    this.lintWarnings[i].push(`Plausibilität: Sehr hohe Geschwindigkeit (F${f})`);
                }
            }
        }
        
        this.renderHistogram();
    }

    renderHistogram() {
        const container = document.getElementById('speed-histogram');
        if (!container) return;

        this.speedDistribution = {};
        if (this.layerList) {
            this.layerList.forEach(layer => {
                layer.paths.forEach(path => {
                    if (path.type === 'extrude') {
                        const speedMms = Math.round(path.feedrate / 60);
                        const bucket = Math.floor(speedMms / 10) * 10;
                        this.speedDistribution[bucket] = (this.speedDistribution[bucket] || 0) + 1;
                    }
                });
            });
        }
        
        container.innerHTML = '';
        const buckets = Object.keys(this.speedDistribution).map(Number).sort((a,b) => a - b);
        if (buckets.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);width:100%;text-align:center;">Keine Daten</div>';
            return;
        }
        
        const maxCount = Math.max(...Object.values(this.speedDistribution));
        
        buckets.forEach(bucket => {
            const count = this.speedDistribution[bucket];
            const heightPct = Math.max(5, (count / maxCount) * 100); // at least 5% so it's visible
            
            // Calculate a color from blue (slow) to red (fast)
            const hue = Math.max(0, 240 - (bucket * 1.5));
            const color = `hsl(${hue}, 80%, 50%)`;
            
            const bar = document.createElement('div');
            bar.style.width = '100%';
            bar.style.height = `${heightPct}%`;
            bar.style.backgroundColor = color;
            bar.style.borderRadius = '2px 2px 0 0';
            bar.style.transition = 'height 0.3s ease';
            bar.setAttribute('title', `${bucket} - ${bucket+9} mm/s: ${count} Befehle`);
            
            container.appendChild(bar);
        });
    }

    toggleFold(startIndex) {
        const existingIdx = this.foldedRanges.findIndex(r => r.start === startIndex);
        if (existingIdx !== -1) {
            this.foldedRanges.splice(existingIdx, 1);
        } else {
            const startLine = this.originalLines[startIndex].trim().toUpperCase();
            let endMatch = null;
            if (startLine.startsWith(';LAYER:')) endMatch = ';LAYER:';
            else if (startLine.startsWith(';TYPE:')) endMatch = ';TYPE:';
            else return;
            
            let endIndex = this.originalLines.length - 1;
            for (let i = startIndex + 1; i < this.originalLines.length; i++) {
                if (this.originalLines[i].trim().toUpperCase().startsWith(endMatch)) {
                    endIndex = i - 1;
                    break;
                }
            }
            this.foldedRanges.push({ start: startIndex, end: endIndex });
        }
        this.updateGcodeListAsync();
    }

    toggleBookmark(index) {
        if (this.bookmarks.has(index)) {
            this.bookmarks.delete(index);
        } else {
            this.bookmarks.add(index);
        }
        this.updateGcodeListAsync();
    }


    exportGCode() {
        if (this.originalLines.length === 0) return;

        const flowFactor = this.currentFlow / 100.0;
        const speedFactor = this.currentSpeed / 100.0;

        let isKinematicsModified = false;
        if (this.initialKinematicsInputs) {
            for (const [id, originalVal] of Object.entries(this.initialKinematicsInputs)) {
                const el = document.getElementById(id);
                if (el && el.value !== originalVal) {
                    isKinematicsModified = true;
                    break;
                }
            }
        }

        let modified = this.originalLines.map(line => {
            let res = this.modifyLine(line, flowFactor, speedFactor).text;
            if (isKinematicsModified) {
                const upper = res.trim().toUpperCase();
                if (upper.startsWith('M201 ') || upper.startsWith('M203 ') || upper.startsWith('M204 ') || upper.startsWith('M205 ')) {
                    res = `; ${res} (overridden by G-Code Analyzer)`;
                }
            }
            return res;
        });

        // Injected Commands anfügen (direkt nach Start)
        if (this.currentFan !== this.defaultFan && !this.originalFanFound) {
            modified.unshift(`M106 S${Math.round((this.currentFan / 100.0) * 255)}`);
        }

        if (isKinematicsModified) {
            const kParams = {
                vmax: { x: document.getElementById('k-vmax-x').value || 500, y: document.getElementById('k-vmax-y').value || 500, z: document.getElementById('k-vmax-z').value || 10, e: document.getElementById('k-vmax-e').value || 50 },
                accel: { x: document.getElementById('k-accel-x').value || 1000, y: document.getElementById('k-accel-y').value || 1000, z: document.getElementById('k-accel-z').value || 100, e: document.getElementById('k-accel-e').value || 5000 },
                taccel: { x: document.getElementById('k-taccel-x').value || 1500 },
                jerk: { x: document.getElementById('k-jerk-x').value || 8, y: document.getElementById('k-jerk-y').value || 8, z: document.getElementById('k-jerk-z').value || 0.4, e: document.getElementById('k-jerk-e').value || 5 }
            };
            const kinHeader = [
                `; --- Modified Kinematics by G-Code Analyzer ---`,
                `M201 X${kParams.accel.x} Y${kParams.accel.y} Z${kParams.accel.z} E${kParams.accel.e}`,
                `M203 X${kParams.vmax.x} Y${kParams.vmax.y} Z${kParams.vmax.z} E${kParams.vmax.e}`,
                `M204 P${kParams.accel.x} T${kParams.taccel.x}`,
                `M205 X${kParams.jerk.x} Y${kParams.jerk.y} Z${kParams.jerk.z} E${kParams.jerk.e}`,
                `; ----------------------------------------------`
            ];
            modified.unshift(...kinHeader);
        }

        const blob = new Blob([modified.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tuned_output.gcode';
        a.click();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gcodeApp = new GCodeViewer();
});


// --- Mobile UX: Canvas Interaction Lock ---
document.addEventListener('DOMContentLoaded', () => {
    const enableBtn = document.getElementById('enable-interaction-btn');
    const disableBtn = document.getElementById('disable-interaction-btn');
    const overlay = document.getElementById('mobile-canvas-overlay');
    
    // Show overlay if on mobile screen initially
    if (window.innerWidth <= 1024) {
        if (overlay) overlay.style.display = 'flex';
    }
    
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 1024) {
            if (overlay && !document.body.classList.contains('canvas-interaction-locked')) {
                overlay.style.display = 'flex';
            }
        } else {
            if (overlay) overlay.style.display = 'none';
            document.body.classList.remove('canvas-interaction-locked');
            if (disableBtn) disableBtn.style.display = 'none';
        }
    });

    if (enableBtn) {
        enableBtn.addEventListener('click', () => {
            document.body.classList.add('canvas-interaction-locked');
        });
    }
    
    if (disableBtn) {
        disableBtn.addEventListener('click', () => {
            document.body.classList.remove('canvas-interaction-locked');
            if (overlay) overlay.style.display = 'flex';
        });
    }
});

// Global Modal Functions
window.openModal = function(id) {
    document.getElementById('modal-overlay').style.display = 'block';
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'block';
};

window.closeAllModals = function() {
    document.getElementById('modal-overlay').style.display = 'none';
    const modals = document.querySelectorAll('.custom-modal');
    modals.forEach(m => m.style.display = 'none');
};

// --- Dynamic Slider Colors (Left side vs Right side) ---
document.addEventListener('DOMContentLoaded', () => {
    const updateSliderColor = (slider) => {
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const val = parseFloat(slider.value) || 0;
        // Clamp percentage between 0 and 100
        let percent = ((val - min) / (max - min)) * 100;
        percent = Math.max(0, Math.min(100, percent));
        
        slider.style.background = `linear-gradient(to right, var(--accent-color) ${percent}%, var(--border-color) ${percent}%)`;
    };

    document.querySelectorAll('input[type="range"].slider').forEach(slider => {
        // Update on input
        slider.addEventListener('input', () => updateSliderColor(slider));
        // Update on load
        setTimeout(() => updateSliderColor(slider), 100);
    });
});

