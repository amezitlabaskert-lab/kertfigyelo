(async function() {
    const esc = str => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
    
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    function safeLocalStorage() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return {
                getItem: (k) => localStorage.getItem(k),
                setItem: (k, v) => localStorage.setItem(k, v),
                removeItem: (k) => localStorage.removeItem(k)
            };
        } catch(e) {
            const store = {};
            return {
                getItem: (k) => store[k] || null,
                setItem: (k, v) => { store[k] = v; },
                removeItem: (k) => { delete store[k]; }
            };
        }
    }
    const storage = safeLocalStorage();

    function isInSeason(date, startStr, endStr) {
        const [sM, sD] = startStr.split('-').map(Number);
        const [eM, eD] = endStr.split('-').map(Number);
        const year = date.getFullYear();
        let start = new Date(year, sM - 1, sD);
        let end = new Date(year, eM - 1, eD);
        if (end < start) { 
            if (date >= start) return true;
            let prevYearStart = new Date(year - 1, sM - 1, sD);
            let prevYearEnd = new Date(year, eM - 1, eD);
            return date >= prevYearStart && date <= prevYearEnd;
        }
        return date >= start && date <= end;
    }

    function checkDay(rule, weather, date, i, FORECAST_DAYS) {
        if (!weather.daily || weather.daily.temperature_2m_min[i] === undefined) return false;
        const dayMin = weather.daily.temperature_2m_min[i];
        const dayWind = weather.daily.wind_speed_10m_max[i] || 0;
        const dayRain = weather.daily.precipitation_sum[i] || 0;
        const seasons = rule.seasons || (rule.season ? [rule.season] : null);
        if (seasons && !seasons.some(s => isInSeason(date, s.start, s.end))) return false;
        const cond = rule.conditions || rule.trigger || {};
        if (cond.temp_below !== undefined && dayMin > cond.temp_below) return false;
        if (cond.temp_above !== undefined && dayMin < cond.temp_above) return false;
        if (cond.temp_above_sustained !== undefined) {
            if (i > FORECAST_DAYS - 3) return false; 
            const futureTemps = weather.daily.temperature_2m_min.slice(i, i + 3);
            if (futureTemps.length < 3 || !futureTemps.every(t => t >= cond.temp_above_sustained)) return false;
        }
        if (cond.soil_temp_stable !== undefined) {
            if (i > FORECAST_DAYS - 2) return false;
            const nextDayMin = weather.daily.temperature_2m_min[i + 1];
            if (dayMin < cond.soil_temp_stable || nextDayMin < cond.soil_temp_stable) return false;
        }
        if (cond.rain_max !== undefined && dayRain > cond.rain_max) return false;
        if (cond.rain_min !== undefined && dayRain < cond.rain_min) return false;
        if (cond.wind_max !== undefined && dayWind > cond.wind_max) return false;
        return true;
    }

    window.activateLocalWeather = () => navigator.geolocation.getCurrentPosition(p => {
        storage.setItem('garden-lat', p.coords.latitude);
        storage.setItem('garden-lon', p.coords.longitude);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('lat', p.coords.latitude);
        newUrl.searchParams.set('lon', p.coords.longitude);
        window.location.href = newUrl.href;
    });

    window.resetLocation = () => { 
        storage.removeItem('garden-lat');
        storage.removeItem('garden-lon');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('lat');
        newUrl.searchParams.delete('lon');
        window.location.href = newUrl.origin + newUrl.pathname;
    };

    try {
        let lat = 47.5136;
        let lon = 19.3735;
        let isPersonalized = false;

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('lat') && urlParams.has('lon')) {
            lat = urlParams.get('lat');
            lon = urlParams.get('lon');
            isPersonalized = true;
        } else {
            const sLat = storage.getItem('garden-lat');
            const sLon = storage.getItem('garden-lon');
            if (sLat && sLon) { lat = sLat; lon = sLon; isPersonalized = true; }
        }

        const [rulesRes, weatherRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json'),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(4)}&longitude=${Number(lon).toFixed(4)}&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`)
        ]);

        const rules = await rulesRes.json();
        const weather = await weatherRes.json();
        const widgetDiv = document.getElementById('smart-garden-widget');
        const FORECAST_DAYS = weather.daily.temperature_2m_min.length;

        // DIZÁJN: ÉLES SARKOK, KISEBB BETŰK (v2.3.8)
        let htmlBase = `
            <div style="position: fixed; left: 40px; top: 180px; width: 280px; z-index: 9999; font-family: 'Plus Jakarta Sans', sans-serif; display: none;" id="garden-floating-sidebar">
                <div style="background: white; padding: 18px; border-radius: 0px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                    <div style="margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">
                                ${isPersonalized ? 'KERTED' : 'KÖRZET'}
                            </span>
                            <span style="font-size: 0.5rem; color: #cbd5e1;">v2.3.8</span>
                        </div>
                        <button onclick="${isPersonalized ? 'resetLocation()' : 'activateLocalWeather()'}" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 0px; font-size: 0.6rem; font-weight: 800; cursor: pointer; color: #475569;">
                            ${isPersonalized ? 'VISSZA' : 'BEÁLLÍTÁS'}
                        </button>
                    </div>
                    <div style="max-height: 480px; overflow-y: auto; padding-right: 5px;">`;

        let htmlCards = '';
        let hasActiveCards = false;
        const today = new Date();
        today.setHours(12, 0, 0, 0); 

        rules.forEach(rule => {
            const typeClass = rule.type || 'info';
            let windows = [];
            let current = null;

            for (let i = 0; i < FORECAST_DAYS; i++) {
                const d = new Date(today); d.setDate(today.getDate() + i);
                if (checkDay(rule, weather, d, i, FORECAST_DAYS)) {
                    if (!current) current = { s: new Date(d), e: new Date(d), count: 1 };
                    else { current.e = new Date(d); current.count++; }
                } else if (current) { windows.push(current); current = null; }
            }
            if (current) windows.push(current);

            windows.forEach(w => {
                hasActiveCards = true;
                const dStr = w.s.toLocaleDateString('hu-HU', {month:'long', day:'numeric'});
                
                // Intelligens név-összefűzés (v2.3.8)
                let baseName = esc(rule.name).replace(/\s+várható$/i, ""); // Levágja a végi "várható"-t ha van
                let displayTitle = baseName + (w.count > 1 ? ` várható a következő ${w.count} napban` : "");

                const accentColor = typeClass === 'alert' ? '#2563eb' : '#16a34a';
                
                htmlCards += `
                    <div style="margin-bottom: 20px; border-left: 3px solid ${accentColor}; padding-left: 12px;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: ${accentColor}; text-transform: uppercase; margin-bottom: 3px;">${dStr}</div>
                        <div style="font-size: 0.95rem; font-weight: 800; color: #1e293b; line-height: 1.2; margin-bottom: 5px;">${displayTitle}</div>
                        <p style="margin:0; font-size: 0.8rem; color: #64748b; line-height: 1.4;">${esc(rule.message)}</p>
                    </div>`;
            });
        });

        const emptyMsg = `<p style="text-align:center; padding:10px; color:#94a3b8; font-size: 0.75rem; font-style: italic;">Nincs teendő.</p>`;
        widgetDiv.innerHTML = htmlBase + (hasActiveCards ? htmlCards : emptyMsg) + `</div></div></div>`;

        if (window.innerWidth > 1250) {
            document.getElementById('garden-floating-sidebar').style.display = 'block';
        }

    } catch (e) { console.error("Widget hiba:", e); }
})();
