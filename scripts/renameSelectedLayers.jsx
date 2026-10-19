//@target illustrator

/**
 * renameSelectedLayers.jsx
 *
 * Renames every selected item in the Layers panel (paths, groups, text frames,
 * placed art, etc.) from a single naming pattern. When nothing is selected the
 * active layer is renamed instead, because ExtendScript cannot read which Layer
 * rows are highlighted in the panel, only which art is selected (targeted).
 *
 * Pattern tokens:
 *   #   Sequence number. A run of # sets the zero padding (## -> 01, 02, ...).
 *   *   The item's current name, or its type (Path, Group, ...) when unnamed.
 *
 * Examples (three items selected):
 *   walk_##      -> walk_01, walk_02, walk_03
 *   walk_##,5    -> walk_05, walk_06, walk_07
 *   *_ii         -> appends "_ii" to each current name
 *   hitbox       -> every item is named "hitbox"
 *
 * Items are numbered in selection order, which Illustrator reports in stacking
 * order, front-most first (top to bottom in the Layers panel).
 *
 * Usage (ExtendScript):
 *   $.arguments = "walk_##,1";
 *   $.evalFile(File("/path/to/renameSelectedLayers.jsx"));
 *
 * @param {string} [$.arguments]  "pattern" or "pattern,start". If omitted, the
 *                                user is prompted at runtime with the same format.
 */

function main() {
    if (app.documents.length === 0) {
        alert('renameSelectedLayers.jsx: Open a document before running this script.');
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection;

    // While editing text the selection is a TextRange, not an array of items.
    if (sel && sel.typename === 'TextRange') {
        alert('renameSelectedLayers.jsx: Exit text editing (Esc) and select the items to rename.');
        return;
    }

    // ── Resolve targets ──────────────────────────────────────────────────────
    var targets = [];
    var description;

    if (sel && sel.length > 0) {
        for (var i = 0; i < sel.length; i++) {
            targets.push(sel[i]);
        }
        description = targets.length + ' selected item(s)';
    } else {
        targets.push(doc.activeLayer);
        description = 'active layer "' + doc.activeLayer.name + '"';
    }

    // ── Argument validation ──────────────────────────────────────────────────
    var raw = readArguments();

    if (raw === '') {
        var input = prompt(
            'Rename ' + description + '.\n\n' +
            '#  = sequence number (## pads to 01, 02, ...)\n' +
            '*  = current name\n' +
            'Add ",N" to start numbering at N (default 1).',
            targets.length === 1 ? targets[0].name : ''
        );
        if (input === null) {
            // User cancelled, exit silently
            return;
        }
        raw = String(input);
    }

    var parsed = parsePattern(raw);

    if (parsed.pattern === '') {
        alert('renameSelectedLayers.jsx: A name pattern is required. Script cancelled.');
        return;
    }

    // ── Rename targets ───────────────────────────────────────────────────────
    var failed = [];

    for (var t = 0; t < targets.length; t++) {
        var target = targets[t];
        var label = currentLabel(target);

        try {
            target.name = buildName(parsed.pattern, parsed.start + t, label);
        } catch (e) {
            failed.push(label + ': ' + e.message);
        }
    }

    if (failed.length > 0) {
        alert('renameSelectedLayers.jsx: ' + failed.length + ' item(s) could not be renamed:\n' +
            failed.join('\n'));
    }
}

/**
 * Reads the optional pattern passed through $.arguments, then clears it so a
 * later run from the Scripts menu prompts instead of reusing a stale value.
 *
 * @returns {string} Trimmed argument string, or '' when none was passed.
 */
function readArguments() {
    var args = (typeof $.arguments !== 'undefined' && $.arguments !== null)
        ? trim(String($.arguments))
        : '';
    $.arguments = null;
    return args;
}

/**
 * Splits off a trailing ",N" start number. Any other comma stays part of the
 * name, so patterns such as "a,b_#" are kept intact.
 *
 * @param {string} raw - Pattern text, optionally ending in ",N".
 * @returns {{pattern: string, start: number}}
 */
function parsePattern(raw) {
    var text = trim(raw);
    var match = /^(.*),\s*(\d+)$/.exec(text);

    if (match) {
        return { pattern: trim(match[1]), start: parseInt(match[2], 10) };
    }
    return { pattern: text, start: 1 };
}

/**
 * Expands the pattern tokens for one item in a single pass, so a current name
 * that itself contains "#" or "*" is inserted literally.
 *
 * @param {string} pattern - Naming pattern.
 * @param {number} number - Sequence number for this item.
 * @param {string} current - The item's current label.
 * @returns {string} The new name.
 */
function buildName(pattern, number, current) {
    return pattern.replace(/#+|\*/g, function (token) {
        return token === '*' ? current : padNumber(number, token.length);
    });
}

// ExtendScript is ES3, so String.prototype.padStart is not available.
function padNumber(number, width) {
    var digits = String(number);
    while (digits.length < width) {
        digits = '0' + digits;
    }
    return digits;
}

// Unnamed items report name === '' (<Path>, <Group> are only UI labels), so
// fall back to the type name to keep "*" from producing an empty string.
function currentLabel(target) {
    return target.name !== '' ? target.name : target.typename.replace(/Item$/, '');
}

function trim(text) {
    return text.replace(/^\s+|\s+$/g, '');
}

try {
    main();
} catch (err) {
    alert('renameSelectedLayers.jsx failed: ' + err + (err && err.line ? ' (line ' + err.line + ')' : ''));
}
