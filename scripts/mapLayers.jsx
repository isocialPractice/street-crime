//@target illustrator

/**
 * mapLayers.jsx
 *
 * Renames layers, groups and paths from a JSON layer map. Illustrator writes
 * each item's name out as its SVG id, so naming the parts of a character in
 * the source .ai is what gives the exported sprites the ids that color and
 * outfit changes key off. The matching itself lives in lib/layerMap.jsxinc,
 * shared with mapSelectLayers.jsx.
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
 * Run from the command line, the script shows no dialogs and returns its
 * report as the script result, which runAdobeScript.pl prints. Run from
 * File > Scripts, it maps the active document and shows a summary alert.
 */

(function (scriptArgs) {

    //@include "lib/layerMap.jsxinc"

    // Read here rather than in the include, where it would name the include.
    var SCRIPT_FILE = $.fileName;

    var opts = null;
    try {
        opts = readOptions(scriptArgs, {
            values: ['map', 'doc', 'log'],
            flags: ['dry', 'reverse', 'exact', 'save']
        });
        return run(opts);
    } catch (err) {
        var message = 'mapLayers.jsx failed: ' + errorText(err);
        if (opts && !opts.commandLine) {
            alert(message);
            return message;
        }
        // Thrown back so a command-line caller sees a failure, not a result.
        throw new Error(message);
    }

    // ── Run ──────────────────────────────────────────────────────────────────

    function run(opts) {
        var mapFile = resolveMapFile(opts, SCRIPT_FILE);
        if (!mapFile) {
            return 'mapLayers.jsx: cancelled.';
        }
        var trees = loadMap(mapFile, opts.reverse);

        var report = newReport(['rename', 'renamed', 'failed', 'mapped', 'skipped', 'missing'], function (count) {
            var done = opts.dry ? count('rename') + ' to rename' : count('renamed') + ' renamed';
            return done + ', ' + count('mapped') + ' already mapped, ' + count('skipped') + ' skipped, ' +
                count('missing') + ' missing, ' + count('failed') + ' failed';
        });
        var previousLevel = app.userInteractionLevel;
        if (opts.commandLine) {
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
            walkMap(target.doc, trees.current, trees.change, {
                missing: function (entry, key) {
                    report.add('missing', where(entry) + ': nothing matches "' + key + '"');
                },
                list: function (entry, curList, chgList) {
                    planRenames(entry, curList, chgList, opts.exact, report, plan);
                }
            });
            applyPlan(plan, report, opts.dry);
            finishDocument(target, opts, report);
        } finally {
            app.userInteractionLevel = previousLevel;
        }

        var text = report.text();
        if (opts.log) {
            writeText(new File(opts.log), text);
        }
        if (!opts.commandLine) {
            alert(report.brief(25));
        }
        return text;
    }

    // ── Renaming ─────────────────────────────────────────────────────────────

    /**
     * Queues the renames one "layers" list calls for on one container, or
     * reports why there are none. Children past the end of a short list are
     * left alone.
     */
    function planRenames(entry, curList, chgList, exact, report, plan) {
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

    function applyPlan(plan, report, dry) {
        for (var i = 0; i < plan.length; i++) {
            var step = plan[i];
            if (dry) {
                report.add('rename', step.line);
                continue;
            }
            var problem = setName(step.item, step.name);
            if (problem === '') {
                report.add('renamed', step.line);
            } else {
                report.add('failed', step.line + ': ' + problem);
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

    // ── Documents ────────────────────────────────────────────────────────────

    function resolveDocument(opts) {
        if (opts.doc) {
            var file = new File(opts.doc);
            if (!file.exists) {
                throw failure('document not found: ' + file.fsName);
            }
            var open = findOpenDocument(file);
            if (open) {
                return { doc: open, opened: false };
            }
            return { doc: app.open(file), opened: true };
        }
        if (app.documents.length === 0) {
            throw failure('no document is open. Open one, or pass doc=<file.ai>.');
        }
        return { doc: app.activeDocument, opened: false };
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

})(typeof arguments !== 'undefined' && arguments ? arguments : []);
