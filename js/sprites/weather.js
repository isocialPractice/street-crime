// js/sprites/weather.js - Local weather sprites
// Assets are copied from the weather server asset folder into
// assets/levels/weather, the weather being part of a level's scenery.
// They load through loadSvgFile so the Blob URL wrapper and the ASSETS_READY
// decode gate both apply, exactly like every other sprite module.
//
// sun.svg and snow.svg are optional: a day render draws the sun in the moon's
// slot, and cold weather drops snow in place of rain (js/rendering/weather.js).
// Until a file is copied out of the server assets folder into
// assets/levels/weather/, its render goes without it: no sun disc by day, rain
// in the cold. Adding the file is all it takes to turn it on.

const WEATHER_SPRITES = {
    cloud: loadSvgFile('assets/levels/weather/cloud.svg'),
    rain:  loadSvgFile('assets/levels/weather/rain.svg'),
    moon:  loadSvgFile('assets/levels/weather/moon.svg'),
    sun:   loadOptionalSvgFile('assets/levels/weather/sun.svg'),
    snow:  loadOptionalSvgFile('assets/levels/weather/snow.svg'),
};
SVG_FILES_READY.then(() => dropMissingSvgFiles(WEATHER_SPRITES));
