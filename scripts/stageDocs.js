#!/usr/bin/env node
// scripts/stageDocs.js - stage the documentation site's pages for Jekyll.
//
// Used by .github/workflows/pages.yml, and safe to run locally from the
// repository root to check the docs before pushing:
//
//   node scripts/stageDocs.js [out-dir]        (default: _docs_src)
//
// It copies docs/ to out-dir, adds the root pages (QUICKSTART.md, CHEATSHEET.md,
// ROADMAP.md, CHANGELOG.md, whichever exist) and the level design schema, and
// rewrites links so that the ones that work when browsing the repository on
// GitHub also work on the site, where everything sits in one folder:
//
//   in a root page   docs/level-design.md     -> level-design.md
//   in a docs page   ../QUICKSTART.md         -> QUICKSTART.md
//   in any page      a link to a repository file the site does not publish,
//                    such as ../TODO.md       -> its GitHub URL
//
// Links inside code fences are left alone. Every link is then checked against
// the staged files; any that point at nothing are listed, and the script exits
// with status 1, so a broken link fails the build instead of the page.

const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/isocialPractice/street-crime/blob/main/';
const ROOT_PAGES = ['QUICKSTART.md', 'CHEATSHEET.md', 'ROADMAP.md', 'CHANGELOG.md'];
const SCHEMA = 'config/schema/level-design.schema.json';
const STAGED_SCHEMA = 'schema/level-design.schema.json';

const out = process.argv[2] || '_docs_src';
const posix = p => p.split(path.sep).join('/');

// Where a repository path is published in the staged folder, or null when the
// site does not publish it.
function stagedPath(repoPath) {
    if (repoPath.startsWith('docs/')) return repoPath.slice('docs/'.length);
    if (ROOT_PAGES.includes(repoPath) && fs.existsSync(repoPath)) return repoPath;
    if (repoPath === SCHEMA) return STAGED_SCHEMA;
    return null;
}

// rewrite - one page's text, with each link pointed where it belongs on the
// site. repoFile is where the page lives in the repository, stagedFile where it
// lands; problems collects links that cannot be resolved.
function rewrite(text, repoFile, stagedFile, problems) {
    let fenced = false;
    return text.split('\n').map((line, i) => {
        if (/^\s*(```|~~~)/.test(line)) {
            fenced = !fenced;
            return line;
        }
        if (fenced) return line;
        return line.replace(/\]\(([^)\s]+)\)/g, (whole, target) => {
            if (/^([a-z]+:|#)/i.test(target)) return whole;
            const [file, hash] = target.split('#');
            const repoPath = posix(path.normalize(path.join(path.dirname(repoFile), file)));
            const suffix = hash !== undefined ? `#${hash}` : '';
            if (!fs.existsSync(repoPath)) {
                problems.push(`${repoFile}:${i + 1}: ${target} points at nothing`);
                return whole;
            }
            const staged = stagedPath(repoPath);
            if (!staged) return `](${REPO_URL}${repoPath}${suffix})`;
            const relative = posix(path.relative(path.dirname(stagedFile), staged)) || path.basename(staged);
            return `](${relative}${suffix})`;
        });
    }).join('\n');
}

function main() {
    fs.rmSync(out, { recursive: true, force: true });
    fs.cpSync('docs', out, { recursive: true });

    const problems = [];
    const pages = [];
    for (const name of fs.readdirSync('docs').filter(f => f.endsWith('.md'))) {
        pages.push({ repoFile: `docs/${name}`, stagedFile: name });
    }
    for (const name of ROOT_PAGES.filter(f => fs.existsSync(f))) {
        pages.push({ repoFile: name, stagedFile: name });
    }
    for (const { repoFile, stagedFile } of pages) {
        const text = fs.readFileSync(repoFile, 'utf8');
        fs.writeFileSync(path.join(out, stagedFile), rewrite(text, repoFile, stagedFile, problems));
    }

    fs.mkdirSync(path.join(out, path.dirname(STAGED_SCHEMA)), { recursive: true });
    fs.copyFileSync(SCHEMA, path.join(out, STAGED_SCHEMA));

    // Every relative link left must now find a staged file.
    for (const { stagedFile } of pages) {
        const text = fs.readFileSync(path.join(out, stagedFile), 'utf8');
        let fenced = false;
        text.split('\n').forEach((line, i) => {
            if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
            if (fenced) return;
            for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
                const target = match[1];
                if (/^([a-z]+:|#)/i.test(target)) continue;
                const file = target.split('#')[0];
                if (!fs.existsSync(path.join(out, path.dirname(stagedFile), file))) {
                    problems.push(`${stagedFile}:${i + 1} (staged): ${target} is not published`);
                }
            }
        });
    }

    console.log(`staged ${pages.length} pages into ${out}/`);
    if (problems.length) {
        console.error(problems.map(p => `  ${p}`).join('\n'));
        process.exit(1);
    }
}

main();
