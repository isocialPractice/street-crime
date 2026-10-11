//@target illustrator

/**
 * mapSelectLayers.jsx
 *
 * Selects the items a layer map renames, in a document that is already open,
 * so you can see in Illustrator what mapLayers.jsx is about to touch (or has
 * touched). It reads the same map (data/layerMap.json) with the same matching
 * rules; see mapLayers.jsx for the format. Nothing is renamed.
 *
 * What gets selected: every child a "layers" list gives a name to, in each
 * container whose children fit either "current" (not renamed yet) or
 * "change" (already renamed). Entries left as * or null in "change" are
 * placeholders and are not selected. Any selection beforehand is cleared. A
 * layer cannot be selected itself, so a layer in a list has its artwork
 * selected instead.
 *
 * From the command line:
 *   perl scripts/runAdobeScript.pl scripts/mapSelectLayers.jsx [map=<file.json>] [doc=<file.ai>] [exact=1]
 *   Selects in the active document, or in doc= when that file is open, and
 *   prints what it selected. It never opens a file: with no document open, or
 *   doc= not open, it prints an error line and changes nothing.
 *
 * From File > Scripts: selects in the active document, and shows an alert
 * only when nothing could be selected or part of the map did not fit.
 *
 * Options:
 *   map=<file.json>   Layer map. Default: data/layerMap.json beside this file.
 *   doc=<file.ai>     Open document to select in. Default: the active one.
 *   exact=1           As in mapLayers.jsx: skip containers whose child count
 *                     differs from their list length.
 */

(function (scriptArgs) {

    //@include "lib/layerMap.jsxinc"

    // Read here rather than in the include, where it would name the include.
    var SCRIPT_FILE = $.fileName;
    var NAME = 'mapSelectLayers';

    var opts = null;
    try {
        opts = readOptions(scriptArgs, { values: ['map', 'doc'], flags: ['exact'] });
        return run(opts);
    } catch (err) {
        return fail(errorText(err));
    }

    // ── Run ──────────────────────────────────────────────────────────────────

    function run(opts) {
        var doc = resolveOpenDocument(opts);
        var mapFile = resolveMapFile(opts, SCRIPT_FILE);
        if (!mapFile) {
            return NAME + ': cancelled.';
        }
        var trees = loadMap(mapFile, false);

        var report = newReport(['selected', 'failed', 'skipped', 'missing'], function (count) {
            return count('selected') + ' selected, ' + count('skipped') + ' skipped, ' +
                count('missing') + ' missing, ' + count('failed') + ' failed';
        });
        report.note(NAME + ': ' + doc.name + ' using ' + mapFile.fsName);

        var targets = [];
        walkMap(doc, trees.current, trees.change, {
            missing: function (entry, key) {
                report.add('missing', where(entry) + ': nothing matches "' + key + '"');
            },
            list: function (entry, curList, chgList) {
                collectTargets(entry, curList, chgList, opts.exact, report, targets);
            }
        });

        doc.selection = null;
        for (var i = 0; i < targets.length; i++) {
            var problem = selectItem(targets[i].item);
            if (problem === '') {
                report.add('selected', targets[i].line);
            } else {
                report.add('failed', targets[i].line + ': ' + problem);
            }
        }
        app.redraw();

        if (!opts.commandLine && needsAttention(report)) {
            alert(report.brief(25));
        }
        return report.text();
    }

    /**
     * Failures come back as one plain line. On the command line that line is
     * the script's result, which runAdobeScript.pl prints to stdout; inside
     * Illustrator it is shown in an alert.
     */
    function fail(message) {
        var text = NAME + ': ' + message;
        // opts is unset only when the arguments themselves were bad, which
        // means a command-line run.
        if (opts && !opts.commandLine) {
            alert(text);
        }
        return text;
    }

    // A clean selection speaks for itself; anything else earns an alert.
    function needsAttention(report) {
        return report.count('selected') === 0 ||
            report.count('failed') + report.count('skipped') + report.count('missing') > 0;
    }

    // ── Selecting ────────────────────────────────────────────────────────────

    /**
     * The open document to select in: doc= when given, brought to the front,
     * otherwise the active document. Never opens a file.
     */
    function resolveOpenDocument(opts) {
        if (app.documents.length === 0) {
            throw failure('no document is open in Illustrator. Open the file to select in, then run this again.');
        }
        if (!opts.doc) {
            return app.activeDocument;
        }
        var file = new File(opts.doc);
        var open = findOpenDocument(file);
        if (!open) {
            throw failure(file.fsName + ' is not open in Illustrator. Open it, then run this again.');
        }
        open.activate();
        return open;
    }

    /**
     * Queues the children one "layers" list names, for a container whose
     * children fit either tree, or reports why it does not.
     */
    function collectTargets(entry, curList, chgList, exact, report, targets) {
        var kids = childrenOf(entry.item);
        var mismatch = listMismatch(kids, curList, exact);
        if (mismatch !== '' && listMismatch(kids, chgList, exact) !== '') {
            report.add('skipped', where(entry) + ': ' + mismatch);
            return;
        }

        for (var i = 0; i < chgList.length; i++) {
            var next = targetName(chgList[i]);
            if (next === null) {
                continue;
            }
            var state = itemName(kids[i]) === next ? 'already mapped' : 'renames to ' + chgList[i];
            targets.push({
                item: kids[i],
                line: where(entry) + ' [' + i + '] ' + label(kids[i]) + ' (' + state + ')'
            });
        }
    }

    /**
     * @returns {string} '' when the item ends up selected, otherwise why not.
     */
    function selectItem(item) {
        var isLayer = item.typename === 'Layer';
        try {
            if (isLayer) {
                item.hasSelectedArtwork = true;
            } else {
                item.selected = true;
            }
        } catch (e) {
            return errorText(e);
        }
        // Locked or hidden art takes the assignment without becoming selected.
        if (isLayer ? item.hasSelectedArtwork : item.selected) {
            return '';
        }
        return isLayer
            ? 'could not be selected: the layer is locked, hidden or empty'
            : 'could not be selected: it, or a layer above it, is locked or hidden';
    }

})(typeof arguments !== 'undefined' && arguments ? arguments : []);
