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
            border: 1px solid #cce5ff;
            border-top: 8px solid #8ebf42; 
            background: #ffffff; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
            color: #000000;
        }
        /* Az új, higadtabb fagy-stílus */
        .garden-card.alert { 
            border-top-color: #4a90e2; 
            background: #d1e3f8; /* Elég sötét a kontraszthoz, de olvasható rajta a fekete */
            border-color: #b3d1f2;
        }
        .garden-card strong { display: block; font-size: 1.1em; margin-bottom: 5px; }
        .garden-card p { margin: 5px 0; font-size: 0.9em; line-height: 1.4; }
        .plant-list { font-style: italic; color: #444; font-size: 0.85em; margin-top: 8px; }
    `;
