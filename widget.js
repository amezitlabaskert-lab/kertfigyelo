(async function() {
    // ... (A CSS marad a régi) ...

    try {
        const rulesRes = await fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json');
        const rules = await rulesRes.json();
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=47.62&longitude=19.52&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`);
        const weather = await weatherRes.json();

        const widgetDiv = document.getElementById('smart-garden-widget');
        let htmlContent = '';

        rules.forEach(rule => {
            let activeWindows = [];
            let currentWindow = null;

            for (let i = 0; i < 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dayMin = weather.daily.temperature_2m_min[i];
                const dayWind = weather.daily.wind_speed_10m_max[i];
                const dayRain = weather.daily.precipitation_sum[i];
                
                let isDayOk = false;

                // Fagy ellenőrzés (Alert/Info)
                if ((rule.type === 'alert' || rule.type === 'info') && dayMin <= rule.trigger.temp_min) {
                    if (rule.type === 'info') {
                        // Szezon ellenőrzés az info-hoz
                        const isS = rule.seasons.some(s => {
                            const [sM, sD] = s.start.split('-').map(Number);
                            const [eM, eD] = s.end.split('-').map(Number);
                            const start = new Date(date.getFullYear(), sM-1, sD);
                            const end = new Date(date.getFullYear(), eM-1, eD);
                            return date >= start && date <= end;
                        });
                        if (isS && dayMin > -12) isDayOk = true;
                    } else {
                        isDayOk = true; // Alert mindig mehet
                    }
                }

                // Permetezés/Ablak ellenőrzés
                if (rule.type === 'window') {
                    const [sM, sD] = rule.season.start.split('-').map(Number);
                    const [eM, eD] = rule.season.end.split('-').map(Number);
                    const start = new Date(date.getFullYear(), sM-1, sD);
                    const end = new Date(date.getFullYear(), eM-1, eD);

                    if (date >= start && date <= end &&
                        dayMin >= rule.conditions.temp_min && 
                        dayWind <= rule.conditions.wind_max && 
                        dayRain <= rule.conditions.rain_max) {
                        isDayOk = true;
                    }
                }

                // Ablakok összevonása
                if (isDayOk) {
                    if (!currentWindow) {
                        currentWindow = { start: date, end: date, minTemp: dayMin };
                    } else {
                        currentWindow.end = date;
                        currentWindow.minTemp = Math.min(currentWindow.minTemp, dayMin);
                    }
                } else if (currentWindow) {
                    activeWindows.push(currentWindow);
                    currentWindow = null;
                }
            }
            if (currentWindow) activeWindows.push(currentWindow);

            // Megjelenítés
            activeWindows.forEach(win => {
                const dateStr = win.start.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) + 
                                (win.start.getTime() !== win.end.getTime() ? ' - ' + win.end.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) : '');
                
                const fagyInfo = (rule.type === 'alert') ? ` (akár ${win.minTemp}°C)` : '';

                htmlContent += `
                    <div class="garden-card ${rule.type}">
                        <strong>${dateStr}: ${rule.name}${fagyInfo}</strong>
                        <p>${rule.message}</p>
                        <div class="plant-list">Érintett: ${rule.plants.join(', ')}</div>
                    </div>
                `;
            });
        });

        widgetDiv.innerHTML = htmlContent;
    } catch (e) { console.error(e); }
})();
