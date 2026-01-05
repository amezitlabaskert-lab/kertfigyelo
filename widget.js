/**
 * 🚩 SMART GARDEN WIDGET - VERSION 4.7.0 "EXTERNAL UI"
 * LOGIKA ÉS UI TELJESEN KÜLÖN FÁJLBAN
 */

(async function() {
    const version = "v4.7.0 - Logic Only";
    const lastUpdatedLabel = "Last updated: " + new Date().toLocaleTimeString('hu-HU', {hour:'2-digit', minute:'2-digit'});
    
    // --- CSS BEHÚZÁSA GITHUBRÓL ---
    const cssUrl = "https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/garden.css";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    document.head.appendChild(link);

    // --- LOGIKAI SZABÁLYOK (3 MÚLT / 4 JÖVŐ) ---
    function checkSustained(weather, dayIdx, cond, ruleType) {
        if (!cond || Object.keys(cond).length === 0) return false;
        const days = cond.days_min || 1;
        const checkSingle = (key, idx) => {
            const d = weather.daily;
            if (idx < 0 || !d.time[idx]) return false; 
            if (key === 'temp_min_below') return d.temperature_2m_min[idx] <= cond[key];
            if (key === 'temp_max_below') return d.temperature_2m_max[idx] <= cond[key];
            if (key === 'rain_min') return d.precipitation_sum[idx] >= cond[key];
            const wKey = ruleType === 'alert' ? 'wind_gusts_10m_max' : 'wind_speed_10m_max';
            if (key === 'wind_min') return d[wKey][idx] >= cond[key];
            return true;
        };
        for (const key in cond) {
            if (key === 'days_min') continue;
            const res = [];
            for (let j = 0; j < days; j++) res.push(checkSingle(key, dayIdx - j));
            if (!res.every(r => r)) return false;
        }
        return true;
    }

    async function init() {
        const container = document.getElementById('smart-garden-widget');
        if (!container) return;

        const lat = 47.5136, lon = 19.3735; // Koordináták tartva
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=auto&past_days=3`;

        try {
            const [rulesJson, weather] = await Promise.all([
                fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json').then(r => r.json()),
                fetch(weatherUrl).then(r => r.json())
            ]);

            const results = { alert: [], info: [], window: [], idle: [] };
            const todayStr = new Date().toISOString().split('T')[0];
            const todayIdx = weather.daily.time.findIndex(t => t === todayStr);
            const monthDay = new Date().toISOString().slice(5,10);

            rulesJson.forEach(rule => {
                if (!rule.conditions || Object.keys(rule.conditions).length === 0) {
                    if (rule.seasons?.some(s => monthDay >= s.start && monthDay <= s.end)) results.idle.push(rule);
                    return;
                }

                // SZABÁLY: MAI PRIORITÁS
                if (checkSustained(weather, todayIdx, rule.conditions, rule.type)) {
                    results[rule.type].push({ title: rule.name, msg: rule.message, time: `<span class="time-badge badge-today">MA</span>` });
                } else {
                    // SZABÁLY: JÖVŐ SZŰRÉS (MAX 4 NAP)
                    for (let i = todayIdx + 1; i <= todayIdx + 4; i++) {
                        if (i < weather.daily.time.length && checkSustained(weather, i, rule.conditions, rule.type)) {
                            results[rule.type].push({ title: rule.name, msg: rule.message, time: `<span class="time-badge badge-future">${i - todayIdx} NAP MÚLVA</span>` });
                            break;
                        }
                    }
                }
            });

            const renderZone = (type) => {
                let list = results[type];
                if (type === 'info' && list.length === 0) list = results.idle;
                if (list.length === 0) return `<div class="event-msg" style="opacity:0.3">Nincs aktuális esemény</div>`;
                return list.map(it => `
                    <div class="event-item">
                        <div class="event-line line-${type}"></div>
                        <div class="time-badge">${it.time}</div>
                        <div class="event-name">${it.title}</div>
                        <div class="event-msg">${it.msg}</div>
                    </div>`).join('');
            };

            container.innerHTML = `
                <div class="garden-title">Kertfigyelő</div>
                <div class="section-title">Riasztások</div>${renderZone('alert')}
                <div class="section-title">Teendők</div>${renderZone('info')}
                <div class="section-title">Lehetőségek</div>${renderZone('window')}
                <div class="footer">${lastUpdatedLabel}<br>${version}</div>`;
        } catch(e) { console.error(version, e); }
    }
    init();
})();
