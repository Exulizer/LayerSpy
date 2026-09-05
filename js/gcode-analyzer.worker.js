
    async function readLinesFromFile(file) {
        postMessage({ type: 'progress', percent: 5, msg: 'Lese Datei...' });
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                postMessage({ type: 'progress', percent: 15, msg: 'Splitte Linien...' });
                resolve(e.target.result.split(/\r?\n/));
            };
            reader.readAsText(file);
        });
    }

self.onmessage = async function(e) {

    const { file, lines: inputLines, k, halfBed, forceRecalc } = e.data;
    const lines = file ? await readLinesFromFile(file) : inputLines;
    if (!lines) return;
    
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
    let currentFanPWM = 0;
    let currentFeatureType = 'Unknown';
    let estimatedPrintTimeSeconds = 0;
    let lastDx = 0, lastDy = 0, lastLineDist = 0, lastE = 0;
    let isRelativeE = false;

    const totalLines = lines.length;
    const chunkSize = 20000;

    let processChunk = function(startIndex) {
        const chunkEnd = Math.min(startIndex + chunkSize, totalLines);
        for(let j = startIndex; j < chunkEnd; j++) {
            const line = lines[j];
            const cleanLine = line.trim();
            
            const commentIdx = line.indexOf(';');
            if (commentIdx !== -1) {
                const comment = line.substring(commentIdx + 1).trim();
                const upperComment = comment.toUpperCase();
                if (upperComment.startsWith('TYPE:') || upperComment.startsWith('TYPE :')) {
                    currentFeatureType = comment.substring(comment.indexOf(':') + 1).trim();
                } else if (upperComment.startsWith('FEATURE:') || upperComment.startsWith('FEATURE :') || upperComment.startsWith('_FEATURE:')) {
                    currentFeatureType = comment.substring(comment.indexOf(':') + 1).trim();
                } else if (upperComment.startsWith('[FEATURE]')) {
                    currentFeatureType = comment.substring(9).trim();
                } else if (upperComment.startsWith('FEATURE ')) {
                    currentFeatureType = comment.substring(8).trim();
                }
            }

            if (cleanLine.startsWith(';')) continue;

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
                        feedrate: currentF,
                        fanPWM: currentFanPWM
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

        
    let diagnosticWarnings = [];
    let healthScore = 100;
    
    // Convert layerList to Float32Arrays and apply diagnostics
    let transferables = [];
    
    // Klipper limits
    let a_max = (typeof foundK !== 'undefined' && foundK && foundK.accel && foundK.accel.x) ? foundK.accel.x : 3000;
    let SCV = (typeof foundK !== 'undefined' && foundK && foundK.jerk && foundK.jerk.x) ? foundK.jerk.x : 5.0;

        let prevGrid = new Uint8Array(1600 * 1600);
    let currGrid = new Uint8Array(1600 * 1600);

    for (let i = 0; i < layerList.length; i++) {
        let layer = layerList[i];
        let numPaths = layer.paths.length;
        
        let t_layer = 0;
        // Use TypedArrays for high-performance 2D Kinematics planner
        let s_arr = new Float32Array(numPaths);
        let dirX_arr = new Float32Array(numPaths);
        let dirY_arr = new Float32Array(numPaths);
        let v_target_arr = new Float32Array(numPaths);
        let v_junction_arr = new Float32Array(numPaths);
        let v_entry_arr = new Float32Array(numPaths);
        let v_exit_arr = new Float32Array(numPaths);
        
        for (let j = 0; j < numPaths; j++) {
            let p = layer.paths[j];
            let dx = p.x2 - p.x1;
            let dy = p.y2 - p.y1;
            let s = Math.sqrt(dx*dx + dy*dy);
            s_arr[j] = s;
            dirX_arr[j] = s > 0 ? dx / s : 0;
            dirY_arr[j] = s > 0 ? dy / s : 0;
            let feed = p.feedrate !== undefined ? p.feedrate : (p.f || 0);
            v_target_arr[j] = feed / 60.0;
        }
        
        // Calculate junctions
        for (let j = 0; j < numPaths - 1; j++) {
            if (s_arr[j] === 0 || s_arr[j+1] === 0) {
                v_junction_arr[j] = 0;
                continue;
            }
            let cosTheta = dirX_arr[j] * dirX_arr[j+1] + dirY_arr[j] * dirY_arr[j+1];
            if (cosTheta > 1.0) cosTheta = 1.0;
            if (cosTheta < -1.0) cosTheta = -1.0;
            
            let v_junction;
            if (cosTheta > 0.9999) {
                v_junction = Math.min(v_target_arr[j], v_target_arr[j+1]);
            } else {
                let sinThetaHalf = Math.sqrt((1 - cosTheta) / 2);
                if (sinThetaHalf > 0.0001) {
                    v_junction = SCV / sinThetaHalf;
                } else {
                    v_junction = Math.min(v_target_arr[j], v_target_arr[j+1]);
                }
                v_junction = Math.min(v_junction, v_target_arr[j], v_target_arr[j+1]);
            }
            v_junction_arr[j] = v_junction;
        }
        if (numPaths > 0) v_junction_arr[numPaths - 1] = 0;
        
        // Forward pass
        let current_v_entry = 0;
        for (let j = 0; j < numPaths; j++) {
            v_entry_arr[j] = current_v_entry;
            let v_exit_max = Math.sqrt(current_v_entry * current_v_entry + 2 * a_max * s_arr[j]);
            v_exit_arr[j] = Math.min(v_exit_max, v_junction_arr[j], v_target_arr[j]);
            current_v_entry = v_exit_arr[j];
        }
        
        // Backward pass
        let current_v_exit = 0;
        for (let j = numPaths - 1; j >= 0; j--) {
            v_exit_arr[j] = Math.min(v_exit_arr[j], current_v_exit);
            let v_entry_max = Math.sqrt(v_exit_arr[j] * v_exit_arr[j] + 2 * a_max * s_arr[j]);
            v_entry_arr[j] = Math.min(v_entry_arr[j], v_entry_max);
            current_v_exit = v_entry_arr[j];
        }
        
        let buffer = new Float32Array(numPaths * 12);
        
        for (let j = 0; j < numPaths; j++) {
            let p = layer.paths[j];
            let pType = p.type === 'extrude' ? 1 : (p.type === 'travel' ? 0 : 2);
            let flowRate = 0;
            let fVal = p.feedrate !== undefined ? p.feedrate : (p.f || 0);
            
            const fTypeStr = (p.featureType || '').toUpperCase();
            let fTypeId = 0;
            if (fTypeStr.includes('OUTER') || 
                fTypeStr.includes('EXTERNAL') || 
                fTypeStr.includes('WALL-OUTER') || 
                fTypeStr.includes('OUTER WALL') || 
                fTypeStr.includes('OVERHANG PERIMETER') || 
                fTypeStr.includes('OVERHANG WALL')) {
                fTypeId = 1;
            } else if (fTypeStr.includes('INNER') || fTypeStr.includes('PERIMETER') || fTypeStr.includes('WALL') || fTypeStr.includes('WALL-INNER')) {
                fTypeId = 2;
            } else if (fTypeStr.includes('SOLID INFILL') || fTypeStr.includes('BOTTOM') || fTypeStr.includes('INTERNAL SOLID')) {
                fTypeId = 4;
            } else if (fTypeStr.includes('INFILL') || fTypeStr.includes('FILL') || fTypeStr.includes('SPARSE')) {
                fTypeId = 3;
            } else if (fTypeStr.includes('TOP') || fTypeStr.includes('SKIN') || fTypeStr.includes('IRONING')) {
                fTypeId = 5;
            } else if (fTypeStr.includes('SUPPORT INTERFACE')) {
                fTypeId = 7;
            } else if (fTypeStr.includes('SUPPORT')) {
                fTypeId = 6;
            } else if (fTypeStr.includes('BRIDGE') || fTypeStr.includes('OVERHANG')) {
                fTypeId = 8;
            } else if (fTypeStr.includes('GAP')) {
                fTypeId = 9;
            } else if (fTypeStr.includes('SKIRT') || fTypeStr.includes('BRIM') || fTypeStr.includes('TOWER')) {
                fTypeId = 10;
            }
            
            let s = s_arr[j];
            let v_target = v_target_arr[j];
            let v_entry = v_entry_arr[j];
            let v_exit = v_exit_arr[j];
            
            let v_real = 0;
            let t_segment = 0;
            
            if (s > 0 && v_target > 0) {
                let max_reachable = Math.sqrt((v_entry * v_entry + v_exit * v_exit + 2 * a_max * s) / 2);
                if (max_reachable < v_target) {
                    v_real = max_reachable;
                    let t_acc = (v_real - v_entry) / a_max;
                    let t_dec = (v_real - v_exit) / a_max;
                    t_segment = t_acc + t_dec;
                } else {
                    v_real = v_target;
                    let d_acc = (v_real * v_real - v_entry * v_entry) / (2 * a_max);
                    let d_dec = (v_real * v_real - v_exit * v_exit) / (2 * a_max);
                    let d_cruise = Math.max(0, s - d_acc - d_dec);
                    let t_acc = (v_real - v_entry) / a_max;
                    let t_dec = (v_real - v_exit) / a_max;
                    let t_cruise = d_cruise / v_real;
                    t_segment = t_acc + t_dec + t_cruise;
                }
            }
              if (isNaN(t_segment) || !isFinite(t_segment) || t_segment < 0) {
                  t_segment = (s > 0 && v_target > 0) ? (s / v_target) : 0;
              }

            
            // Flowrate = Area * E_dist / time
            if (pType === 1 && fVal > 0) {
                let eDist = p.e - (j > 0 ? layer.paths[j-1].e : p.e);
                if (eDist > 0 && s > 0) {
                    let time = s / (fVal / 60);
                    flowRate = (eDist * Math.PI * Math.pow(1.75 / 2, 2)) / time;
                    if (flowRate > 15) {
                        if (!layer.hasHighFlowWarning) {
                            diagnosticWarnings.push({ type: 'high_flow', layerIndex: i, msg: 'High volumetric flow (' + flowRate.toFixed(1) + ' mm³/s) at Layer ' + i });
                            layer.hasHighFlowWarning = true;
                        }
                        healthScore -= 0.1;
                    }
                }
            }
            
            buffer[j * 12 + 0] = pType;
            buffer[j * 12 + 1] = p.x1;
            buffer[j * 12 + 2] = p.y1;
            buffer[j * 12 + 3] = p.x2;
            buffer[j * 12 + 4] = p.y2;
            buffer[j * 12 + 5] = fVal;
            buffer[j * 12 + 6] = flowRate;
            buffer[j * 12 + 7] = p.lineIndex || 0;
            buffer[j * 12 + 8] = fTypeId;
            buffer[j * 12 + 9] = v_real;
            buffer[j * 12 + 10] = t_segment;
            t_layer += t_segment;
        }
        
        // Thermal Trap Pass
        let overhang_length = 0;
        for (let j = 0; j < numPaths; j++) {
            let pType = buffer[j * 12 + 0];
            let x1 = buffer[j * 12 + 1];
            let y1 = buffer[j * 12 + 2];
            let x2 = buffer[j * 12 + 3];
            let y2 = buffer[j * 12 + 4];
            let fanPWM = layer.paths[j].fanPWM || 0;
            
            let diag_flag = 0;
            
            if (pType === 1) { // Extrude
                let dx = x2 - x1;
                let dy = y2 - y1;
                let steps = Math.max(1, Math.ceil(Math.sqrt(dx*dx + dy*dy) * 2)); // 0.5mm steps
                let isOverhang = (i > 0);
                
                for (let s = 0; s <= steps; s++) {
                    let cx = x1 + (dx * s) / steps;
                    let cy = y1 + (dy * s) / steps;
                    
                    let gx = Math.floor(cx * 2 + 800);
                    let gy = Math.floor(cy * 2 + 800);
                    
                    if (gx >= 1 && gx < 1599 && gy >= 1 && gy < 1599) {
                        currGrid[gy * 1600 + gx] = 1; // Draw to current grid
                        
                        // Check 3x3 neighborhood for support (approx 1.5mm)
                        let supported = false;
                        for(let dy=-1; dy<=1; dy++) {
                            for(let dx=-1; dx<=1; dx++) {
                                if (prevGrid[(gy+dy) * 1600 + (gx+dx)] === 1) supported = true;
                            }
                        }
                        if (supported) {
                            isOverhang = false;
                        }
                    }
                }
                
                if (isOverhang) {
                    overhang_length += Math.sqrt(dx*dx + dy*dy);
                    if (fanPWM < 180) {
                        if (t_layer < 6.0 || overhang_length > 15.0) {
                            diag_flag = 1;
                            if (!layer.hasThermalWarning) {
                                diagnosticWarnings.push({ type: 'thermal_risk', layerIndex: i, msg: 'Melting Risk (Layer ' + i + '): Überhang bei ' + t_layer.toFixed(1) + 's Layerzeit & ' + Math.round((fanPWM/255)*100) + '% Lüfter' });
                                layer.hasThermalWarning = true;
                            }
                            healthScore -= 0.01;
                        }
                    }
                } else {
                    overhang_length = 0;
                }
            }
            buffer[j * 12 + 11] = diag_flag;
        }
        
        // Swap grids
        prevGrid.set(currGrid);
        currGrid.fill(0);
        
        layer.paths = buffer;
        transferables.push(buffer.buffer);
    }
    
    // Check Klipper Start Sequence
    let hasHeated = false;
    let hasHomed = false;
    for(let i=0; i<Math.min(lines.length, 1000); i++) {
        let l = lines[i].toUpperCase();
        if (l.includes('M190') || l.includes('M140') || l.includes('BED_TEMP')) hasHeated = true;
        if (l.startsWith('G28')) {
            hasHomed = true;
            if (!hasHeated) {
                diagnosticWarnings.push({ type: 'klipper_home', msg: 'Homing before heating bed.' });
                healthScore -= 5;
            }
        }
    }
    
    healthScore = Math.max(0, healthScore);
    
    self.postMessage({
            type: 'done',
            layerList: layerList,
            stats: stats,
            defaults: defaults,
            foundK: foundK
        , 
            diagnostics: { warnings: diagnosticWarnings, score: healthScore }
        }, transferables);
    };

    processChunk(0);
};

