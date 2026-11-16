// js/core/local-weather.js - the Local Weather layer set from the weather where
// the player is, from api.weather.gov
//
// While CFG.weather is on, localWeatherTick (called by the weather layer's sky
// pass, js/rendering/weather.js) asks the browser for the player's location
// (the browser asks the player first), then weather.gov for that point's
// hourly forecast, and sets the layer's CFG keys from the period in progress,
// the way local-weather-style/STYLE.md maps a render:
//
//   isDaytime        weatherNight (night: moon) and weatherSkyLift (day: 0.35)
//   temperature      weatherTone: cold below 45 F, hot above 80 F, else medium
//   shortForecast    weatherPrecip: rain, thunder, snow and the like stormy;
//                    cloud, overcast, fog cloudy; clear, sunny, fair sunny
//
// It asks when the layer is first shown, then hourly while it stays on.
// weather.gov answers only for US points, so a 404 means "not in the US".
// That, a location the player refuses, no network, or an answer not shaped as
// expected all leave the keys as they are: the stormy night config/ gives, or
// the last reading that worked. The location goes to weather.gov and nowhere
// else. A browser cannot set the User-Agent header weather.gov asks clients
// for, so requests go out with the browser's own.

const LOCAL_WEATHER_API        = 'https://api.weather.gov';
const LOCAL_WEATHER_REFRESH_MS = 60 * 60 * 1000;
const LOCAL_WEATHER_COLD_F     = 45;     // below this, weatherTone 'cold'
const LOCAL_WEATHER_HOT_F      = 80;     // above this, weatherTone 'hot'
const LOCAL_WEATHER_DAY_LIFT   = 0.35;   // weatherSkyLift by day (STYLE.md)

// state: 'idle' or 'asking'; at: when the last ask began (ms); reading: the
// last one that worked, as the CFG keys it set; problem: why the last ask
// left the keys alone, or null.
const localWeather = { state: 'idle', at: 0, reading: null, problem: null };

// localWeatherTick - ask now if the layer is on and an hour has passed since
// the last ask (or there has been none). Cheap to call every frame.
function localWeatherTick(now = Date.now()) {
    if (!CFG.weather || localWeather.state === 'asking') return;
    if (localWeather.at && now - localWeather.at < LOCAL_WEATHER_REFRESH_MS) return;
    localWeather.at = now;
    localWeather.state = 'asking';
    localWeatherFetch()
        .then(reading => {
            localWeather.reading = reading;
            localWeather.problem = null;
            localWeatherReapply();
        })
        .catch(problem => {
            localWeather.problem = String(problem?.message || problem);
            console.info('[local-weather] keeping the weather as it is: %s', localWeather.problem);
        })
        .finally(() => { localWeather.state = 'idle'; });
}

// localWeatherReapply - lay the last reading over CFG again, as after a run
// puts CFG back to its boot values (endRun in game.js). Nothing without one.
function localWeatherReapply() {
    if (localWeather.reading) Object.assign(CFG, localWeather.reading);
}

// localWeatherFetch - the location, then weather.gov's hourly forecast for it,
// as the CFG keys it sets. Rejects with the reason it cannot.
async function localWeatherFetch() {
    const { latitude, longitude } = await _localWeatherPosition();
    // weather.gov wants at most four decimals, and redirects longer ones.
    const point = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const points = await _localWeatherJson(`${LOCAL_WEATHER_API}/points/${point}`);
    const hourly = points?.properties?.forecastHourly;
    if (typeof hourly !== 'string') throw new Error('weather.gov gave no hourly forecast for this point');
    const forecast = await _localWeatherJson(hourly);
    const period = forecast?.properties?.periods?.[0];
    if (!period) throw new Error('the hourly forecast has no periods');
    return localWeatherReading(period);
}

// localWeatherReading - the CFG keys one forecast period sets: { weatherNight,
// weatherSkyLift, weatherTone, weatherPrecip }.
function localWeatherReading(period) {
    const day = !!period.isDaytime;
    return {
        weatherNight:   !day,
        weatherSkyLift: day ? LOCAL_WEATHER_DAY_LIFT : 0,
        weatherTone:    localWeatherTone(period.temperature, period.temperatureUnit),
        weatherPrecip:  localWeatherPrecip(period.shortForecast),
    };
}

function localWeatherTone(temperature, unit = 'F') {
    const t = Number(temperature);
    if (!Number.isFinite(t)) return 'medium';
    const f = String(unit).toUpperCase() === 'C' ? t * 9 / 5 + 32 : t;
    if (f < LOCAL_WEATHER_COLD_F) return 'cold';
    if (f > LOCAL_WEATHER_HOT_F) return 'hot';
    return 'medium';
}

// localWeatherPrecip - a forecast's few words ("Chance Rain Showers", "Mostly
// Cloudy", "Sunny") as stormy, cloudy or sunny. Anything falling counts as
// stormy, then clouds, then clear skies; words it does not know are cloudy.
function localWeatherPrecip(text) {
    const words = String(text || '').toLowerCase();
    if (/thunder|storm|rain|shower|drizzle|snow|sleet|flurr|ice|hail/.test(words)) return 'stormy';
    if (/cloud|overcast|fog|haze|mist|smoke/.test(words)) return 'cloudy';
    if (/sunny|clear|fair/.test(words)) return 'sunny';
    return 'cloudy';
}

function _localWeatherPosition() {
    return new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new Error('this browser gives no location'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            position => resolve(position.coords),
            error => reject(new Error(`no location (${error?.message || 'refused'})`)),
            { maximumAge: LOCAL_WEATHER_REFRESH_MS, timeout: 15000 });
    });
}

async function _localWeatherJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/geo+json' } });
    if (response.status === 404) throw new Error('weather.gov has no forecast here (outside the US)');
    if (!response.ok) throw new Error(`weather.gov answered ${response.status}`);
    return response.json();
}
