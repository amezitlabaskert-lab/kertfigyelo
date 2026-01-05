(async function() {
    // 1. Fontok és Stílusok (v3.7.2 - Multi-Range & Better Alert Matching)
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes pulse-invitation {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(71, 85, 105, 0.4); }
            70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(71, 85, 105, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(71, 85, 105, 0); }
        }
        #smart-garden-widget { width: 300px; text-align: left; margin: 0 auto; }
        .garden-main-card { 
            background: #ffffff !important; padding: 18px; margin-bottom: 20px !important; 
            box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.5) !important;
            border-radius: 0 !important; height: 480px; display: flex; flex-direction: column;
            border: 1px solid #eee;
        }
        .garden-title { font-family: 'Dancing Script', cursive !important; font-size: 3.6em !important; font-weight: 700 !important; text-align: center !important; margin: 5px 0 12px 0 !important; line-height: 1.1; color: #1a1a1a; }
        .section-title { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 14px !important; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.06); color: #64748b; }
        .carousel-wrapper { position: relative; height: 125px; margin-bottom: 5px; overflow: hidden; }
        .carousel-item { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; visibility: hidden; transition: opacity 1.2s ease-in-out; }
        .carousel-item.active { opacity: 1; visibility: visible; }
        .card-container { position: relative; padding-left: 14px; height: 100%; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .card-type-alert { background: #b91c1c !important; }
        .card-type-window { background: #2d6a4f !important; }
        .card-type-info { background: #6691b3 !important; }
        .card-type-none { background: #94a3b8 !important; }
        .event-name { font-family: 'Plus Jakarta Sans', sans-serif !important; font-weight: 800 !important; font-size: 16px !important; margin-bottom: 2px; color: #1e293b; }
        .event-range { display: flex; align-items: center; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 11px !important; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; color: #64748b; }
        .time-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px !important; font-weight: 800; margin-right: 5px; vertical-align: middle; }
        .time-urgent { background: #b91c1c; color: #fff; animation: pulse-invitation 2s infinite; }
        .time-warning { background: #ea580c; color: #fff; }
        .time-soon { background: #64748b; color: #fff; }
        .event-msg { font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 14px !important; line-height: 1.45; color: #334155; }
        .garden-footer { text-align: center; font-family: 'Plus Jakarta Sans', sans-serif !important; font-size: 10px !important; margin-top: auto; padding-top: 8px; line-height: 1.4; border-top: 1px solid rgba(0,0,0,0.05); opacity: 0.6; }
        .loc-btn { 
            width: 100%; cursor: pointer; padding: 10px; font-family: 'Plus Jakarta Sans', sans-serif !important; 
            font-size: 10px; margin-bottom: 5px; text-transform: uppercase; font-weight: 800; border: none; 
            background: #475569; color: white; transition: background 0.3s;
            animation: pulse-invitation 3s infinite ease-in-out;
        }
    `;
    document.head.appendChild(styleSheet);

    const getSeasonalFallback = (type) => {
        const month = new Date().getMonth() + 1;
        const isWinter = month === 12 || month <= 2;
        if (type === 'alert') return { range: "TÉL", title: "🛡️ Biztonságos pihenés", msg: "Nincs extrém fagyveszély.", type: "none" };
        return { range: "TÉL", title: "☕ Téli álom", msg: "Tea, takaró és tervezgetés.", type: "none" };
    };

    function checkSustained(weather, dayIdx, cond, ruleType) {
        const days = cond.days_min || 1;
        if (dayIdx < days - 1) return false;
        const checkCondition = (key, idx) => {
            let val;
            const condValue = cond[key];
            if (key === 'temp_max_below') { val = weather.daily.temperature_2m_max[idx]; return val <= condValue; } 
            else if (key === 'temp_min_below' || key === 'temp_below') { val = weather.daily.temperature_2m_min[idx]; return val <= condValue; } 
            else if (key === 'temp_above') { val = weather.daily.temperature_2m_max[idx]; return val >= condValue; }
            return true;
        };
        for (const key in cond) {
            if (key === 'days_min') continue;
            const ok = Array.from({length: days}, (_, j) => checkCondition(key, dayIdx - j)).every(r => r);
            if (!ok) return false;
        }
        return true;
    }

    async function init() {
        const widgetDiv = document.getElementById('smart-garden-widget');
        if (!widgetDiv) return;
        
        try {
            let lat = 47.5136, lon = 19.3735, userCity = "Gödöllő";
            const sLat = localStorage.getItem('garden-lat'), sLon = localStorage.getItem('garden-lon');
            if (sLat && sLon) { lat = Number(sLat); lon = Number(sLon); }

            try {
                const geo = await fetch('https://ipapi.co/json/');
                const gData = await geo.json();
                userCity = gData.city || "Gödöllő";
            } catch(e) {}

            const [rulesRes, hungaroRes, weatherRes] = await Promise.all([
                fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json'),
                fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/workflows/main/riasztasok.json'),
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum&timezone=auto`)
            ]);
            
            const rules = await rulesRes.json();
            const hData = await hungaroRes.json();
            const weather = await weatherRes.json();
            const lastUpdate = new Date();

            const results = [];
            
            // 1. HungaroMet Fix - Több járási név variáció keresése
            if (hData.alerts) {
                const searchCity = userCity.replace('i','').toLowerCase();
                const myAlert = hData.alerts.find(a => a.j.some(jaras => jaras.toLowerCase().includes(searchCity)));
                if (myAlert) {
                    const isFuture = myAlert.f === 'wbhx';
                    results.push({
                        range: `<span class="time-badge ${isFuture ? 'time-warning' : 'time-urgent'}">${isFuture ? 'HOLNAP' : 'MOST'}</span>`,
                        title: `MET: ${myAlert.v}`,
                        msg: `Hivatalos figyelmeztetés: ${myAlert.v} (${myAlert.sz}. fokozat).`,
                        type: 'alert'
                    });
                }
            }

            // 2. Open-Meteo Fix - Több tartomány támogatása
            const todayStr = new Date().toISOString().split('T')[0];
            const noon = d => new Date(d).setHours(12,0,0,0);

            rules.forEach(rule => {
                let currentRange = null;
                for (let i = 0; i < weather.daily.time.length; i++) {
                    const d = new Date(weather.daily.time[i]);
                    if (checkSustained(weather, i, rule.conditions || {}, rule.type)) {
                        if (!currentRange) currentRange = { start: d, end: d }; else currentRange.end = d;
                    } else if (currentRange) {
                        processRange(currentRange, rule);
                        currentRange = null;
                    }
                }
                if (currentRange) processRange(currentRange, rule);
            });

            function processRange(range, rule) {
                const todayNoon = noon(todayStr);
                if (noon(range.end) < todayNoon) return;
                
                const isTodayActive = (todayNoon >= noon(range.start) && todayNoon <= noon(range.end));
                const displayStart = isTodayActive ? new Date(todayStr) : range.start;
                
                const fmt = (date, isStart) => {
                    const diff = Math.round((noon(date) - todayNoon) / 86400000);
                    if (isStart) {
                        let label = diff <= 0 ? "MA" : (diff === 1 ? "HOLNAP" : diff + " NAP MÚLVA");
                        let cls = diff <= 0 ? "time-urgent" : (diff === 1 ? "time-warning" : "time-soon");
                        return `<span class="time-badge ${cls}">${label}</span>`;
                    }
                    return date.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).toUpperCase().replace('.','');
                };

                results.push({ 
                    range: fmt(displayStart, true) + (noon(displayStart) !== noon(range.end) ? ' — ' + fmt(range.end, false) : ''),
                    title: rule.name, msg: rule.message, type: rule.type 
                });
            }

            const renderZone = (items, fallback, id) => {
                const display = items.length ? items : (fallback ? [fallback] : []);
                if (!display.length) return '';
                return `<div id="${id}-carousel" class="carousel-wrapper">${display.map((item, idx) => `
                    <div class="carousel-item ${idx === 0 ? 'active' : ''}"><div class="card-container">
                        <div class="card-line card-type-${item.type}"></div>
                        <div class="event-name">${item.title}</div>
                        <div class="event-range">${item.range}</div>
                        <div class="event-msg">${item.msg}</div>
                    </div></div>`).join('')}</div>`;
            };

            widgetDiv.innerHTML = `
                <div class="garden-main-card">
                    <div class="garden-title">Kertfigyelő</div>
                    <button id="locBtn" class="loc-btn">${sLat ? 'Vissza az alaphoz' : 'Saját kertfigyelőt!'}</button>
                    <div class="section-title">Riasztások</div>
                    ${renderZone(results.filter(r => r.type === 'alert'), getSeasonalFallback('alert'), 'alert')}
                    <div class="section-title">Teendők</div>
                    ${renderZone(results.filter(r => r.type !== 'alert' && r.type !== 'window'), getSeasonalFallback('info'), 'info')}
                    <div class="garden-footer">Last updated: ${lastUpdate.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}<br>v3.7.2 - Frost & MET Fixed</div>
                </div>`;

            document.getElementById('locBtn').onclick = () => {
                if (sLat) { localStorage.removeItem('garden-lat'); localStorage.removeItem('garden-lon'); location.reload(); }
                else { navigator.geolocation.getCurrentPosition(p => {
                    localStorage.setItem('garden-lat', p.coords.latitude); localStorage.setItem('garden-lon', p.coords.longitude); location.reload();
                }, () => alert("Helyadat szükséges.")); }
            };

            const setupCarousel = (id) => {
                const items = document.querySelectorAll(`#${id}-carousel .carousel-item`);
                if (items.length <= 1) return;
                let idx = 0;
                setInterval(() => {
                    items[idx].classList.remove('active');
                    idx = (idx + 1) % items.length;
                    items[idx].classList.add('active');
                }, 5000);
            };
            ['alert', 'info'].forEach(setupCarousel);

        } catch(e) { console.error(e); }
    }
    init();
})();
