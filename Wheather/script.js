
  const $ = (id) => document.getElementById(id);

  // Accessibility: submit search on Enter
  $('search').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); doSearch(); } });
  $('go').addEventListener('click', doSearch);
  $('useLoc').addEventListener('click', useMyLocation);
  $('clearRecent').addEventListener('click', ()=>{ localStorage.removeItem('recentCountries'); renderRecent(); });

  // Unit toggle
  let unit = localStorage.getItem('unit') || 'C';
  setUnitButtons(unit);
  $('cBtn').addEventListener('click', ()=>{ unit='C'; localStorage.setItem('unit','C'); setUnitButtons('C'); if(state.coords) fetchWeather(state.coords); });
  $('fBtn').addEventListener('click', ()=>{ unit='F'; localStorage.setItem('unit','F'); setUnitButtons('F'); if(state.coords) fetchWeather(state.coords); });
  function setUnitButtons(u){
    $('cBtn').setAttribute('aria-pressed', u==='C');
    $('fBtn').setAttribute('aria-pressed', u==='F');
  }

  const state = { country: null, coords: null, forecast: null };

  // Recent searches
  function readRecent(){
    try{ return JSON.parse(localStorage.getItem('recentCountries'))||[] }catch{ return [] }
  }
  function pushRecent(name){
    let arr = readRecent();
    name = name.trim();
    arr = [name, ...arr.filter(x=>x.toLowerCase()!==name.toLowerCase())].slice(0,5);
    localStorage.setItem('recentCountries', JSON.stringify(arr));
    renderRecent();
  }
  function renderRecent(){
    const holder = $('recent');
    holder.innerHTML = '';
    const arr = readRecent();
    if(arr.length===0){ holder.innerHTML = '<span class="label">(nothing yet)</span>'; return; }
    arr.forEach(name=>{
      const b = document.createElement('button');
      b.className='chip'; b.textContent=name; b.title='Search '+name; b.addEventListener('click',()=>{ $('search').value=name; doSearch();});
      holder.appendChild(b);
    });
  }
  renderRecent();

  async function doSearch(){
    const q = $('search').value.trim(); if(!q) return;
    setStatus('statusCountry','loading'); setStatus('statusWeather','—');
    try{
      const data = await fetchJSON(`https://restcountries.com/v3.1/name/${encodeURIComponent(q)}?fields=name,capital,population,region,flags,latlng`);
      if(!data || !data.length) throw new Error('No match');
      // choose best: exact match first else first item
      const best = data.find(c=>c.name.common.toLowerCase()===q.toLowerCase()) || data[0];
      state.country = best;
      const cap = best.capital ? best.capital[0] : '—';
      const pop = best.population ? best.population.toLocaleString() : '—';
      const reg = best.region || '—';
      const [lat, lon] = best.latlng || [];
      $('countryName').textContent = best.name.common;
      $('countrySub').textContent = `${cap} • ${pop} • ${reg}`;
      $('capital').textContent = cap;
      $('region').textContent = reg;
      $('population').textContent = pop;
      $('latlon').textContent = lat? `${lat.toFixed(2)} / ${lon.toFixed(2)}` : '—';
      $('flag').innerHTML = best.flags?.svg ? `<img alt="Flag of ${best.name.common}" src="${best.flags.svg}">` : '🏳️';
      setStatus('statusCountry','ok');
      if(lat && lon){
        state.coords = {lat, lon};
        pushRecent(best.name.common);
        await fetchWeather({lat, lon});
      } else {
        setStatus('statusWeather','No coordinates');
      }
    }catch(err){
      console.error(err);
      setStatus('statusCountry','error');
      alert('Country not found. Try a different name.');
    }
  }

  async function useMyLocation(){
    if(!navigator.geolocation){ alert('Geolocation not supported'); return; }
    setStatus('statusCountry','—'); setStatus('statusWeather','locating…');
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const {latitude:lat, longitude:lon} = pos.coords;
      state.coords = {lat, lon};
      $('countryName').textContent = 'Your location';
      $('countrySub').textContent = `${lat.toFixed(2)} / ${lon.toFixed(2)}`;
      $('flag').textContent = '📍';
      $('capital').textContent = '—'; $('region').textContent = '—'; $('population').textContent = '—'; $('latlon').textContent = `${lat.toFixed(2)} / ${lon.toFixed(2)}`;
      await fetchWeather({lat, lon});
    }, (err)=>{
      setStatus('statusWeather','error'); alert('Could not get your location');
    }, {enableHighAccuracy:true, timeout: 10000});
  }

  async function fetchWeather({lat, lon}){
    try{
      setStatus('statusWeather','loading');
      // current and daily
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude: lat, longitude: lon, current_weather: true, timezone: 'auto',
        hourly: 'precipitation', daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max'
      });
      const w = await fetchJSON(url.toString());
      state.forecast = w;
      // Now panel
      const nowTempC = w.current_weather?.temperature ?? null;
      const nowWind = w.current_weather?.windspeed ?? null;
      const currentISO = w.current_weather?.time;
      let nowPrec = '—';
      if(currentISO && w.hourly?.time){
        const idx = w.hourly.time.indexOf(currentISO);
        if(idx>-1) nowPrec = (w.hourly.precipitation[idx] || 0).toFixed(1) + ' mm';
      }
      const displayTemp = (c)=> unit==='C' ? `${c.toFixed(1)} °C` : `${(c*9/5+32).toFixed(1)} °F`;
      $('nowTemp').textContent = nowTempC==null? '—' : displayTemp(nowTempC);
      $('nowWind').textContent = nowWind==null? '—' : `${nowWind.toFixed(0)} km/h`;
      $('nowRain').textContent = nowPrec;
      setStatus('statusWeather','ok');
      drawChart(w);
    }catch(err){
      console.error(err); setStatus('statusWeather','error');
    }
  }

  function drawChart(w){
    const cv = $('chart');
    const ctx = cv.getContext('2d');
    const W = cv.clientWidth || 900; const H = cv.getAttribute('height');
    cv.width = W; // handle HiDPI by browser

    // parse data
    const labels = w.daily.time.map(d=> new Date(d)).map(dt=> dt.toLocaleDateString(undefined,{weekday:'short'}));
    const tMax = w.daily.temperature_2m_max.slice();
    const tMin = w.daily.temperature_2m_min.slice();
    const precip = w.daily.precipitation_sum.slice();

    // convert for F if needed
    const conv = (c)=> unit==='C'? c : c*9/5+32;
    const tMaxU = tMax.map(conv), tMinU = tMin.map(conv);

    // ranges
    const tVals = [...tMaxU, ...tMinU];
    const tMinVal = Math.min(...tVals)-2; const tMaxVal = Math.max(...tVals)+2;
    const pMax = Math.max(...precip, 1);

    // layout
    const padL = 44, padR = 20, padT = 20, padB = 34;
    const chartW = W - padL - padR; const chartH = H - padT - padB;

    // helpers
    const x = (i)=> padL + (i*(chartW/(labels.length-1||1)));
    const yT = (v)=> padT + (1-(v - tMinVal)/(tMaxVal - tMinVal)) * chartH;
    const yP = (v)=> padT + chartH - (v/pMax)*chartH; // bars baseline bottom

    // clear
    ctx.clearRect(0,0,W,H);

    // bg grid
    ctx.globalAlpha = .25; ctx.strokeStyle = '#b7c7d4'; ctx.lineWidth = 1;
    ctx.setLineDash([4,6]);
    for(let i=0;i<labels.length;i++){
      const gx = x(i);
      ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, padT+chartH); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha=1;

    // precip bars
    for(let i=0;i<precip.length;i++){
      const barW = chartW/(labels.length*1.6);
      const bx = x(i)-barW/2; const by = yP(precip[i]); const h = padT+chartH - by;
      ctx.fillStyle = 'rgba(106,211,255,0.5)';
      ctx.fillRect(bx, by, barW, h);
    }

    // line helper
    function drawLine(data, stroke){
      ctx.beginPath();
      ctx.lineWidth = 2.5; ctx.strokeStyle = stroke;
      data.forEach((v,i)=>{ const px = x(i), py = yT(v); i? ctx.lineTo(px,py):ctx.moveTo(px,py); });
      ctx.stroke();
      // points
      data.forEach((v,i)=>{ const px=x(i), py=yT(v); ctx.beginPath(); ctx.arc(px,py,3.5,0,Math.PI*2); ctx.fillStyle = stroke; ctx.fill(); });
    }

    drawLine(tMinU, '#71ffa5');
    drawLine(tMaxU, '#ffffff');

    // axes labels (bottom)
    ctx.fillStyle = '#b7c7d4'; ctx.font = '12px Inter, system-ui'; ctx.textAlign='center';
    labels.forEach((lb,i)=> ctx.fillText(lb, x(i), H-10));

    // left temp scale
    ctx.textAlign='right';
    const steps = 4; for(let s=0;s<=steps;s++){ const v = tMinVal + (s/steps)*(tMaxVal-tMinVal); const yy=yT(v); ctx.fillText((unit==='C'?v: v).toFixed(0)+'°', padL-8, yy+4); }

    // legend
    ctx.textAlign='left';
    ctx.fillText('High', padL+8, padT+14);
    ctx.fillText('Low', padL+60, padT+14);
    ctx.fillText('Precip', padL+108, padT+14);
  }

  function setStatus(id, type){
    const el = $(id);
    const map = { 'ok': '✓', 'loading': 'Loading…', 'error':'Error', '—':'—' };
    el.textContent = map[type] || type;
    el.style.color = type==='error'? 'var(--danger)' : type==='ok'? 'var(--accent)' : 'var(--muted)';
  }

  async function fetchJSON(url){
    const res = await fetch(url);
    if(!res.ok) throw new Error('Network');
    return await res.json();
  }

  // Example default
  (function boot(){
    const sample = readRecent()[0] || 'India';
    $('search').value = sample; doSearch();
  })();
  