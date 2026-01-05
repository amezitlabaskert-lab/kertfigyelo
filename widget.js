(async function() {
    const version = "v4.0.0 - Seasonal Filter Fixed";
    const lastUpdatedLabel = "Last updated: " + new Date().toLocaleTimeString('hu-HU', {hour:'2-digit', minute:'2-digit'});

    // Styles (Maradt a letisztult design)
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        @keyframes pulse-inv { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(185,28,28,0.4); } 70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(185,28,28,0); } 100% { transform: scale(1); } }
        #smart-garden-widget { width: 300px; margin: 0 auto; font-family: 'Plus Jakarta Sans', sans-serif; }
        .garden-main-card { background: #fff!important; padding: 18px; box-shadow: 0 0 0 8px rgba(255,255,255,0.5)!important; height: 520px; display: flex; flex-direction: column; border: 1px solid #eee; border-radius: 4px; }
        .garden-title { font-family: 'Dancing Script', cursive!important; font-size: 3.6em!important; text-align: center; margin: 5px 0 12px; color: #1a1a1a; }
        .section-title { font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 8px; color: #64748b; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .carousel-wrapper { position: relative; height: 110px; overflow: hidden; margin-bottom: 10px; }
        .carousel-item { position: absolute; width: 100%; opacity: 0; visibility: hidden; transition: opacity 0.8s; }
        .carousel-item.active { opacity: 1; visibility: visible; }
        .card-container { position: relative; padding-left: 14px; }
        .card-line { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 2px; }
        .card-type-alert { background: #b91c1c; } .card-type-window { background: #2d6a4f; } .card-type-info { background: #6691b3; } .card-type-none { background: #94a3b8; }
        .time-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; margin-right: 5px; color: #fff; }
        .time-urgent { background: #b91c1c; animation: pulse-inv 2s infinite; }
        .time-warning { background: #ea580c; } .time-soon { background: #64748b; }
        .event-name { font-weight: 800; font-size: 15px; color: #1e293b; }
        .event-range { font-size: 10px; font-weight: 700; color: #64748b; margin: 2px 0; }
        .event-msg { font-size: 12px; line-height: 1.4; color: #334155; }
        .footer { text-align: center; font-size: 9px; margin-top: auto; opacity: 0.6; padding-top: 8px; border-top: 1px solid #eee; }
        .loc-btn { width: 100%; cursor: pointer; padding: 6px; font-size: 9px; font-weight: 800; border: none; background: #475569; color: #fff; text-transform: uppercase; margin-bottom: 4px; }
    `;
    document.head.appendChild(styleSheet);

    // FIXED: Reliable checkSustained logic
    function checkSustained(weather, dayIdx, cond, ruleType) {
        if (!cond || Object.keys(cond).length === 0) return false; // Szezonális kártyák ide nem jöhetnek be!
        const days = cond.days_min || 1;
        if (dayIdx < days - 1) return false;

        const checkSingle = (key, idx) => {
            const d = weather.daily;
            if (key === 'temp_min_below' || key === 'temp_below') return d.temperature_2m_min[idx] <= cond[key];
            if (key === 'temp_max_below') return d.temperature_2m_max[idx] <= cond[key];
            if (key === 'temp_above') return d.temperature_2m_max[idx] >= cond[key];
            if (key === 'rain_min') return d.precipitation_sum[idx] >= cond[key];
            if (key === 'rain_max') return d.precipitation_sum[idx] <= cond[key];
            const wKey = ruleType === 'alert' ? 'wind_gusts_10m_max' : 'wind_speed_10m_max';
            if (key === 'wind_min') return d[wKey][idx] >= cond[key];
            if (key === 'wind_max') return d[wKey][idx] <= cond[key];
            return true;
        };

        for (const key in cond) {
            if (key === 'days_min') continue;
            const isAny = key.endsWith('_any');
            const baseKey = isAny ? key.replace('_any', '') : key;
            const res = [];
            for (let j = 0; j < days; j++) res.push(checkSingle(baseKey, dayIdx - j));
            if (!(isAny ? res.some(r => r) : res.every(r => r))) return false;
        }
        return true;
    }

    async function init() {
        const container = document.getElementById('smart-garden-widget');
        if (!container) return;

        let lat = 47.5136, lon = 19.3735, city = "Isaszeg"; // Isaszeg default
        const sLat = localStorage.getItem('garden-lat'), sLon = localStorage.getItem('garden-lon');
        if (sLat) { lat = Number(sLat); lon = Number(sLon); }

        try {
            const [rulesJson, hData, weather] = await Promise.all([
                fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json').then(r => r.json()),
                fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/workflows/main/riasztasok.json').then(r => r.json()).catch(() => ({alerts:[]})),
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=auto`).then(r => r.json())
            ]);

            const results = [];
            const todayStr = new Date().toISOString().split('T')[0];
            const todayNoon = new Date(todayStr).setHours(12,0,0,0);
            const monthDay = new Date().toISOString().slice(5,10); // "MM-DD"

            // 1. MET ALERT
            if (hData.alerts) {
                const search = city.toLowerCase().replace('i','');
                const myAlert = hData.alerts.find(a => a.j.some(j => j.toLowerCase().includes(search)));
                if (myAlert) results.push({ type: 'alert', title: `MET: ${myAlert.v}`, range: `<span class="time-badge time-urgent">MOST</span>`, msg: `Figyelmeztetés (${myAlert.sz}. fokozat).` });
            }

            // 2. FILTERING RULES
            rulesJson.forEach(rule => {
                // Szezonális check (ha nincs condition)
                const isSeasonalOnly = !rule.conditions || Object.keys(rule.conditions).length === 0;
                
                if (isSeasonalOnly) {
                    const inSeason = rule.seasons ? rule.seasons.some(s => monthDay >= s.start && monthDay <= s.end) : false;
                    if (inSeason) results.push({ type: rule.type === 'none' ? 'info' : rule.type, title: rule.name, msg: rule.message, isBackground: true });
                    return;
                }

                // Weather rules (Multi-range)
                let current = null;
                for (let i = 0; i < weather.daily.time.length; i++) {
                    if (checkSustained(weather, i, rule.conditions, rule.type)) {
                        const d = weather.daily.time[i];
                        if (!current) current = { s: d, e: d }; else current.e = d;
                    } else if (current) {
                        pushRange(current, rule);
                        current = null;
                    }
                }
                if (current) pushRange(current, rule);
            });

            function pushRange(r, rule) {
                if (new Date(r.e).setHours(12,0,0,0) < todayNoon) return;
                const diff = Math.round((new Date(r.s).setHours(12,0,0,0) - todayNoon) / 86400000);
                const bClass = diff <= 0 ? "time-urgent" : (diff === 1 ? "time-warning" : "time-soon");
                const bText = diff <= 0 ? "MA" : (diff === 1 ? "HOLNAP" : diff + " NAP MÚLVA");
                const rangeStr = `<span class="time-badge ${bClass}">${bText}</span>` + (r.s !== r.e ? ` — ${new Date(r.e).toLocaleDateString('hu-HU', {month:'short', day:'numeric'}).toUpperCase()}` : '');
                results.push({ type: rule.type, title: rule.name, msg: rule.message, range: rangeStr });
            }

            const render = (type) => {
                let filtered = results.filter(r => type === 'alert' ? r.type === 'alert' : (type === 'window' ? r.type === 'window' : r.type !== 'alert' && r.type !== 'window'));
                
                // Ha több info kártya van, a szezonális (háttér) üzenetet tegyük a végére
                filtered.sort((a, b) => (a.isBackground ? 1 : 0) - (b.isBackground ? 1 : 0));
                
                if (!filtered.length) return `<div class="event-msg" style="opacity:0.5; padding:10px;">Nincs aktuális esemény.</div>`;

                return `<div id="${type}-carousel" class="carousel-wrapper">${filtered.map((it, idx) => `
                    <div class="carousel-item ${idx === 0 ? 'active' : ''}"><div class="card-container">
                        <div class="card-line card-type-${it.type || 'info'}"></div>
                        <div class="event-name">${it.title}</div><div class="event-range">${it.range || ''}</div><div class="event-msg">${it.msg}</div>
                    </div></div>`).join('')}</div>`;
            };

            container.innerHTML = `
                <div class="garden-main-card">
                    <div class="garden-title">Kertfigyelő</div>
                    <button id="locBtn" class="loc-btn">${sLat ? 'Visszaállítás' : 'Saját kertem'}</button>
                    <div class="section-title">Riasztások</div>${render('alert')}
                    <div class="section-title">Teendők</div>${render('info')}
                    <div class="section-title">Lehetőségek</div>${render('window')}
                    <div class="footer">${lastUpdatedLabel}<br>${version}</div>
                </div>`;

            ['alert', 'info', 'window'].forEach(id => {
                const items = container.querySelectorAll(`#${id}-carousel .carousel-item`);
                if (items.length > 1) { let idx = 0; setInterval(() => { items[idx].classList.remove('active'); idx = (idx+1)%items.length; items[idx].classList.add('active'); }, 5000); }
            });

            document.getElementById('locBtn').onclick = () => {
                if (sLat) { localStorage.removeItem('garden-lat'); localStorage.removeItem('garden-lon'); }
                else { navigator.geolocation.getCurrentPosition(p => { localStorage.setItem('garden-lat', p.coords.latitude); localStorage.setItem('garden-lon', p.coords.longitude); location.reload(); }); }
                location.reload();
            };
        } catch(e) { console.error(e); }
    }
    init();
})();
