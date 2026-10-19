// js/sprites/weather.js - Local weather sprites
// Assets are copied from the weather server asset folder into
// assets/levels/weather, the weather being part of a level's scenery.
// They load through loadSvgFile so the Blob URL wrapper and the ASSETS_READY
// decode gate both apply, exactly like every other sprite module.
//
// Only the sprites the current render needs are listed here. A day render adds
// sun.svg and a cold render adds snow.svg; copy those two out of the server
// assets folder and add them below when that render is requested.

const WEATHER_SPRITES = {
    cloud: loadSvgFile('assets/levels/weather/cloud.svg'),
    rain:  loadSvgFile('assets/levels/weather/rain.svg'),
    moon:  loadSvgFile('assets/levels/weather/moon.svg'),
};
