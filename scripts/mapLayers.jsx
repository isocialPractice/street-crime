//@target illustrator

/**
 * mapLayers.jsx
 *
 * Renames layers, groups and paths from a JSON layer map. Illustrator writes
 * each item's name out as its SVG id, so naming the parts of a character in
 * the source .ai is what gives the exported sprites the ids that color and
 * outfit changes key off.
 *
 * Map format (data/layerMap.json):
 *   {
 *     "current": { "Player_Walk": { "front-glove": { "strokes": { "layers": ["<Path>", "<Path>"] } } } },
 *     "change":  { "Player_Walk": { "front-glove": { "strokes": { "layers": ["thumb", "outline"] } } } }
 *   }
 *
 *   - "current" and "change" are two copies of one tree. Their keys must
 *     match; only the "layers" lists differ.
 *   - Every key other than "layers" names an item to step into. A key matches
 *     at any depth below the previous match, so "Player_Walk" > "front-glove"
 *     reaches the glove in every frame group (walk_0, walk_1, ...) without
 *     naming them. Start a key with ">" to match direct children only.
 *   - "layers" lists the direct children of the matched item, top to bottom as
 *     the Layers panel shows them. Inside a layer, sublayers are counted
 *     before artwork. The list may stop short: ["<Path>"] covers only the
 *     first child and leaves the rest alone. Nothing is renamed unless every
 *     listed child matches its "current" entry; a container that does not,
 *     or has fewer children than the list, is skipped and reported.
 *
 * List entries:
 *   name        In "current", an exact name. In "change", the new name.
 *   <Path>      An unnamed item of that kind, as the Layers panel labels it:
 *               <Path>, <Compound Path>, <Group>, <Clip Group>,
 *               <Clipping Path>, <Image>, <Linked File>, <Mesh>, <Text>,
 *               <Symbol>, and the live shapes <Rectangle>, <Ellipse>, etc.
 *               In "change" it clears the name back to that default label.
 *   * or null   In "current", any item. In "change", leave the name alone.
 *
 * Options, as "key=value" arguments (runAdobeScript.pl, DoJavaScriptFile,
 * `do javascript ... with arguments`) or in the $.arguments string the other
 * user scripts read:
 *   map=<file.json>   Layer map. Default: data/layerMap.json beside this file.
 *   doc=<file.ai>     Document to map, opened if it is not already. Default:
 *                     the active document.
 *   dry=1             Report what would be renamed without renaming it.
 *   reverse=1         Swap "current" and "change", undoing an earlier run.
 *   exact=1           Skip any container whose child count differs from its
 *                     list length, rather than mapping the first children.
 *   save=1            Save the document afterwards.
 *   log=<file>        Also write the report to this file.
 * A bare *.json argument is taken as map=, a bare *.ai argument as doc=.
 *
 * Given any arguments, the script shows no dialogs and returns its report as
 * the script result, which runAdobeScript.pl prints. Run from File > Scripts
 * with none, it maps the active document and shows a summary alert.
 */

(function (scriptArgs) {

    // The key in a map node holding its list of child names. Every other key
    // names an item to step into.
    var LIST_KEY = 'layers';

    // Layers panel labels for unnamed items, and the kind of item each means.
    var KINDS = {
        'Path':          function (it) { return it.typename === 'PathItem'; },
        'Clipping Path': function (it) { return it.typename === 'PathItem' && it.clipping; },
        'Compound Path': function (it) { return it.typename === 'CompoundPathItem'; },
        'Group':         function (it) { return it.typename === 'GroupItem'; },
        'Clip Group':    function (it) { return it.typename === 'GroupItem' && it.clipped; },
        'Image':         function (it) { return it.typename === 'RasterItem'; },
        'Linked File':   function (it) { return it.typename === 'PlacedItem'; },
        'Mesh':          function (it) { return it.typename === 'MeshItem'; },
        'Text':          function (it) { return it.typename === 'TextFrame'; },
        'Symbol':        function (it) { return it.typename === 'SymbolItem'; }
    };

    // Live shapes get their own panel labels but are plain paths to scripting.
    var LIVE_SHAPES = ['Rectangle', 'Rounded Rectangle', 'Ellipse', 'Polygon', 'Star', 'Line'];
    for (var s = 0; s < LIVE_SHAPES.length; s++) {
        KINDS[LIVE_SHAPES[s]] = KINDS['Path'];
    }

    var opts = null;
    try {
        opts = readOptions(scriptArgs);
        return run(opts);
    } catch (err) {
        var message = 'mapLayers.jsx failed: ' + errorText(err);
        if (opts && !opts.quiet) {
            alert(message);
            return message;
        }
        // Thrown back so a command-line caller sees a failure, not a result.
        throw new Error(message);
    }

    // ── Run ──────────────────────────────────────────────────────────────────

    function run(opts) {
        var mapFile = resolveMapFile(opts);
        if (!mapFile) {
            return 'mapLayers.jsx: cancelled.';
        }
        var trees = loadMap(mapFile, opts.reverse);

        var report = newReport(opts.dry);
        var previousLevel = app.userInteractionLevel;
        if (opts.quiet) {
            // Nobody is there to answer a missing-font or profile dialog.
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
        }
        try {
            var target = resolveDocument(opts);
            report.note('mapLayers: ' + target.doc.name + ' using ' + mapFile.fsName +
                (opts.reverse ? ' (reversed)' : '') +
                (opts.dry ? ' (dry run, nothing renamed)' : ''));

            // Every match is found against the names as they stand before
            // anything is renamed, so the order keys appear in cannot change
            // what a later key finds.
            var plan = [];
            mapNode([{ item: target.doc, crumb: '' }], trees.current, trees.change, report, plan, opts.exact);
            applyPlan(plan, report, opts.dry);
            finishDocument(target, opts, report);
        } finally {
            app.userInteractionLevel = previousLevel;
        }

        var text = report.text();
        if (opts.log) {
            writeText(new File(opts.log), text);
        }
        if (!opts.quiet) {
            alert(report.brief(25));
        }
        return text;
    }

    // ── Matching ─────────────────────────────────────────────────────────────

    /**
     * Walks one level of the map. Each key is looked up below every container
     * the previous level matched, then the level's "layers" list is checked
     * against each container's children and the renames it calls for are
     * queued on the plan.
     *
     * @param {Array} containers - {item, crumb} entries matched so far.
     * @param {Object} curNode - Node of the "current" tree.
     * @param {Object} chgNode - The same node in the "change" tree.
     * @param {Object} report - Report collecting what happened.
     * @param {Array} plan - Queued renames, applied once matching is done.
     * @param {boolean} exact - Require a list to cover every child.
     */
    function mapNode(containers, curNode, chgNode, report, plan, exact) {
        for (var key in curNode) {
            if (!curNode.hasOwnProperty(key) || key === LIST_KEY) {
                continue;
            }
            var selector = parseSelector(key);
            var matches = [];
            for (var c = 0; c < containers.length; c++) {
                if (findMatches(containers[c], selector, matches) === 0) {
                    report.add('missing', where(containers[c]) + ': nothing matches "' + key + '"');
                }
            }
            if (matches.length > 0) {
                mapNode(matches, curNode[key], chgNode[key], report, plan, exact);
            }
        }

        if (curNode.hasOwnProperty(LIST_KEY)) {
            for (var i = 0; i < containers.length; i++) {
                planRenames(containers[i], curNode[LIST_KEY], chgNode[LIST_KEY], report, plan, exact);
            }
        }
    }

    /**
     * Collects the items below a container that a selector matches. A match is
     * not searched any further for the same name, so "strokes" finds the
     * nearest strokes group on each branch rather than every one nested inside
     * it too.
     *
     * @returns {number} How many matches this container contributed.
     */
    function findMatches(entry, selector, out) {
        var kids = childEntries(entry);
        var found = 0;
        for (var i = 0; i < kids.length; i++) {
            if (selector.test(kids[i].item)) {
                out.push(kids[i]);
                found++;
            } else if (!selector.direct) {
                found += findMatches(kids[i], selector, out);
            }
        }
        return found;
    }

    function parseSelector(key) {
        var direct = key.charAt(0) === '>';
        var name = direct ? trim(key.substr(1)) : key;
        return { direct: direct, test: makeMatcher(name) };
    }

    /**
     * Builds the test for one map entry: an exact name, an <Unnamed Kind>
     * token, or a wildcard ("*" or null).
     */
    function makeMatcher(entry) {
        if (entry === null || entry === '*') {
            return function () { return true; };
        }
        var token = /^<(.+)>$/.exec(entry);
        if (token) {
            var kind = KINDS.hasOwnProperty(token[1]) ? KINDS[token[1]] : null;
            return function (item) { return itemName(item) === '' && (!kind || kind(item)); };
        }
        return function (item) { return itemName(item) === entry; };
    }

    /**
     * Queues the renames one "layers" list calls for on one container, or
     * reports why there are none. Children past the end of a short list are
     * left alone.
     */
    function planRenames(entry, curList, chgList, report, plan, exact) {
        var kids = childrenOf(entry.item);
        var mismatch = listMismatch(kids, curList, exact);

        if (mismatch !== '') {
            // Already renamed by an earlier run reads as done, not as a fault.
            if (listMismatch(kids, chgList, exact) === '') {
                report.add('mapped', where(entry));
            } else {
                report.add('skipped', where(entry) + ': ' + mismatch);
            }
            return;
        }

        var queued = 0;
        for (var i = 0; i < chgList.length; i++) {
            var next = targetName(chgList[i]);
            if (next === null || itemName(kids[i]) === next) {
                continue;
            }
            plan.push({
                item: kids[i],
                name: next,
                line: where(entry) + ' [' + i + '] ' + label(kids[i]) + ' -> ' +
                    (next === '' ? '<' + kindLabel(kids[i]) + '>' : next)
            });
            queued++;
        }
        if (queued === 0) {
            report.add('mapped', where(entry));
        }
    }

    /**
     * A list fits when each entry matches the child at its position. Without
     * exact, a list shorter than the children fits on its first entries.
     *
     * @returns {string} Why the children do not fit the list, or '' if they do.
     */
    function listMismatch(kids, list, exact) {
        if (kids.length < list.length || (exact && kids.length !== list.length)) {
            return 'has ' + kids.length + ' children, map lists ' + list.length;
        }
        for (var i = 0; i < list.length; i++) {
            if (!makeMatcher(list[i])(kids[i])) {
                return 'child [' + i + '] is ' + label(kids[i]) + ', map expects ' + list[i];
            }
        }
        return '';
    }

    // The name a "change" entry asks for: null to leave it, '' to clear it.
    function targetName(entry) {
        if (entry === null || entry === '*') {
            return null;
        }
        return /^<.+>$/.test(entry) ? '' : entry;
    }

    // ── Renaming ─────────────────────────────────────────────────────────────

    function applyPlan(plan, report, dry) {
        for (var i = 0; i < plan.length; i++) {
            var step = plan[i];
            if (dry) {
                report.add('rename', step.line);
                continue;
            }
            var failure = setName(step.item, step.name);
            if (failure === '') {
                report.add('renamed', step.line);
            } else {
                report.add('failed', step.line + ': ' + failure);
            }
        }
    }

    /**
     * @returns {string} '' on success, otherwise what went wrong.
     */
    function setName(item, name) {
        try {
            item.name = name;
            return '';
        } catch (e) {
            if (!isLocked(item)) {
                return errorText(e);
            }
        }
        // A locked item refuses edits: unlock it for the rename, lock it again.
        try {
            item.locked = false;
            try {
                item.name = name;
            } finally {
                item.locked = true;
            }
            return '';
        } catch (e2) {
            return errorText(e2);
        }
    }

    function isLocked(item) {
        try {
            return item.locked === true;
        } catch (e) {
            return false;
        }
    }

    // ── Document tree ────────────────────────────────────────────────────────

    /**
     * Direct children of a document, layer or group, top to bottom. A layer's
     * sublayers come before its artwork, since scripting keeps the two in
     * separate collections.
     */
    function childrenOf(item) {
        var kids = [];
        switch (item.typename) {
            case 'Document':
                pushAll(kids, item.layers);
                break;
            case 'Layer':
                pushAll(kids, item.layers);
                pushAll(kids, item.pageItems);
                break;
            case 'GroupItem':
                pushAll(kids, item.pageItems);
                break;
        }
        return kids;
    }

    function childEntries(entry) {
        var kids = childrenOf(entry.item);
        var entries = [];
        for (var i = 0; i < kids.length; i++) {
            entries.push({
                item: kids[i],
                crumb: (entry.crumb ? entry.crumb + ' > ' : '') + label(kids[i])
            });
        }
        return entries;
    }

    function pushAll(out, collection) {
        for (var i = 0; i < collection.length; i++) {
            out.push(collection[i]);
        }
    }

    function itemName(item) {
        return item.typename === 'Document' ? '' : item.name;
    }

    // An item's Layers panel label: its name, or <Kind> when it has none.
    function label(item) {
        var name = itemName(item);
        return name !== '' ? name : '<' + kindLabel(item) + '>';
    }

    function kindLabel(item) {
        switch (item.typename) {
            case 'PathItem':         return item.clipping ? 'Clipping Path' : 'Path';
            case 'CompoundPathItem': return 'Compound Path';
            case 'GroupItem':        return item.clipped ? 'Clip Group' : 'Group';
            case 'RasterItem':       return 'Image';
            case 'PlacedItem':       return 'Linked File';
            case 'MeshItem':         return 'Mesh';
            case 'TextFrame':        return 'Text';
            case 'SymbolItem':       return 'Symbol';
            default:                 return item.typename.replace(/Item$/, '');
        }
    }

    function where(entry) {
        return entry.crumb || '(document)';
    }

    // ── Documents ────────────────────────────────────────────────────────────

    function resolveDocument(opts) {
        if (opts.doc) {
            var file = new File(opts.doc);
            if (!file.exists) {
                throw new Error('document not found: ' + file.fsName);
            }
            var open = findOpenDocument(file);
            if (open) {
                return { doc: open, opened: false };
            }
            return { doc: app.open(file), opened: true };
        }
        if (app.documents.length === 0) {
            throw new Error('no document is open. Open one, or pass doc=<file.ai>.');
        }
        return { doc: app.activeDocument, opened: false };
    }

    function findOpenDocument(file) {
        var wanted = comparablePath(file.fsName);
        for (var i = 0; i < app.documents.length; i++) {
            try {
                if (comparablePath(app.documents[i].fullName.fsName) === wanted) {
                    return app.documents[i];
                }
            } catch (e) {
                // A document that was never saved has no file to compare.
            }
        }
        return null;
    }

    function comparablePath(path) {
        return String(path).replace(/\\/g, '/').toLowerCase();
    }

    /**
     * Saves and closes as asked. A document this script opened is closed again
     * unless it holds renames nobody has saved yet, which are left open in
     * Illustrator rather than thrown away.
     */
    function finishDocument(target, opts, report) {
        var doc = target.doc;
        var renamed = report.count('renamed');

        if (!opts.dry && opts.save && renamed > 0) {
            try {
                doc.save();
                report.note('Saved ' + doc.fullName.fsName);
            } catch (e) {
                report.add('failed', 'saving ' + doc.name + ': ' + errorText(e));
                return;
            }
        } else if (!opts.dry && renamed > 0) {
            report.note(doc.name + ' has unsaved renames: save it in Illustrator, or rerun with save=1.');
            return;
        }

        if (target.opened) {
            doc.close(SaveOptions.DONOTSAVECHANGES);
        }
    }

    // ── Map file ─────────────────────────────────────────────────────────────

    function resolveMapFile(opts) {
        if (opts.map) {
            return new File(opts.map);
        }
        var here = scriptFolder();
        if (here) {
            var fallback = new File(here.fsName + '/data/layerMap.json');
            if (fallback.exists || opts.quiet) {
                return fallback;
            }
        }
        if (opts.quiet) {
            throw new Error('no layer map given. Pass map=<file.json>.');
        }
        return File.openDialog('Select a layer map', 'JSON:*.json');
    }

    function scriptFolder() {
        try {
            return $.fileName ? new File($.fileName).parent : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Reads and checks the map, so a malformed one stops the run before any
     * document is touched.
     *
     * @returns {{current: Object, change: Object}}
     */
    function loadMap(file, reverse) {
        if (!file.exists) {
            throw new Error('layer map not found: ' + file.fsName);
        }
        var map = parseJson(readText(file), file.fsName);
        if (!isNode(map) || !isNode(map.current) || !isNode(map.change)) {
            throw new Error(file.fsName + ' needs a "current" and a "change" object.');
        }
        var problems = [];
        compareNodes(map.current, map.change, '', problems);
        if (problems.length > 0) {
            throw new Error('"current" and "change" do not line up:\n  ' + problems.join('\n  '));
        }
        return reverse
            ? { current: map.change, change: map.current }
            : { current: map.current, change: map.change };
    }

    function compareNodes(cur, chg, path, problems) {
        var key;
        for (key in cur) {
            if (!cur.hasOwnProperty(key)) {
                continue;
            }
            var at = path ? path + ' > ' + key : key;
            if (!chg.hasOwnProperty(key)) {
                problems.push('"change" has no ' + at);
            } else if (key === LIST_KEY) {
                compareLists(cur[key], chg[key], at, problems);
            } else if (!isNode(cur[key]) || !isNode(chg[key])) {
                problems.push(at + ' must be an object in both trees');
            } else {
                compareNodes(cur[key], chg[key], at, problems);
            }
        }
        for (key in chg) {
            if (chg.hasOwnProperty(key) && !cur.hasOwnProperty(key)) {
                problems.push('"current" has no ' + (path ? path + ' > ' + key : key));
            }
        }
    }

    function compareLists(cur, chg, at, problems) {
        if (!(cur instanceof Array) || !(chg instanceof Array)) {
            problems.push(at + ' must be a list in both trees');
            return;
        }
        if (cur.length !== chg.length) {
            problems.push(at + ' lists ' + cur.length + ' names in "current" but ' + chg.length + ' in "change"');
            return;
        }
        for (var i = 0; i < cur.length; i++) {
            if (!isEntry(cur[i]) || !isEntry(chg[i])) {
                problems.push(at + ' [' + i + '] must be a name or null');
            }
        }
    }

    function isNode(value) {
        return value !== null && typeof value === 'object' && !(value instanceof Array);
    }

    function isEntry(value) {
        return value === null || typeof value === 'string';
    }

    /**
     * ExtendScript is ES3 and has no JSON object. The text is checked with
     * json2's validation pass (only JSON punctuation may be left once strings,
     * numbers and literals are stripped) before eval is allowed near it.
     */
    function parseJson(text, source) {
        var clean = text.replace(/^﻿/, '');
        var probe = clean
            .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
            .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
            .replace(/(?:^|:|,)(?:\s*\[)+/g, '');
        if (!/^[\],:{}\s]*$/.test(probe)) {
            throw new Error(source + ' is not valid JSON.');
        }
        try {
            return eval('(' + clean + ')');
        } catch (e) {
            throw new Error(source + ' is not valid JSON: ' + errorText(e));
        }
    }

    // ── Options ──────────────────────────────────────────────────────────────

    function readOptions(scriptArgs) {
        var raw = collectArguments(scriptArgs);
        var opts = { map: '', doc: '', log: '', dry: false, reverse: false, exact: false, save: false, quiet: raw.length > 0 };

        for (var i = 0; i < raw.length; i++) {
            var arg = trim(raw[i]);
            if (arg === '') {
                continue;
            }
            var pair = /^([A-Za-z]+)\s*=\s*([\s\S]*)$/.exec(arg);
            if (pair) {
                var key = pair[1].toLowerCase();
                var value = trim(pair[2]);
                if (key === 'map' || key === 'doc' || key === 'log') {
                    opts[key] = value;
                } else if (key === 'dry' || key === 'reverse' || key === 'exact' || key === 'save') {
                    opts[key] = /^(1|true|yes|on)$/i.test(value);
                } else {
                    throw new Error('unknown option "' + pair[1] + '".');
                }
            } else if (/\.json$/i.test(arg)) {
                opts.map = arg;
            } else if (/\.ai$/i.test(arg)) {
                opts.doc = arg;
            } else {
                throw new Error('unrecognised argument "' + arg + '".');
            }
        }
        return opts;
    }

    /**
     * Gathers string arguments from the script's arguments array and from
     * $.arguments, the convention the other user scripts share. Launchers such
     * as ESTK can hand over a BridgeTalk object instead of strings, which is
     * ignored.
     */
    function collectArguments(scriptArgs) {
        var list = [];
        for (var i = 0; i < scriptArgs.length; i++) {
            if (typeof scriptArgs[i] === 'string') {
                list.push(scriptArgs[i]);
            }
        }

        var extra = (typeof $.arguments !== 'undefined') ? $.arguments : null;
        // Cleared so a later run from the Scripts menu does not reuse it.
        $.arguments = null;
        if (extra instanceof Array) {
            for (var j = 0; j < extra.length; j++) {
                list.push(String(extra[j]));
            }
        } else if (extra !== null && trim(String(extra)) !== '') {
            // "map=a.json, dry=1": split only on commas that start a new key,
            // so a path with a comma in it survives.
            var parts = String(extra).split(/\s*,\s*(?=[A-Za-z]+\s*=)/);
            for (var k = 0; k < parts.length; k++) {
                list.push(parts[k]);
            }
        }
        return list;
    }

    // ── Report ───────────────────────────────────────────────────────────────

    /**
     * Collects report lines by outcome. The first note is the heading; later
     * notes follow the summary.
     */
    function newReport(dry) {
        var ORDER = ['rename', 'renamed', 'failed', 'mapped', 'skipped', 'missing'];
        var notes = [];
        var buckets = {};
        for (var i = 0; i < ORDER.length; i++) {
            buckets[ORDER[i]] = [];
        }

        function lines() {
            var all = [];
            for (var k = 0; k < ORDER.length; k++) {
                all = all.concat(buckets[ORDER[k]]);
            }
            return all;
        }

        function summary() {
            var done = dry ? buckets.rename.length + ' to rename' : buckets.renamed.length + ' renamed';
            return done + ', ' + buckets.mapped.length + ' already mapped, ' +
                buckets.skipped.length + ' skipped, ' + buckets.missing.length + ' missing, ' +
                buckets.failed.length + ' failed';
        }

        return {
            note: function (text) { notes.push(text); },
            add: function (kind, text) { buckets[kind].push(padRight(kind, 8) + text); },
            count: function (kind) { return buckets[kind].length; },
            text: function () {
                return notes.slice(0, 1).concat(lines(), ['', summary()], notes.slice(1)).join('\n');
            },
            brief: function (limit) {
                var all = lines();
                var shown = all.slice(0, limit);
                if (all.length > limit) {
                    shown.push('... and ' + (all.length - limit) + ' more (pass log=<file> for all of it)');
                }
                return [summary(), ''].concat(shown, notes.slice(1)).join('\n');
            }
        };
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function readText(file) {
        file.encoding = 'UTF-8';
        if (!file.open('r')) {
            throw new Error('cannot read ' + file.fsName);
        }
        try {
            return file.read();
        } finally {
            file.close();
        }
    }

    function writeText(file, text) {
        if (!file.parent.exists) {
            file.parent.create();
        }
        file.encoding = 'UTF-8';
        file.lineFeed = 'Unix';
        if (!file.open('w')) {
            throw new Error('cannot write ' + file.fsName);
        }
        try {
            file.write(text);
        } finally {
            file.close();
        }
    }

    // ExtendScript is ES3, so String.prototype.trim and padEnd are not available.
    function trim(text) {
        return String(text).replace(/^\s+|\s+$/g, '');
    }

    function padRight(text, width) {
        while (text.length < width) {
            text += ' ';
        }
        return text;
    }

    function errorText(err) {
        var text = (err && err.message) ? err.message : String(err);
        return text + ((err && err.line) ? ' (line ' + err.line + ')' : '');
    }

})(typeof arguments !== 'undefined' && arguments ? arguments : []);
