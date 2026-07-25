self.onmessage = function(e) {
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
                
                if (eMatch) {
                    const eVal = parseFloat(eMatch[1]);
                    if (isRelativeE) {
                        if (eVal > 0) totalE += eVal;
                        else if (eVal < 0) totalRetracts++;
                    } else {
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
