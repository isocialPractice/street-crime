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

function _svgSceneFieldShape(svgText, fieldSelector = '#field') {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svgEl = doc.documentElement;
    const fieldEl = doc.querySelector(fieldSelector) || doc.querySelector('#field');
    if (!svgEl || !fieldEl) return null;

    const vb = _svgSceneViewBox(svgEl);
    let sourcePoints = [];
    const tag = fieldEl.tagName.toLowerCase();

    if (tag === 'polygon' || tag === 'polyline') {
        sourcePoints = _svgScenePointList(fieldEl.getAttribute('points'));
    } else if (tag === 'rect') {
        const x = parseFloat(fieldEl.getAttribute('x')) || 0;
        const y = parseFloat(fieldEl.getAttribute('y')) || 0;
        const width = parseFloat(fieldEl.getAttribute('width')) || 0;
        const height = parseFloat(fieldEl.getAttribute('height')) || 0;
        sourcePoints = [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ];
    }

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

function createSvgScene({ path, fieldSelector = '#field', worldWidth = 800, worldHeight = 600 }) {
    const svgText = loadSvgText(path);
    return {
        path,
        img: loadSvgImg(svgText),
        worldWidth,
        worldHeight,
        field: _svgSceneFieldShape(svgText, fieldSelector),
    };
}

const SVG_SCENES = {
    testItWorked: createSvgScene({
        path: 'levels/Test_ItWorked.svg',
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

function stageFieldVerticalSpans(stageData, x) {
    const polygon = stageFieldPolygon(stageData);
    if (!polygon || polygon.length < 3) return [];
    const ys = _sampleOffsets(x).flatMap(sampleX => _verticalIntersections(polygon, sampleX));
    return _applySpanPadding(_spansFromIntersections(ys, 'minY', 'maxY'), 'minY', 'maxY');
}

function stageFieldHorizontalSpans(stageData, y) {
    const polygon = stageFieldPolygon(stageData);
    if (!polygon || polygon.length < 3) return [];
    const xs = _sampleOffsets(y).flatMap(sampleY => _horizontalIntersections(polygon, sampleY));
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

    for (let i = 0; i < 160; i++) {
        const point = {
            x: minX + Math.random() * (maxX - minX),
            y: minY + Math.random() * (maxY - minY),
        };
        if (_pointInPolygon(point.x, point.y, polygon)) return point;
    }

    return _nearestPointOnPolygon({
        x: (minX + maxX) * 0.5,
        y: (minY + maxY) * 0.5,
    }, polygon);
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