// Google Sites kompatibilitási réteg
window.Eb = window.Eb || {};
window.Eb.Ja = {
    init: function() { this.run(); },
    run: async function() {
        const CACHE_VERSION = 'v6.9.9'; 
        const RAIN_THRESHOLD = 8;

        const memStore = {};
        const safeStorage = {
            getItem: (k) => { try { return localStorage.getItem(k) || memStore[k]; } catch(e) { return memStore[k]; } },
            setItem: (k, v) => { try { localStorage.setItem(k, v); } catch(e) { } memStore[k] = v; },
            removeItem: (k) => { try { localStorage.removeItem(k); } catch(e) { } delete memStore[k]; }
        };

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lat') && urlParams.has('lon')) {
            const pLat = parseFloat(urlParams.get('lat')), pLon = parseFloat(urlParams.get('lon'));
            if (!isNaN(pLat) && !isNaN(pLon) && pLat > 45.7 && pLat < 48.6 && pLon > 16.1 && pLon < 22.9) {
                safeStorage.setItem('garden-lat', pLat);
                safeStorage.setItem('garden-lon', pLon);
                safeStorage.removeItem('garden-weather-cache');
            }
        }

        const styleSheet = document.createElement("style");
        styleSheet.textContent = `
            @keyframes pulse-invitation { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            #kertfigyelo { width: 300px; text-align: left; background: white; font-family: 'Plus Jakarta Sans', sans-serif; }
            .garden-main-card { padding: 18px; display: flex; flex-direction: column; min-height: 480px; user-select: none; }
            .garden-title { font-family: 'Dancing Script', cursive; font-size: 3.6em; font-weight: 700; text-align: center; margin: 5px 0 12px 0; color: #1a1a1a; line-height: 1.1; }
            .section-title { font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.06); color: #64748b; }
            .carousel-wrapper { position: relative; height: 140px; margin-bottom: 5px; overflow: hidden; }
            .carousel-item { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; visibility: hidden; transition: opacity 1.2s ease-in-out; display: flex; flex-direction: column; justify-content: center; }
            .carousel-item.active { opacity: 1; visibility: visible; }
            .card-container { position: relative; padding-left: 14px; box-sizing: border-box; }
            .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
            .card-type-alert { background: #b91c1c; }
            .card-type-window { background: #2d6a4f; }
            .card-type-info { background: #6691b3; }
            .event-name { font-weight: 800; font-size: 16px; margin-bottom: 2px; color: #1e293b; line-height: 1.2; }
            .event-range { font-size: 11px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; color: #64748b; }
            .event-msg { font-size: 14px; line-height: 1.45; color: #334155; }
            .time-badge { display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: 800; border-radius: 3px; margin-right: 5px; color: #fff; vertical-align: middle; }
            .type-szezon { background: #1e293b; }
            .type-szemle { background: #0891b2; }
            .time-urgent { background: #b91c1c; }
            .time-warning { background: #ea580c; }
            .time-soon { background: #64748b; }
            .garden-footer { text-align: center; font-size: 10px; margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05); opacity: 0.6; }
            .loc-btn { width: 100%; cursor: pointer; padding: 10px; font-size: 10px; font-weight: 800; border: none; background: linear-gradient(270deg, #346080, #6691b3, #346080); background-size: 200% 200%; color: white; animation: pulse-invitation 8s ease infinite; text-transform: uppercase; }
            .refresh-btn { position: absolute; top: 15px; right: 15px; background: transparent; border: none; color: #cbd5e1; cursor: pointer; padding: 5px; z-index: 10; transition: color 0.3s; display: flex; align-items: center; justify-content: center; } .refresh-btn:hover { color: #64748b; } .refresh-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
        `;
        document.head.appendChild(styleSheet);

        const noon = d => new Date(d).setHours(12,0,0,0);

        // PostMessage segédfüggvény
        function notifyLocationChange(lat, lon, isPers) {
            try {
                window.parent.postMessage({
                    type: 'GARDEN_LOCATION_CHANGED',
                    source: 'kert-widget',
                    data: { lat: lat, lon: lon, isPers: isPers }
                }, '*');
                console.log('📍 Lokáció változás továbbítva:', lat, lon);
            } catch(e) {
                console.warn('PostMessage hiba:', e);
            }
        }

        function processMessage(msg, weather, dryDays, targetIdx) {
            if (!msg || !weather?.daily) return "";
            try {
                const d = weather.daily, idx = targetIdx || 7;
                const diffFn = (arr) => (arr[idx] || 0) - (arr[idx-1] || 0);
                const tMin = Math.round(d.temperature_2m_min[idx]);
                const tDiff = diffFn(d.temperature_2m_min);
                let tTrend = "";
                if (Math.abs(tDiff) >= 2.5) {
                    if (tDiff > 0) {
                        if (tMin <= -10) tTrend = " (marad a kemény fagy)";
                        else if (tMin <= -5) tTrend = " (marad a fagyos idő)";
                        else if (tMin < 0) tTrend = " (enyhülés kezdődik)";
                        else if (tMin > 25) tTrend = " (további hőség várható)";
                        else tTrend = " (melegedés várható)";
                    } else {
                        if (tMin <= -10) tTrend = " (fokozódó, kemény fagy)";
                        else if (tMin <= -5) tTrend = " (erősödő fagy jön)";
                        else if (tMin > 20) tTrend = " (enyhülés a hőségben)";
                        else tTrend = " (lehűlés jön)";
                    }
                }
                const wGust = Math.round(d.wind_gusts_10m_max[idx]);
                const wDiff = diffFn(d.wind_gusts_10m_max);
                let wTrend = "";
                if (Math.abs(wDiff) >= 10) {
                    wTrend = wDiff > 0 ? (wGust > 40 ? " (további erősödés várható)" : " (élénkülő szél)") : (wGust > 25 ? " (mérséklődő szél, de élénk marad)" : " (csendesedés várható, eláll a szél)");
                }
                const rSum = d.precipitation_sum[idx];
                const rDiff = diffFn(d.precipitation_sum);
                let rTrend = "";
                if (Math.abs(rDiff) >= 5) {
                    rTrend = rDiff > 0 ? " (intenzívebb eső jön)" : (rSum < 3 ? " (csendesedő eső, hamarosan eláll)" : " (gyengülő esőzés)");
                }
                const sSum = d.snowfall_sum[idx];
                const sDiff = diffFn(d.snowfall_sum);
                let sTrend = "";
                if (Math.abs(sDiff) >= 2) {
                    sTrend = sDiff > 0 ? " (erősödő havazás)" : (sSum < 1 ? " (hamarosan eláll)" : " (gyengülő havazás)");
                }
                msg = msg.replace("{temp}", tMin).replace("{wind}", wGust).replace("{rain}", Math.round(rSum))
                         .replace("{days}", dryDays).replace("{soil_temp}", d.soil_temperature_6cm[idx] ? Math.round(d.soil_temperature_6cm[idx]) : "--")
                         .replace("{snow}", Math.round(Math.max(...d.snowfall_sum.slice(Math.max(0, idx-2), idx+1)) * 10) / 10)
                         .replace("{temp_trend}", tTrend).replace("{wind_trend}", wTrend).replace("{rain_trend}", rTrend).replace("{snow_trend}", sTrend);

                if (msg.includes("{next_rain}")) {
                    const nIdx = d.precipitation_sum.slice(idx + 1).findIndex(p => p >= 1);
                    msg = msg.replace("{next_rain}", nIdx !== -1 ? `Eső: ${new Date(d.time[idx+1+nIdx]).toLocaleDateString('hu-HU',{weekday:'long'})} (${Math.round(d.precipitation_sum[idx+1+nIdx])}mm).` : "Nincs eső a kilátásban.");
                }
            } catch(e) { console.warn("UX/Trend hiba:", e); }
            return msg.split(/([.!?])\s+/).map((s, i, a) => (i % 2 === 0 && s) ? `<span style="display:block; margin-bottom:5px;">${s}${a[i+1] || ""}</span>` : "").join('');
        }

        function checkCondition(weather, idx, key, val, dryDays, isCheck) {
            const d = weather.daily;
            if (!d || idx < 0) return false;
            const lookback = isCheck ? 2 : 7;
            const checkPast = (array, threshold) => array.slice(Math.max(0, idx - lookback), idx + 1).some(v => v >= threshold);
            if (key === 'temp_max_below') return d.temperature_2m_max[idx] <= val;
            if (key === 'temp_min_below' || key === 'temp_below') return d.temperature_2m_min[idx] <= val;
            if (key === 'temp_min_above') return d.temperature_2m_min[idx] >= val;
            if (key === 'temp_above') return d.temperature_2m_max[idx] >= val;
            if (key === 'soil_temp_above') return d.soil_temperature_6cm && d.soil_temperature_6cm[idx] >= val;
            if (key === 'soil_temp_below') return d.soil_temperature_6cm && d.soil_temperature_6cm[idx] <= val;
            if (key === 'rain_min' || key === 'rain_min_any') return key.endsWith('_any') ? checkPast(d.precipitation_sum, val) : d.precipitation_sum[idx] >= val;
            if (key === 'rain_max') return d.precipitation_sum[idx] <= val;
            if (key === 'wind_max') return d.wind_speed_10m_max[idx] <= val;
            if (key === 'wind_gusts_min' || key === 'wind_gusts_min_any') return key.endsWith('_any') ? checkPast(d.wind_gusts_10m_max, val) : d.wind_gusts_10m_max[idx] >= val;
            if (key === 'snow_min' || key === 'snow_min_any') return key.endsWith('_any') ? checkPast(d.snowfall_sum, val) : d.snowfall_sum[idx] >= val;
            if (key === 'days_min') return dryDays >= val;
            if (key === 'days_max') return dryDays <= val;
            return false;
        }

        function checkSustained(weather, dayIdx, rule, dryDays) {
            const cond = rule.conditions || {};
            const isCheck = rule.category === 'check';
            if (isCheck) {
                for (let i = 0; i <= 1; i++) {
                    let match = true;
                    for (let k in cond) if (!checkCondition(weather, dayIdx-i, k, cond[k], dryDays, true)) { match = false; break; }
                    if (match) return true;
                }
                return false;
            }
            const days = (cond.days_min && !cond.temp_above) ? 1 : (cond.days_min || 1);
            for (const key in cond) {
                if (key === 'days_min' || key === 'days_max') continue;
                if (key.endsWith('_any')) {
                    if (!checkCondition(weather, dayIdx, key, cond[key], dryDays, false)) return false;
                } else {
                    for (let j = 0; j < days; j++) if (!checkCondition(weather, dayIdx-j, key, cond[key], dryDays, false)) return false;
                }
            }
            return true;
        }

        function renderZone(items, id) {
            if (!items.length) return `<div class="carousel-wrapper" style="display:flex;align-items:center;justify-content:center;opacity:0.3;font-size:12px;">Nincs aktuális esemény</div>`;
            return `<div id="${id}-carousel" class="carousel-wrapper">${items.map((item, idx) => `<div class="carousel-item ${idx === 0 ? 'active' : ''}"><div class="card-container"><div class="card-line card-type-${item.type}"></div><div class="event-name">${item.title}</div><div class="event-range">${item.range}</div><div class="event-msg">${item.msg}</div></div></div>`).join('')}</div>`;
        }

        const widgetDiv = document.getElementById('kertfigyelo');
        if (!widgetDiv) return;
        widgetDiv.innerHTML = `<div style="padding:60px 20px;text-align:center;"><div style="font-size:40px;animation: pulse-invitation 2s infinite;">🌱</div><div style="margin-top:15px; font-size:14px; color:#64748b; font-weight:700;">A kerted betöltése...</div></div>`;

        try {
            const _loc = [47.5136, 19.3735];
            const lat = parseFloat(safeStorage.getItem('garden-lat')) || _loc[0];
            const lon = parseFloat(safeStorage.getItem('garden-lon')) || _loc[1];
            const isPers = !!safeStorage.getItem('garden-lat');

            let weather, lastUpdate;
            const cached = safeStorage.getItem('garden-weather-cache');
            if (cached) {
                try {
                    const p = JSON.parse(cached);
                    if (p.version === CACHE_VERSION && Date.now() - p.ts < 1800000) { weather = p.data; lastUpdate = new Date(p.ts); }
                } catch(e) { safeStorage.removeItem('garden-weather-cache'); }
            }

            if (!weather) {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,snowfall_sum,precipitation_probability_max&hourly=soil_temperature_6cm&past_days=7&timezone=auto&v=${Date.now()}`;
                const rawData = await (await fetch(url)).json();
                rawData.daily.soil_temperature_6cm = rawData.daily.time.map((_, i) => rawData.hourly.soil_temperature_6cm[i * 24 + 12] ?? null);
                weather = rawData; lastUpdate = new Date();
                safeStorage.setItem('garden-weather-cache', JSON.stringify({ version: CACHE_VERSION, ts: lastUpdate.getTime(), data: weather }));
            }

            const todayIdx = 7;
            if (weather.daily.precipitation_sum[todayIdx] >= RAIN_THRESHOLD) {
                safeStorage.setItem('last_rain_date', weather.daily.time[todayIdx]);
            }
            const storedLastRain = safeStorage.getItem('last_rain_date');
            let dryDays = 0;
            if (storedLastRain) {
                dryDays = Math.floor(Math.abs(noon(new Date()) - noon(new Date(storedLastRain))) / 86400000);
            } else {
                let lastRainIdx = -1;
                for (let i = todayIdx; i >= 0; i--) if (weather.daily.precipitation_sum[i] >= RAIN_THRESHOLD) { lastRainIdx = i; break; }
                dryDays = lastRainIdx === -1 ? 10 : (todayIdx - lastRainIdx);
            }

            const rules = await (await fetch('https://raw.githack.com/amezitlabaskert-lab/kertfigyelo/main/kertfigyelo_esemenyek.json?v=' + Date.now())).json();
            const rawResults = [];
            rules.forEach(rule => {
                let range = null, tIdx = null;
                for (let i = todayIdx; i < weather.daily.time.length; i++) {
                    const d = new Date(weather.daily.time[i]);
                    const inSeason = !rule.seasons || rule.seasons.some(s => {
                        const [sM, sD] = s.start.split('-').map(Number), [eM, eD] = s.end.split('-').map(Number);
                        const sDate = new Date(d.getFullYear(), sM-1, sD), eDate = new Date(d.getFullYear(), eM-1, eD);
                        return eDate < sDate ? (d >= sDate || d <= eDate) : (d >= sDate && d <= eDate);
                    });
                    if (inSeason && checkSustained(weather, i, rule, dryDays)) {
                        if (!range) { range = {start:d, end:d}; tIdx = i; } else range.end = d;
                    } else if (range) break;
                }
                if (range) rawResults.push({...rule, start: range.start, end: range.end, targetIdx: tIdx});
            });

            const groupWinners = {};
            rawResults.forEach(r => { if (r.group && (!groupWinners[r.group] || (r.priority || 0) > (groupWinners[r.group].priority || 0))) groupWinners[r.group] = r; });
            const filtered = rawResults.filter(r => !r.group || r.id === groupWinners[r.group].id);

            const mapToRes = (item) => {
                const diff = Math.round((noon(item.start) - noon(new Date())) / 86400000);
                let label = diff < 0 ? "FOLYAMATBAN" : (diff === 0 ? "MA" : diff + " NAP MÚLVA");
                if (item.category === "seasonal") label = "SZEZONÁLIS";
                if (item.category === "check") label = "SZEMLE";
                if (item.id.includes('aszaly') && dryDays >= 7) label = dryDays >= 14 ? `${Math.floor(dryDays/7)} HETE TART` : `${dryDays} NAPJA TART`;
                const badge = item.category === "seasonal" ? 'type-szezon' : (item.category === "check" ? 'type-szemle' : (diff <= 0 ? 'time-urgent' : (diff === 1 ? 'time-warning' : 'time-soon')));
                let rangeStr = `<span class="time-badge ${badge}">${label}</span>`;
                if (!["seasonal", "check"].includes(item.category) && noon(item.start) !== noon(item.end)) rangeStr += ` — ${new Date(item.end).toLocaleDateString('hu-HU',{month:'short',day:'numeric'}).toUpperCase()}`;
                return { title: item.name, range: rangeStr, msg: processMessage(item.message, weather, dryDays, item.targetIdx), type: item.type };
            };

            const alerts = filtered.filter(r => r.type === 'alert').map(mapToRes);
            let others = filtered.filter(r => r.type === 'window').map(mapToRes);
            if (!others.length) others = filtered.filter(r => ['info', 'none', 'window'].includes(r.type)).map(mapToRes);

            widgetDiv.innerHTML = `
                <div class="garden-main-card">
                    <div class="garden-title">${isPers ? 'Kertfigyelőm' : 'Kertfigyelő'}</div>
                    <button id="locBtn" class="loc-btn">${isPers ? 'Vissza az alaphoz' : 'Saját kertfigyelőt!'}</button>
                    <button id="refBtn" class="refresh-btn"><svg viewBox="0 0 24 24"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></button>
                    <div class="section-title">Riasztások</div>${renderZone(alerts, 'alert')}
                    <div class="section-title">Teendők & Info</div>${renderZone(others, 'tasks')}
                    <div class="garden-footer">Helyszín: ${isPers ? 'A kertem' : 'A Mezítlábas Kert bázisa'}<br>Frissítve: ${lastUpdate.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})} | ${CACHE_VERSION}</div>
                </div>`;

            document.getElementById('refBtn').onclick = () => { safeStorage.removeItem('garden-weather-cache'); location.reload(); };
            document.getElementById('locBtn').onclick = () => {
                if (isPers) { 
                    // Vissza az alaphoz
                    ['garden-lat','garden-lon','garden-weather-cache','last_rain_date'].forEach(k => safeStorage.removeItem(k)); 
                    notifyLocationChange(_loc[0], _loc[1], false);
                    location.reload(); 
                }
                else { 
                    // Saját lokáció kérése
                    navigator.geolocation.getCurrentPosition(p => {
                        const {latitude: la, longitude: lo} = p.coords;
                        if (la > 45.7 && la < 48.6 && lo > 16.1 && lo < 22.9) { 
                            safeStorage.setItem('garden-lat', la); 
                            safeStorage.setItem('garden-lon', lo); 
                            safeStorage.removeItem('garden-weather-cache'); 
                            notifyLocationChange(la, lo, true);
                            location.reload(); 
                        }
                        else alert("Csak Magyarország területén működik. 🇭🇺");
                    }, (err) => { alert('GPS hiba: ' + err.message); }, { timeout: 10000 });
                }
            };
            const setup = (id, len) => { if (len <= 1) return; const items = document.querySelectorAll(`#${id}-carousel .carousel-item`); let i = 0; setInterval(() => { if(items[i]) items[i].classList.remove('active'); i = (i + 1) % len; if(items[i]) items[i].classList.add('active'); }, 8000); };
            setup('alert', alerts.length); setup('tasks', others.length);
        } catch(e) { 
            console.error("Widget hiba:", e);
            widgetDiv.innerHTML = `<div style="padding:40px;text-align:center;">⚠️ Hiba a kerted elérése közben. Próbáld újra!</div>`; 
        }

        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }
};

if (document.readyState === 'complete') { window.Eb.Ja.init(); }
else { window.addEventListener('load', () => window.Eb.Ja.init()); }
