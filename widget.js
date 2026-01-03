async function updateGardenWidget() {
    const lat = 47.5136;
    const lon = 19.3735;
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=auto`);
    const data = await response.json();
    
    const todayTemp = data.daily.temperature_2m_min[0];
    const todayWind = data.daily.wind_speed_10m_max[0];
    const todayRain = data.daily.precipitation_sum[0];

    const widgetDiv = document.getElementById('smart-garden-widget');
    widgetDiv.innerHTML = ''; // Alaphelyzetben üres (Clutter-mentesség)

    // Egyszerű példa a fagyra:
    if (todayTemp <= -10) {
        widgetDiv.innerHTML = `
            <div class="garden-card alert">
                <strong>❄️ KEMÉNY FAGY: ${todayTemp}°C</strong>
                <p>Védd a fügét és a leandert!</p>
            </div>
        `;
    }
}
updateGardenWidget();