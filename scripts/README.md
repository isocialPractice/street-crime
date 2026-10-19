# scripts

Command-line tooling for the Illustrator source artwork behind `assets/`.

Illustrator writes every layer, group and path name out as the `id` of the
matching SVG element. Unnamed items get no id at all. Before the game can
recolor a glove or swap an outfit piece, those parts need names in the source
`.ai` file, and these scripts handle that naming in bulk.

| File | What it does |
|---|---|
| `runAdobeScript.pl` | Runs any `.jsx` in Illustrator from a terminal, passing arguments to it and printing what it returns. |
| `mapLayers.jsx` | Renames layers, groups and paths from a JSON layer map. |
| `mapSelectLayers.jsx` | Selects the items a layer map renames, in a document that is already open, without renaming anything. |
| `renameSelectedLayers.jsx` | Renames whatever is selected in Illustrator from one naming pattern (`walk_##`, `*_ii`). Interactive: run it from **File > Scripts**. |
| `lib/layerMap.jsxinc` | Matching engine shared by both map scripts, pulled in with `//@include`. |
| `data/layerMap.json` | The layer map both scripts read by default. |

## Source files: `support/`

Keep Illustrator source files in `support/` (`support/source-player.ai`,
`support/source-enemies.ai`, and later `source-objects.ai`,
`source-environment.ai`). The folder is in `.gitignore`, because source files
for detailed game art grow quickly and do not belong in history.

The two files committed there are examples to try the scripts on, added with
`git add -f`. Because git already tracks them, the ignore rule does not cover
them: any edit to them shows up in `git status`. Point the scripts at your own
working copies when you mean to change real artwork, and leave the examples
alone unless you mean to commit a new example.

## runAdobeScript.pl

```sh
perl scripts/runAdobeScript.pl [options] <script.jsx> [arg ...]
```

| Option | |
|---|---|
| `-n`, `--dry-run` | Print the command instead of running it. |
| `-h`, `--help` | Show usage. |

- **Windows** runs the script through Illustrator's COM interface
  (`DoJavaScriptFile`) from PowerShell. This works from Git Bash, Cygwin or
  Strawberry Perl.
- **macOS** runs it through `osascript` (`do javascript ... with arguments`).
  This path has not been tested yet.
- Arguments after the script reach it as its `arguments` array. An argument
  that names an existing file or folder, alone or as `key=value`, is turned
  into an absolute path first, because Illustrator does not share the shell's
  working folder.
- Illustrator is started if it is not already running. The call waits for the
  script to finish, prints whatever the script returns, and exits with `1` if
  the script throws.
- While the script runs, `$.runAdobeScript` is `true` in Illustrator's script
  engine, and it is cleared afterwards. Scripts read it to tell a terminal run
  from a **File > Scripts** run, which otherwise look the same when no
  arguments are passed, so they can skip dialogs nobody is there to answer.
- The script's `#target` / `//@target` line is read. Illustrator is the only
  application wired up so far; others can be added to `%APPS`.

This replaces `runAdobeScript.bat`, which went through the ExtendScript
Toolkit. That tool is Windows only, no longer shipped, and does not pass
arguments through.

## mapLayers.jsx

```sh
# Preview what would change
perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai dry=1

# Rename and save
perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai save=1

# Undo that run
perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai reverse=1 save=1
```

| Option | Default | |
|---|---|---|
| `map=<file.json>` | `scripts/data/layerMap.json` | Layer map to apply. A bare `*.json` argument works too. |
| `doc=<file.ai>` | active document | Document to map. It is opened if it is not open already. A bare `*.ai` argument works too. |
| `dry=1` | off | Report only. |
| `save=1` | off | Save after renaming. Without it, a document with renames is left open and unsaved. |
| `reverse=1` | off | Swap `current` and `change`, which undoes an earlier run. |
| `exact=1` | off | Skip any container whose child count differs from its list length, instead of mapping only the first children. |
| `log=<file>` | none | Also write the report to a file. |

From **File > Scripts > Other Script...**, it maps the active document with
the default map and shows a summary alert.

### Layer map format

```json
{
  "current": { "Player_Walk": { "front-glove": { "strokes": { "layers": [ "<Path>", "<Path>" ] } } } },
  "change":  { "Player_Walk": { "front-glove": { "strokes": { "layers": [ "thumb", "outline" ] } } } }
}
```

- `current` and `change` are two copies of the same tree. The keys must match,
  and only the `layers` lists differ. The script refuses to run if the two
  trees do not line up.
- **Keys** name the item to step into. A key matches at **any depth** below the
  previous match, so `Player_Walk > front-glove` reaches
  `Player_Walk > walk_0 > front-arm-assembly > front-glove` and the same glove in
  every other frame, without listing the frames. Start a key with `>` (for
  example `"> strokes"`) to match direct children only. That matters where a
  name repeats at several depths, as `strokes` does under `Head` and under
  `Head > hair`.
- **`layers`** lists the direct children of the matched item, top to bottom as
  the Layers panel shows them. Inside a layer, sublayers count before artwork.
  - The list can stop short. `[ "<Path>" ]` against a group with two paths
    renames only the first path, the top one in the Layers panel, and leaves
    the second alone. To rename a later child on its own, hold the earlier
    places with `*` in `current` and `null` in `change`, for example
    `[ "*", "<Path>" ]` and `[ null, "outline" ]`.
  - A container is renamed only if every listed child matches its `current`
    entry. A container that does not match, or has fewer children than the
    list, is skipped and reported, so a frame drawn differently is not
    renamed by position.
  - `exact=1` also skips a container with more children than its list. This
    is the safer choice when frames may have extra paths at the top.

| Entry | In `current` | In `change` |
|---|---|---|
| `name` | Exact name | New name |
| `<Path>`, `<Group>`, `<Compound Path>`, `<Clip Group>`, `<Clipping Path>`, `<Image>`, `<Linked File>`, `<Mesh>`, `<Text>`, `<Symbol>`, `<Rectangle>`, `<Ellipse>`, ... | Unnamed item of that kind | Clear the name |
| `*` or `null` | Any item | Leave as is |

The report lists every container as `renamed` (or `rename` in a dry run),
`mapped` (already renamed), `skipped` (children do not fit the list) or
`missing` (nothing matched a key), followed by a one-line summary.

## mapSelectLayers.jsx

Selects what a layer map points at, so you can see in Illustrator which paths
`mapLayers.jsx` is about to rename, or has renamed, before you commit to it. It
reads the same map with the same matching rules and renames nothing.

```sh
# Select in the active document
perl scripts/runAdobeScript.pl scripts/mapSelectLayers.jsx

# Select in a particular open document, with another map
perl scripts/runAdobeScript.pl scripts/mapSelectLayers.jsx doc=support/source-player.ai map=scripts/data/layerMap.json
```

| Option | Default | |
|---|---|---|
| `map=<file.json>` | `scripts/data/layerMap.json` | Layer map to read. |
| `doc=<file.ai>` | active document | Open document to select in. It is brought to the front. |
| `exact=1` | off | As in `mapLayers.jsx`. |

- **What is selected:** every child a `layers` list gives a name to, in each
  container that fits either `current` (not renamed yet) or `change` (already
  renamed). Each line of the report says which: `renames to thumb` or
  `already mapped`. Entries left as `*` or `null` in `change` are placeholders
  and stay unselected. Any earlier selection is cleared first.
- **Layers:** a layer cannot be selected itself, so a layer named in a list
  has its artwork selected instead.
- **From the command line**, it works only on a document that is already
  open, and never opens one. With no document open, or with `doc=` naming a
  file that is not open, it prints a one-line error such as
  `mapSelectLayers: no document is open in Illustrator. ...` and changes
  nothing. Every failure comes back the same way, as a single line on stdout,
  with exit status `0`.
- **From File > Scripts**, it selects in the active document. It shows an
  alert only when nothing could be selected or part of the map did not fit;
  a clean selection needs no alert.
- Locked or hidden items, or items under a locked or hidden layer, cannot be
  selected and are reported as `failed`.

### SVG ids after export

When names repeat across a file, Illustrator's SVG export adds `-2`, `-3` and
so on to keep ids unique. The `strokes` group under `front-glove` in
`Player_Walk_0.svg` comes out as `id="strokes-12"`, for example. Anything that
looks parts up in exported SVGs should match on the ancestor path plus the
base name with the `-N` suffix stripped, not on the raw id.

## renameSelectedLayers.jsx

Renames every item selected in Illustrator from one naming pattern. Use it to
rename a handful of items by hand; for the same parts across many frames, use
`mapLayers.jsx` and a map.

Select the art to rename, then run the script from **File > Scripts > Other
Script...**. It asks for the pattern. With nothing selected it renames the
active layer instead, because a script can read which art is selected but not
which rows are highlighted in the Layers panel.

| Token | |
|---|---|
| `#` | Sequence number. A run of `#` sets the zero padding: `##` gives `01`, `02`, ... |
| `*` | The item's current name, or its type (`Path`, `Group`, ...) when it has none. |
| `,N` at the end | Start numbering at `N` instead of 1. |

| Pattern, three items selected | Result |
|---|---|
| `walk_##` | `walk_01`, `walk_02`, `walk_03` |
| `walk_##,5` | `walk_05`, `walk_06`, `walk_07` |
| `*_ii` | Appends `_ii` to each current name |
| `hitbox` | Every item is named `hitbox` |

- Items are numbered in selection order, which Illustrator reports top to
  bottom as the Layers panel shows them.
- It is interactive. The pattern comes from the prompt, or from
  `$.arguments` when another script calls it (`$.arguments = "walk_##,1";`
  then `$.evalFile(...)`). It does not read the arguments
  `runAdobeScript.pl` passes, so a terminal run still opens the prompt in
  Illustrator, and the terminal waits until you answer it.
- Items that cannot be renamed are listed in an alert at the end. The rest are
  still renamed.
