(async function() {
    // 1. CSS - Most már tartalmazza az 'info' (szürke) stílust is
    const style = document.createElement('style');
    style.innerHTML = `
        #smart-garden-widget { 
            display: flex; 
            flex-wrap: wrap; 
            gap: 15px; 
            justify-content: center; 
            padding: 20px; 
        }
        .garden-card { 
            flex: 1; 
            min-width: 250px; 
            max-width: 400px; 
            padding: 15px; 
            border-radius: 12px; 
            border: 1px solid #ddd;
            border-top: 8px solid #8ebf42; 
            background: #ffffff; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
            color: #000000;
        }
        /* Erős fagy - Sötétebb kék */
        .garden-card.alert { 
            border-top-color: #4a90e2; 
            background: #d1e3f8;
            border-color: #b3d1f2;
        }
        /* Enyhe fagy / Info - Világosszürke */
        .garden-card.info { 
            border-top-color: #a0aec0; 
            background: #edf2f7;
            border-color: #e2e8f0;
        }
        .garden-card strong { display: block; font-size: 1.1em; margin-bottom: 5px; }
        .garden-card p { margin: 5px 0; font-size: 0.9em; line-height: 1.4; }
        .plant-list { font-style: italic; color: #444; font-size: 0.85em; margin-top: 8px; }
    `;
    document.head.appendChild(style);

    const lat = 47.62;
    const lon = 19.52;
    
    try {
        const rulesRes = await fetch('https://raw.githubusercontent.com/amezitlabaskert-lab/smart-events/main/blog-scripts.json');
        const rules = await rulesRes.json();
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`);
        const weather = await weatherRes.json();

        const today = {
            tempMin: weather.daily.temperature_2m_min[0],
            windMax: weather.daily.wind_speed_10m_max[0],
            rain: weather.daily.precipitation_sum[0],
            now: new Date()
        };

        const widgetDiv = document.getElementById('smart-garden-widget');
        let htmlContent = '';

        rules.forEach(rule => {
            let isTriggered = false;

            // 1. Erős fagy ellenőrzés
            if (rule.type === 'alert' && today.tempMin <= rule.trigger.temp_min) {
                isTriggered = true;
            }

            // 2. Enyhe fagy (Info) - Csak szezonban (tavasz/ősz) és ha nem extrém hideg
            if (rule.type === 'info' && today.tempMin <= rule.trigger.temp_min && today.tempMin > -12) {
                if (rule.seasons) {
                    isTriggered = rule.seasons.some(s => {
                        const [sM, sD] = s.start.split('-').map(Number);
                        const [eM, eD] = s.end.split('-').map(Number);
                        const start = new Date(today.now.getFullYear(), sM - 1, sD);
                        const end = new Date(today.now.getFullYear(), eM - 1, eD);
                        return today.now >= start && today.now <= end;
                    });
                }
            }

            // 3. Permetezési ablak (Zöld)
            if (rule.type === 'window') {
                const [sM, sD] = rule.season.start.split('-').map(Number);
                const [eM, eD] = rule.season.end.split('-').map(Number);
                const start = new Date(today.now.getFullYear(), sM - 1, sD);
                const end = new Date(today.now.getFullYear(), eM - 1, eD);

                if (today.now >= start && today.now <= end) {
                    if (today.tempMin >= rule.conditions.temp_min && 
                        today.windMax <= rule.conditions.wind_max && 
                        today.rain <= rule.conditions.rain_max) {
                        isTriggered = true;
                    }
                }
            }

            if (isTriggered) {
                htmlContent += `
                    <div class="garden-card ${rule.type}">
                        <strong>${rule.name}</strong>
                        <p>${rule.message}</p>
                        <div class="plant-list">Érintett: ${rule.plants.join(', ')}</div>
                    </div>
                `;
            }
        });

        widgetDiv.innerHTML = htmlContent;

    } catch (e) { console.error(e); }
})();
