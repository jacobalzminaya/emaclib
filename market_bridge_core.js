const MarketBridge = {
    predictions: {}, 
    stats: {},
    lastLeaderV: null,
    isLocked: false,
    equity: 1000.00,
    minBet: 10,
    payout: 0.85,
    
    // --- NUEVAS PROPIEDADES DE CONTROL ---
    consecutiveFails: {}, // Memoria de fallos para penalizar líderes
    currentStreak: { val: null, count: 0 }, // Contador de agotamiento

    init() {
        window.sequence = window.sequence || [];
        for(let i=3; i<=12; i++) {
            this.stats[i] = { hits: 0, total: 0, timeline: [] }; 
            this.consecutiveFails[i] = 0; // Inicializar penalización
        }
        this.setupInput();
        UIManager.updateWealthUI(this.equity);
    },

    setupInput() {
        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const side = (e.button === 0) ? 'A' : (e.button === 2 ? 'B' : null);
            if (side) this.injectManual(side);
        });
        document.addEventListener('contextmenu', e => e.preventDefault());
    },

    injectManual(type) {
        this.processWealth(type);
        this.verifyAccuracy(type);
        
        // Actualizar contador de agotamiento (Técnica 1)
        if (this.currentStreak.val === type) {
            this.currentStreak.count++;
        } else {
            this.currentStreak.val = type;
            this.currentStreak.count = 1;
        }

        window.sequence.push({ val: type, time: Date.now() });
        
        UIManager.updateVisualTrack(window.sequence);
        this.runMultiAnalysis();
        
        if (this.calculateVolatility() >= 8 && !this.isLocked) this.activateSecurityLock();

        this.checkExtremeLimits();
        this.findGeneticMatch(); 
        this.updateMainSignal();  
    },

    // 🧠 MOTOR MEJORADO: Penalización de Fallos (Técnica 2)
    findGeneticMatch() {
        if (this.isLocked) return;
        let bestV = null; 
        let maxWeight = -1;
        const history = window.sequence.map(v => v.val).join('');
        
        for (let v = 3; v <= 12; v++) {
            if (window.sequence.length < v) continue;
            
            const stats = this.stats[v];
            const accuracy = stats.total > 0 ? (stats.hits / stats.total) : 0;

            // FILTRO DE SENSIBILIDAD: Sube a 0.55 para mayor asertividad
            if (accuracy < 0.55 && stats.total > 10) continue;

            // PENALIZACIÓN POR MEMORIA: Si la ventana ha fallado seguido, su peso cae a 0
            if (this.consecutiveFails[v] >= 2) continue; 

            const pattern = history.slice(-v);
            const searchPool = history.slice(0, -1);
            const occurrences = (searchPool.match(new RegExp(pattern, 'g')) || []).length;
            const recentHits = stats.timeline.slice(-5).filter(s => s.success).length;
            
            // PESOS: 50% Historial, 40% Racha, 10% Frecuencia
            const weight = (accuracy * 0.5) + (recentHits * 0.4) + (occurrences * 0.1);
            
            if (weight > maxWeight && this.predictions[v] !== "---") {
                maxWeight = weight; 
                bestV = v;
            }
        }

        if (bestV) {
            this.lastLeaderV = bestV;
            this.updateLeaderUI(bestV, history);
        }
    },

    // 🚀 MASTER LOGIC: Consenso Fractal y Agotamiento (Técnica 3)
    updateMainSignal() {
        if (this.isLocked) return;
        
        let groups = { short: [], mid: [], long: [] };
        let powerB = 0; let powerS = 0;

        for(let v=3; v<=12; v++) {
            const pred = this.predictions[v];
            const acc = this.stats[v].total > 0 ? (this.stats[v].hits / this.stats[v].total) : 0;
            if (pred === "---") continue;

            if (v <= 5) groups.short.push(pred);
            else if (v <= 9) groups.mid.push(pred);
            else groups.long.push(pred);

            if(pred === "BUY") powerB += acc;
            if(pred === "SELL") powerS += acc;
        }

        // Verificar Consenso entre grupos (Fractalidad)
        const hasConsensus = (g) => g.includes("BUY") && g.includes("SELL") ? false : (g.length > 0);
        const globalAgreement = (groups.short.includes("BUY") && groups.mid.includes("BUY") && groups.long.includes("BUY")) ||
                                (groups.short.includes("SELL") && groups.mid.includes("SELL") && groups.long.includes("SELL"));

        const side = document.getElementById('signal-side');
        const header = document.getElementById('header-signal');
        
        const totalPower = powerB + powerS;
        let assertiveness = totalPower > 0 ? Math.round((Math.max(powerB, powerS) / totalPower) * 100) : 0;

        // APLICAR FILTRO DE AGOTAMIENTO: 
        // Si hay racha de 4+ del mismo color, bajamos asertividad para no entrar al final
        if (this.currentStreak.count >= 4) {
            assertiveness -= (this.currentStreak.count * 5); 
        }

        if (globalAgreement && assertiveness > 70) {
            const finalDir = powerB > powerS ? "MASTER BUY" : "MASTER SELL";
            side.innerText = `🛡️ ${finalDir}`;
            side.style.color = powerB > powerS ? "var(--n-green)" : "var(--n-red)";
            header.style.background = powerB > powerS ? "rgba(0, 255, 136, 0.25)" : "rgba(255, 46, 99, 0.25)";
        } else if (assertiveness > 55) {
            const p = this.predictions[this.lastLeaderV] || "ESPERANDO";
            side.innerText = p;
            side.style.color = p === "BUY" ? "var(--n-green)" : "var(--n-red)";
            header.style.background = "#000";
        } else {
            side.innerText = "BUSCANDO CONSENSO";
            side.style.color = "var(--n-gold)";
            header.style.background = "#000";
        }

        document.getElementById('v-label').innerText = `ASERTIVIDAD: ${assertiveness}% | RACHA: ${this.currentStreak.count}`;
    },

    verifyAccuracy(actualType) {
        const actualLabel = actualType === 'A' ? 'BUY' : 'SELL';
        for (let v in this.predictions) {
            if (this.predictions[v] !== "---") {
                this.stats[v].total++;
                const isHit = this.predictions[v] === actualLabel;
                
                if (isHit) {
                    this.stats[v].hits++;
                    this.consecutiveFails[v] = 0; // Reset penalización
                } else {
                    this.consecutiveFails[v]++; // Aumentar castigo
                }
                this.stats[v].timeline.push({ success: isHit, prediction: this.predictions[v] });
            }
        }
    },

    // --- EL RESTO DE FUNCIONES SE MANTIENEN ---
    updateLeaderUI(bestV, history) {
        const pred = this.predictions[bestV];
        const acc = Math.round((this.stats[bestV].hits / this.stats[bestV].total) * 100) || 0;
        document.getElementById('ai-best-match').innerHTML = `LÍDER: <b style="color:var(--n-blue)">V${bestV}</b> [Fails: ${this.consecutiveFails[bestV]}]`;
        document.getElementById('ai-signal-value').innerText = pred;
        document.getElementById('ai-signal-value').style.color = pred === "BUY" ? "var(--n-green)" : "var(--n-red)";
        document.getElementById('ai-confidence').innerText = `${acc}% PRECISIÓN`;
    },

    checkExtremeLimits() {
        if (window.sequence.length < 10) return;
        const history = window.sequence.map(v => v.val).join('');
        const last10 = history.slice(-10);
        const countA = (last10.match(/A/g) || []).length;
        const countB = (last10.match(/B/g) || []).length;
        if (countA >= 8) UIManager.updateStretchUI("⚠️ AGOTAMIENTO ALCISTA", "var(--n-red)", true);
        else if (countB >= 8) UIManager.updateStretchUI("⚠️ AGOTAMIENTO BAJISTA", "var(--n-green)", true);
        else this.checkPriceStretch();
    },

    checkPriceStretch() {
        const lastData = window.sequence.slice(-6).map(v => v.val);
        if (lastData.length < 3) return;
        let count = 1;
        const lastVal = lastData[lastData.length - 1];
        for (let i = lastData.length - 2; i >= 0; i--) {
            if (lastData[i] === lastVal) count++; else break;
        }
        if (count >= 3) UIManager.updateStretchUI(`ALERTA GIRO: ${count} VELAS`, "var(--n-gold)");
        else UIManager.updateStretchUI("ESTADO: ESTABLE", "#666");
    },

    processWealth(actualType) {
        const actualLabel = actualType === 'A' ? 'BUY' : 'SELL';
        if (this.lastLeaderV && this.predictions[this.lastLeaderV] && this.predictions[this.lastLeaderV] !== "---") {
            const pred = this.predictions[this.lastLeaderV];
            if (pred === actualLabel) {
                this.equity += (this.minBet * this.payout);
                UIManager.addLog(`HIT $${(this.minBet * this.payout).toFixed(2)}`, "#00ff88");
            } else {
                this.equity -= this.minBet;
                UIManager.addLog(`MISS -$${this.minBet.toFixed(2)}`, "#ff2e63");
            }
            UIManager.updateWealthUI(this.equity);
        }
    },

    calculateVolatility() {
        if (window.sequence.length < 10) return 0;
        const last10 = window.sequence.slice(-10);
        let changes = 0;
        for (let i = 1; i < last10.length; i++) {
            if (last10[i].val !== last10[i-1].val) changes++;
        }
        return changes;
    },

    runMultiAnalysis() {
        const containers = { low: document.getElementById('col-low'), mid: document.getElementById('col-mid'), high: document.getElementById('col-high') };
        Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });
        const history = window.sequence.map(v => v.val).join('');
        for (let v = 3; v <= 12; v++) {
            if (window.sequence.length < v) continue;
            const pattern = history.slice(-v);
            const searchPool = history.slice(0, -1);
            const mA = (searchPool.match(new RegExp(pattern + 'A', 'g')) || []).length;
            const mB = (searchPool.match(new RegExp(pattern + 'B', 'g')) || []).length;
            let pred = mA > mB ? "BUY" : (mB > mA ? "SELL" : "---");
            this.predictions[v] = pred;
            const acc = this.stats[v].total > 0 ? Math.round((this.stats[v].hits / this.stats[v].total) * 100) : 0;
            const card = `<div class="window-card" style="border-right:3px solid ${pred==="BUY"?"var(--n-green)":"var(--n-red)"}">V${v} ${pred} (${acc}%)</div>`;
            if (acc >= 75) containers.high.innerHTML += card;
            else if (acc >= 55) containers.mid.innerHTML += card;
            else containers.low.innerHTML += card;
        }
    },

    activateSecurityLock() {
        this.isLocked = true;
        document.getElementById('signal-side').innerText = "PROTECCIÓN VOLATILIDAD";
        setTimeout(() => { this.isLocked = false; this.updateMainSignal(); }, 20000);
    },

    exportData() {
        let csv = "data:text/csv;charset=utf-8,REPORTE QUANTUM V5.5 PRO\nCapital:," + this.equity.toFixed(2) + "\n\nVENTANA,TOTAL,ACIERTOS,%\n";
        for (let v = 3; v <= 12; v++) {
            const s = this.stats[v];
            csv += `V${v},${s.total},${s.hits},${(s.total>0?(s.hits/s.total*100):0).toFixed(2)}%\n`;
        }
        const encodedUri = encodeURI(csv);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Reporte_Quantum_Pro.csv");
        document.body.appendChild(link); link.click();
    },

    reset() {
        window.sequence = []; this.equity = 1000;
        this.currentStreak = { val: null, count: 0 };
        UIManager.updateWealthUI(this.equity);
        this.runMultiAnalysis();
        UIManager.addLog("MOTOR REINICIADO", "var(--n-blue)");
    }
};

MarketBridge.init();