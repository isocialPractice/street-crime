// js/level/svg-scenes.js — SVG-backed playfield scenes and geometry helpers
// Scene field data is extracted from a dedicated SVG element (default: #field)
// and normalized so the same geometry can drive rendering, movement bounds,
// and spawn sampling.

function _svgSceneViewBox(svgEl) {
    const vb = (svgEl.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (vb.length === 4 && vb.every(Number.isFinite)) {
        return { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };
    }
    const width = parseFloat(svgEl.getAttribute('width')) || 1;
    const height = parseFloat(svgEl.getAttribute('height')) || 1;
    return { x: 0, y: 0, width, height };
}

function _svgScenePointList(pointsAttr) {
    const raw = (pointsAttr || '').trim();
    if (!raw) return [];

    const commaPairs = raw
        .split(/\s+/)
        .map(pair => pair.split(',').map(Number))
        .filter(pair => pair.length === 2 && pair.every(Number.isFinite))
        .map(([x, y]) => ({ x, y }));
    if (commaPairs.length >= 3) return commaPairs;

    const values = raw
        .split(/[\s,]+/)
        .map(Number)
        .filter(Number.isFinite);
    const points = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
        points.push({ x: values[i], y: values[i + 1] });
    }
    return points;
}

// _svgSceneShapePoints - the outline of a rect, polygon or polyline in its own
// coordinates, or [] for any other shape. Shared by #field and the level map's
// negative-space holes, so both read a shape the same way.
function _svgSceneShapePoints(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'polygon' || tag === 'polyline') {
        return _svgScenePointList(el.getAttribute('points'));
    }
    if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x')) || 0;
        const y = parseFloat(el.getAttribute('y')) || 0;
        const width = parseFloat(el.getAttribute('width')) || 0;
        const height = parseFloat(el.getAttribute('height')) || 0;
        return [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ];
    }
    return [];
}

function _svgSceneFieldShape(svgText, fieldSelector = '#field') {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.documentElement;
    const fieldEl = doc.querySelector(fieldSelector) || doc.querySelector('#field');
    if (!svgEl || !fieldEl) return null;

    const vb = _svgSceneViewBox(svgEl);
    const sourcePoints = _svgSceneShapePoints(fieldEl);

    if (sourcePoints.length < 3 || vb.width <= 0 || vb.height <= 0) return null;

    const normalizedPoints = sourcePoints.map(point => ({
        x: (point.x - vb.x) / vb.width,
        y: (point.y - vb.y) / vb.height,
    }));
    const xs = normalizedPoints.map(point => point.x);
    const ys = normalizedPoints.map(point => point.y);

    return {
        normalizedPoints,
        normalizedBounds: {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        },
    };
}

function _svgSceneRectBounds(el) {
    if (!el) return null;
    const x = parseFloat(el.getAttribute('x'));
    const y = parseFloat(el.getAttribute('y'));
    const width = parseFloat(el.getAttribute('width'));
    const height = parseFloat(el.getAttribute('height'));
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return { x, y, width, height };
}

// A screen-slice rect is named "border", or "border-2" and on when Illustrator
// numbers a duplicate. The match is exact on purpose: art that merely has the
// word in its name, such as the sidewalk's "tile-borders" in theStreets, is
// scenery and must survive the pass that strips the slices out of the image.
const SVG_SCENE_BORDER_RE = /^border(?:[-_]\d+)?$/i;

function _svgSceneIsBorderEl(el) {
    return !!el && (
        SVG_SCENE_BORDER_RE.test((el.getAttribute('id') || '').trim()) ||
        SVG_SCENE_BORDER_RE.test((el.getAttribute('data-name') || '').trim())
    );
}

function _svgSceneNormalizedBounds(bounds, vb) {
    if (!bounds || !vb || vb.width <= 0 || vb.height <= 0) return null;
    return {
        x: (bounds.x - vb.x) / vb.width,
        y: (bounds.y - vb.y) / vb.height,
        width: bounds.width / vb.width,
        height: bounds.height / vb.height,
    };
}

function _svgSceneSectionBounds(sectionEl) {
    const children = Array.from(sectionEl?.children || []);
    const borderEl = children.find(_svgSceneIsBorderEl);
    const borderBounds = _svgSceneRectBounds(borderEl);
    if (borderBounds) return borderBounds;

    let minX = Infinity;
    let minY = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;
    let maxHeight = 0;

    for (const child of children) {
        const bounds = _svgSceneRectBounds(child);
        if (!bounds) continue;
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxRight = Math.max(maxRight, bounds.x + bounds.width);
        maxBottom = Math.max(maxBottom, bounds.y + bounds.height);
        maxHeight = Math.max(maxHeight, bounds.height);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxRight)) return null;
    return {
        x: minX,
        y: minY,
        width: Math.max(0, maxRight - minX),
        height: Math.max(maxHeight, maxBottom - minY),
    };
}

// _svgSceneBackground - the markup the static scene image is drawn from: the
// level without its border rects, and without the ids in stripIds. Those are
// the level-map pieces drawn live on top instead (an animated sign, a gate that
// can be broken), which would otherwise show twice.
function _svgSceneBackground(svgText, stripIds = []) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const strip = new Set(stripIds);
    Array.from(doc.querySelectorAll('*'))
        .filter(el => _svgSceneIsBorderEl(el) || strip.has((el.getAttribute('id') || '').trim()))
        .forEach(el => el.remove());
    return new XMLSerializer().serializeToString(doc);
}

function _svgSceneSectionSvg(svgText, sectionId, bounds, fieldSelector = '#field') {
    if (!bounds) return null;

    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const sourceSvg = doc.documentElement;
    if (!sourceSvg) return null;

    const sectionEl = Array.from(doc.querySelectorAll('g[id]'))
        .find(el => (el.getAttribute('id') || '').trim() === sectionId);
    if (!sectionEl) return null;

    const sectionDoc = document.implementation.createDocument(
        sourceSvg.namespaceURI || 'http://www.w3.org/2000/svg',
        'svg',
        null
    );
    const sectionSvg = sectionDoc.documentElement;
    sectionSvg.setAttribute('xmlns', sourceSvg.getAttribute('xmlns') || 'http://www.w3.org/2000/svg');
    sectionSvg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
    sectionSvg.setAttribute('width', String(bounds.width));
    sectionSvg.setAttribute('height', String(bounds.height));

    const defsEl = doc.querySelector('defs');
    if (defsEl) sectionSvg.appendChild(sectionDoc.importNode(defsEl, true));

    const sectionClone = sectionDoc.importNode(sectionEl, true);
    Array.from(sectionClone.querySelectorAll('*'))
        .filter(_svgSceneIsBorderEl)
        .forEach(el => el.remove());
    sectionSvg.appendChild(sectionClone);

    const fieldEl = doc.querySelector(fieldSelector) || doc.querySelector('#field');
    if (fieldEl) sectionSvg.appendChild(sectionDoc.importNode(fieldEl, true));

    return new XMLSerializer().serializeToString(sectionDoc);
}

// _svgSceneBorderSections - screen slices for a level drawn without
// section_<n> groups, taken from its border rects instead.
//
// They are ordered by position rather than by id. Illustrator numbers a copied
// rect after the one it was copied from, so in theStreets "border-2" is the
// left screen and "border" the right one. Nothing draws a section's own image
// (the renderer only counts sections to size the world), so none is built.
function _svgSceneBorderSections(doc, vb) {
    return Array.from(doc.querySelectorAll('*'))
        .filter(_svgSceneIsBorderEl)
        .map(_svgSceneRectBounds)
        .filter(Boolean)
        .sort((a, b) => a.x - b.x)
        .map((bounds, i) => ({
            id: `section_${i + 1}`,
            order: i + 1,
            bounds,
            normalizedBounds: _svgSceneNormalizedBounds(bounds, vb),
            img: null,
        }))
        .filter(section => section.normalizedBounds);
}

function _svgSceneSections(svgText, fieldSelector = '#field') {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.documentElement;
    if (!svgEl) return [];

    const vb = _svgSceneViewBox(svgEl);
    const hasSectionGroups = Array.from(doc.querySelectorAll('g[id]'))
        .some(el => /^section_\d+$/i.test((el.getAttribute('id') || '').trim()));
    if (!hasSectionGroups) return _svgSceneBorderSections(doc, vb);

    return Array.from(doc.querySelectorAll('g[id]'))
        .map(sectionEl => {
            const id = (sectionEl.getAttribute('id') || '').trim();
            const match = /^section_(\d+)$/i.exec(id);
            if (!match) return null;

            const bounds = _svgSceneSectionBounds(sectionEl);
            const normalizedBounds = _svgSceneNormalizedBounds(bounds, vb);
            if (!normalizedBounds) return null;

            const sectionSvg = _svgSceneSectionSvg(svgText, id, bounds, fieldSelector);

            return {
                id,
                order: Number(match[1]),
                bounds,
                normalizedBounds,
                img: sectionSvg ? loadSvgImg(sectionSvg) : null,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);
}

// createSvgScene - one level SVG as a playable scene. worldWidth is the width
// of one section; the scene is that times the number of sections.
//
// levelMap turns on the id vocabulary in js/level/level-map.js (doors,
// breakables, animated pieces, holes in the field). It is off for the built-in
// scenes below, which are built while the scripts are still loading, before
// level-map.js exists; scenes that use it are built later, at runtime.
function createSvgScene({ path, fieldSelector = '#field', worldWidth = 800, worldHeight = 600,
                          levelMap = false, levelDir = '' }) {
    const svgText = loadSvgText(path);
    const sections = _svgSceneSections(svgText, fieldSelector);
    const sceneWidth = sections.length > 0 ? worldWidth * sections.length : worldWidth;
    const field = _svgSceneFieldShape(svgText, fieldSelector);
    const map = levelMap
        ? parseLevelMap(svgText, { worldWidth: sceneWidth, worldHeight, levelDir, field })
        : null;
    const sceneSvg = _svgSceneBackground(svgText, map ? map.stripIds : []);
    return {
        path,
        img: loadSvgImg(sceneSvg),
        worldWidth: sceneWidth,
        worldHeight,
        field,
        sectionWorldWidth: worldWidth,
        sections,
        map,
        levelDir,
    };
}

const SVG_SCENES = {
    testItWorked: createSvgScene({
        path: 'assets/levels/Test_ItWorked.svg',
        fieldSelector: '#field',
        worldWidth: 800,
        worldHeight: 600,
    }),
};

function _stageScene(stageData) {
    return stageData?.scene || null;
}

function stageHasField(stageData) {
    return !!_stageScene(stageData)?.field;
}

function stageFieldPolygon(stageData) {
    const scene = _stageScene(stageData);
    const field = scene?.field;
    if (!field) return null;
    return field.normalizedPoints.map(point => ({
        x: point.x * scene.worldWidth,
        y: point.y * scene.worldHeight,
    }));
}

// stageFieldHoles - the level map's negative-space outlines in world pixels:
// parts of the field nobody can walk into, such as the footprint of a parked
// car. Empty for a scene without a level map.
function stageFieldHoles(stageData) {
    const scene = _stageScene(stageData);
    const holes = scene?.map?.holes;
    if (!holes?.length) return [];
    return holes.map(hole => hole.normalizedPoints.map(point => ({
        x: point.x * scene.worldWidth,
        y: point.y * scene.worldHeight,
    })));
}

function _pointInStageHole(px, py, holes) {
    return holes.some(points => _pointInPolygon(px, py, points));
}

// _stageFieldOutlines - the field followed by its holes, or null when there is
// no field to move on.
function _stageFieldOutlines(stageData) {
    const polygon = stageFieldPolygon(stageData);
    if (!polygon || polygon.length < 3) return null;
    return [polygon, ...stageFieldHoles(stageData)];
}

function stageFieldBounds(stageData) {
    const scene = _stageScene(stageData);
    const field = scene?.field;
    if (!field) return null;
    return {
        minX: field.normalizedBounds.minX * scene.worldWidth,
        maxX: field.normalizedBounds.maxX * scene.worldWidth,
        minY: field.normalizedBounds.minY * scene.worldHeight,
        maxY: field.normalizedBounds.maxY * scene.worldHeight,
    };
}

function _pointInPolygon(px, py, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x;
        const yi = points[i].y;
        const xj = points[j].x;
        const yj = points[j].y;
        const crosses = ((yi > py) !== (yj > py)) &&
            (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi);
        if (crosses) inside = !inside;
    }
    return inside;
}

function _closestPointOnSegment(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    const t = abLenSq <= 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    return { x: a.x + abx * t, y: a.y + aby * t };
}

function _nearestPointOnPolygon(point, points) {
    if (!points || points.length < 2) return null;
    let nearest = null;
    let bestDistSq = Infinity;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const candidate = _closestPointOnSegment(point, a, b);
        const dx = candidate.x - point.x;
        const dy = candidate.y - point.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            nearest = candidate;
        }
    }
    return nearest;
}

function _uniqueSorted(values, epsilon = 0.05) {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted.filter((value, index) => index === 0 || Math.abs(value - sorted[index - 1]) > epsilon);
}

function _spansFromIntersections(values, minKey, maxKey) {
    const points = _uniqueSorted(values);
    const spans = [];
    for (let i = 0; i + 1 < points.length; i += 2) {
        spans.push({ [minKey]: points[i], [maxKey]: points[i + 1] });
    }
    return spans;
}

function _verticalIntersections(points, x) {
    const ys = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j];
        const b = points[i];
        if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
            const t = (x - a.x) / (b.x - a.x);
            ys.push(a.y + (b.y - a.y) * t);
        }
    }
    return ys;
}

function _horizontalIntersections(points, y) {
    const xs = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j];
        const b = points[i];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
            const t = (y - a.y) / (b.y - a.y);
            xs.push(a.x + (b.x - a.x) * t);
        }
    }
    return xs;
}

function _sampleOffsets(value) {
    const epsilon = 0.01;
    return [value, value - epsilon, value + epsilon];
}

// The walkable spans along one line through the field. Holes are crossed along
// with the field's own outline: a hole sits inside the field, so its edges fall
// between the field's crossings, and pairing every crossing off in order (the
// even-odd rule) yields spans that stop at the hole and resume past it. The
// padding then keeps the same clearance from a hole's edge as from the field's.
function stageFieldVerticalSpans(stageData, x) {
    const outlines = _stageFieldOutlines(stageData);
    if (!outlines) return [];
    const ys = _sampleOffsets(x).flatMap(sampleX =>
        outlines.flatMap(points => _verticalIntersections(points, sampleX)));
    return _applySpanPadding(_spansFromIntersections(ys, 'minY', 'maxY'), 'minY', 'maxY');
}

function stageFieldHorizontalSpans(stageData, y) {
    const outlines = _stageFieldOutlines(stageData);
    if (!outlines) return [];
    const xs = _sampleOffsets(y).flatMap(sampleY =>
        outlines.flatMap(points => _horizontalIntersections(points, sampleY)));
    return _applySpanPadding(_spansFromIntersections(xs, 'minX', 'maxX'), 'minX', 'maxX');
}

function _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function _fieldBorderPadding() {
    return Math.max(0, CFG.fieldBorderPadding || 0);
}

function _applySpanPadding(spans, minKey, maxKey) {
    const padding = _fieldBorderPadding();
    if (padding <= 0) return spans;

    return spans
        .map(span => ({
            [minKey]: span[minKey] + padding,
            [maxKey]: span[maxKey] - padding,
        }))
        .filter(span => span[maxKey] > span[minKey]);
}

function _pickSpan(spans, anchorValue, targetValue, minKey, maxKey, { allowNearest = false } = {}) {
    if (!spans.length) return null;
    const epsilon = 0.05;
    const containingAnchor = spans.find(span =>
        anchorValue >= span[minKey] - epsilon && anchorValue <= span[maxKey] + epsilon);
    if (containingAnchor) return containingAnchor;

    const containingTarget = spans.find(span =>
        targetValue >= span[minKey] - epsilon && targetValue <= span[maxKey] + epsilon);
    if (containingTarget) return containingTarget;

    if (!allowNearest) return null;

    return spans.reduce((best, span) => {
        const bestDist = Math.min(
            Math.abs(anchorValue - best[minKey]),
            Math.abs(anchorValue - best[maxKey])
        );
        const spanDist = Math.min(
            Math.abs(anchorValue - span[minKey]),
            Math.abs(anchorValue - span[maxKey])
        );
        return spanDist < bestDist ? span : best;
    });

    return null;
}

function _resolveStageFeetMoveOrder(stageData, fromPoint, toPoint, order) {
    let x = fromPoint.x;
    let y = fromPoint.y;

    for (const axis of order) {
        if (axis === 'x') {
            const spans = stageFieldHorizontalSpans(stageData, y);
            const span = _pickSpan(spans, x, toPoint.x, 'minX', 'maxX');
            if (span) x = _clamp(toPoint.x, span.minX, span.maxX);
        } else {
            const spans = stageFieldVerticalSpans(stageData, x);
            const span = _pickSpan(spans, y, toPoint.y, 'minY', 'maxY', { allowNearest: true });
            if (span) y = _clamp(toPoint.y, span.minY, span.maxY);
        }
    }

    return { x, y };
}

function resolveStageFeetMove(stageData, fromPoint, toPoint) {
    const polygon = stageFieldPolygon(stageData);
    if (!polygon || polygon.length < 3) {
        return {
            x: toPoint.x,
            y: Math.max(CFG.groundMin, Math.min(CFG.groundMax, toPoint.y)),
        };
    }

    const xy = _resolveStageFeetMoveOrder(stageData, fromPoint, toPoint, ['x', 'y']);
    const yx = _resolveStageFeetMoveOrder(stageData, fromPoint, toPoint, ['y', 'x']);
    const xyDist = Math.hypot(toPoint.x - xy.x, toPoint.y - xy.y);
    const yxDist = Math.hypot(toPoint.x - yx.x, toPoint.y - yx.y);
    return xyDist <= yxDist ? xy : yx;
}

function constrainStageFeetPoint(stageData, fromPoint, toPoint) {
    return resolveStageFeetMove(stageData, fromPoint, toPoint);
}

function projectStageEntityPosition(stageData, x, y, width, height, fromX = x, fromY = y) {
    const scene = _stageScene(stageData);
    const feet = constrainStageFeetPoint(stageData,
        { x: fromX + width * 0.5, y: fromY + height },
        { x: x + width * 0.5, y: y + height });
    const projected = {
        x: feet.x - width * 0.5,
        y: feet.y - height,
    };
    if (scene) {
        projected.x = _clamp(projected.x, 0, Math.max(0, scene.worldWidth - width));
    }
    return projected;
}

function sampleStageFieldPoint(stageData, options = {}) {
    const polygon = stageFieldPolygon(stageData);
    const bounds = stageFieldBounds(stageData);
    if (!polygon || !bounds) return null;

    const minX = Math.max(bounds.minX, options.minX ?? bounds.minX);
    const maxX = Math.min(bounds.maxX, options.maxX ?? bounds.maxX);
    const minY = Math.max(bounds.minY, options.minY ?? bounds.minY);
    const maxY = Math.min(bounds.maxY, options.maxY ?? bounds.maxY);
    if (minX > maxX || minY > maxY) return null;

    // Nothing spawns inside a hole: an enemy or a crate dropped into the
    // footprint of a parked car would be stuck there.
    const holes = stageFieldHoles(stageData);
    for (let i = 0; i < 160; i++) {
        const point = {
            x: minX + Math.random() * (maxX - minX),
            y: minY + Math.random() * (maxY - minY),
        };
        if (_pointInPolygon(point.x, point.y, polygon) && !_pointInStageHole(point.x, point.y, holes)) {
            return point;
        }
    }

    return _nearestPointOnPolygon({
        x: (minX + maxX) * 0.5,
        y: (minY + maxY) * 0.5,
    }, polygon);
}

// _segmentBoxEntry - where along a to b (0..1) the segment enters the open box,
// or null when it misses. Running along an edge does not count as entering, so
// a path that hugs the box from outside is clear.
function _segmentBoxEntry(a, b, box) {
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
        if (p === 0) return q > 0;
        const r = q / p;
        if (p < 0) {
            if (r > t1) return false;
            if (r > t0) t0 = r;
        } else {
            if (r < t0) return false;
            if (r < t1) t1 = r;
        }
        return true;
    };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const hit = clip(-dx, a.x - box.minX) && clip(dx, box.maxX - a.x)
             && clip(-dy, a.y - box.minY) && clip(dy, box.maxY - a.y);
    return hit && t1 > t0 ? t0 : null;
}

function _pointsBox(points, margin) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
        minX: Math.min(...xs) - margin, maxX: Math.max(...xs) + margin,
        minY: Math.min(...ys) - margin, maxY: Math.max(...ys) + margin,
    };
}

// stageHoleWaypoint - where a character walking from one feet point toward
// another should aim instead, when the straight line runs into a hole: a corner
// of the hole on whichever side (above or below) has room to walk past it,
// first the near corner and then the far one. Null when the way is clear, or
// when neither side is open and pressing against the hole is all there is.
//
// It is steering rather than pathfinding, and it only knows about holes. The
// field's own edges need nothing like it, since movement already slides along
// them; a hole is the one obstacle a character can be lined up dead behind
// with the player straight across, where sliding goes nowhere.
//
// Corners are aimed a little wider than the hole is tested, so a character
// that stops a couple of pixels short of a corner (enemy approach has a
// deadzone) is already clear of the hole and moves on to the next one.
function stageHoleWaypoint(stageData, from, to) {
    const holes = stageFieldHoles(stageData);
    if (!holes.length) return null;
    const pad = _fieldBorderPadding();
    const blocking = holes
        .map(points => ({ points, box: _pointsBox(points, pad + 1) }))
        .map(hole => ({ ...hole, t: _segmentBoxEntry(from, to, hole.box) }))
        .filter(hole => hole.t !== null)
        .sort((a, b) => a.t - b.t)[0];
    if (!blocking) return null;

    const aim = _pointsBox(blocking.points, pad + 6);
    const rightward = to.x >= from.x;
    const nearX = rightward ? aim.minX : aim.maxX;
    const farX  = rightward ? aim.maxX : aim.minX;
    // A side is open when one walkable span at that depth runs the whole way
    // from the near corner to the far one.
    const open = y => stageFieldHorizontalSpans(stageData, y).some(span =>
        span.minX <= Math.min(nearX, farX) && span.maxX >= Math.max(nearX, farX));
    const side = [aim.minY, aim.maxY]
        .filter(open)
        .sort((a, b) => (Math.abs(from.y - a) + Math.abs(to.y - a))
                      - (Math.abs(from.y - b) + Math.abs(to.y - b)))[0];
    if (side === undefined) return null;

    const far = { x: farX, y: side };
    return _segmentBoxEntry(from, far, blocking.box) === null ? far : { x: nearX, y: side };
}

function sampleStageEntityPosition(stageData, width, height, options = {}) {
    const point = sampleStageFieldPoint(stageData, options);
    if (!point) return null;
    return {
        x: point.x - width * 0.5,
        y: point.y - height,
    };
}

function sampleStageObjectPosition(stageData, width, height, options = {}) {
    const point = sampleStageFieldPoint(stageData, options);
    if (!point) return null;
    return {
        x: point.x - width * 0.5,
        y: point.y,
    };
}