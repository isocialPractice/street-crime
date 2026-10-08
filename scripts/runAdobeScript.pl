#!/usr/bin/env perl
# runAdobeScript.pl - run an ExtendScript (.jsx) in Adobe Illustrator from the
# command line, on Windows or macOS, with arguments passed through to it.
#
# A port of runAdobeScript.bat. The batch file went through the ExtendScript
# Toolkit, which is Windows only, no longer shipped, and drops every argument
# on the way in. This talks to Illustrator directly instead: COM
# (DoJavaScriptFile) through PowerShell on Windows, AppleScript
# (do javascript ... with arguments) through osascript on macOS. Either way the
# script receives the arguments as its `arguments` array, the call waits for it
# to finish, and whatever the script returns is printed.
#
# Usage:
#   perl scripts/runAdobeScript.pl [options] <script.jsx> [arg ...]
#
# Options (before the script):
#   -n, --dry-run   Print the command instead of running it.
#   -h, --help      Show this help.
#
# Arguments after the script are passed through in order. One that names an
# existing file or folder, or a key=value whose value does, is made absolute
# first, because Illustrator does not share this shell's working directory.
#
# Examples:
#   perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai dry=1
#   perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai save=1
#
# Exit status: 0 on success, 1 when the script or Illustrator reports an error,
# 2 for a usage error.

use strict;
use warnings;

use Encode ();
use File::Basename ();
use File::Spec;
use MIME::Base64 ();

# Applications a script can target. The target comes from the script's own
# `#target` / `//@target` directive, and Illustrator is assumed without one.
my %APPS = (
    illustrator => {
        name      => 'Adobe Illustrator',
        com       => 'Illustrator.Application',
        bundle_id => 'com.adobe.illustrator',
    },
);

exit main(@ARGV);

sub main {
    my @argv = @_;
    my $dry_run = 0;

    while (@argv && $argv[0] =~ /^-/) {
        my $opt = shift @argv;
        if ($opt eq '-n' || $opt eq '--dry-run') {
            $dry_run = 1;
        } elsif ($opt eq '-h' || $opt eq '--help' || $opt eq '/?') {
            print usage();
            return 0;
        } elsif ($opt eq '--') {
            last;
        } else {
            return usage_error("unknown option $opt");
        }
    }

    my $script = shift @argv;
    return usage_error('no script given') unless defined $script;
    return usage_error("script not found: $script") unless -f $script;

    my $target = script_target($script);
    my $app = $APPS{$target};
    unless ($app) {
        print STDERR "runAdobeScript: $script targets \"$target\", and only "
            . join(', ', sort keys %APPS) . " is wired up here.\n";
        return 2;
    }

    my $script_path = native_path($script);
    my @args = map { pass_through($_) } @argv;

    return run_windows($app, $script_path, \@args, $dry_run) if is_windows();
    return run_macos($app, $script_path, \@args, $dry_run) if $^O eq 'darwin';

    print STDERR "runAdobeScript: $app->{name} can only be scripted on Windows or macOS (this is $^O).\n";
    return 1;
}

# ── Launchers ────────────────────────────────────────────────────────────────

sub run_windows {
    my ($app, $script, $args, $dry_run) = @_;

    my $shell = find_powershell();
    unless ($shell) {
        print STDERR "runAdobeScript: PowerShell was not found on PATH.\n";
        return 1;
    }

    # The script text is decoded to characters so names outside ASCII survive
    # the trip through PowerShell's UTF-16 command line.
    my $call = sprintf('$app.DoJavaScriptFile(%s', ps_quote(to_chars($script)));
    $call .= sprintf(', [object[]]@(%s)', join(', ', map { ps_quote(to_chars($_)) } @$args)) if @$args;
    $call .= ')';

    my $ps = join("\n",
        q{$ErrorActionPreference = 'Stop'},
        q{$ProgressPreference = 'SilentlyContinue'},
        q{[Console]::OutputEncoding = [System.Text.Encoding]::UTF8},
        q[try {],
        sprintf(q{    $app = New-Object -ComObject %s}, ps_quote($app->{com})),
        qq{    \$result = $call},
        q{    if ($null -ne $result -and "$result" -ne '') { [Console]::Out.WriteLine([string]$result) }},
        q[} catch {],
        q{    [Console]::Error.WriteLine($_.Exception.Message)},
        q{    exit 1},
        q[}],
        q{exit 0},
    );

    my @cmd = ($shell, '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand');
    if ($dry_run) {
        binmode STDOUT, ':encoding(UTF-8)';
        print join(' ', @cmd), " <the following, UTF-16LE base64>\n\n$ps\n";
        return 0;
    }

    # An encoded command sidesteps every quoting rule between here and COM.
    my $encoded = MIME::Base64::encode_base64(Encode::encode('UTF-16LE', $ps), '');
    system(@cmd, $encoded);
    return exit_status($?, $shell);
}

sub run_macos {
    my ($app, $script, $args, $dry_run) = @_;

    my @cmd = (
        'osascript',
        '-e', 'on run argv',
        '-e', 'set scriptFile to (POSIX file (item 1 of argv)) as alias',
        '-e', 'set scriptArgs to rest of argv',
        '-e', qq{tell application id "$app->{bundle_id}"},
        '-e', 'return do javascript scriptFile with arguments scriptArgs',
        '-e', 'end tell',
        '-e', 'end run',
        $script, @$args,
    );

    if ($dry_run) {
        print join(' ', map { shell_quote($_) } @cmd), "\n";
        return 0;
    }
    system(@cmd);
    return exit_status($?, 'osascript');
}

# ── Paths and arguments ──────────────────────────────────────────────────────

sub is_windows {
    return $^O eq 'MSWin32' || $^O eq 'msys' || $^O eq 'cygwin';
}

# Reads the application a script names in its first few lines, for example
# `#target illustrator`, `//@target illustrator` or `//@target-illustrator`.
sub script_target {
    my ($script) = @_;
    open(my $fh, '<', $script) or return 'illustrator';
    my $target = 'illustrator';
    while (my $line = <$fh>) {
        last if $. > 10;
        if ($line =~ m{^\s*(?:\#|//\@)target[\s-]+["']?([A-Za-z]+)}) {
            $target = lc $1;
            last;
        }
    }
    close $fh;
    return $target;
}

sub pass_through {
    my ($arg) = @_;
    if ($arg =~ /^([A-Za-z][\w-]*)=(.+)\z/s && looks_like_path($2)) {
        return "$1=" . native_path($2);
    }
    return looks_like_path($arg) ? native_path($arg) : $arg;
}

sub looks_like_path {
    my ($value) = @_;
    return 1 if -e $value;
    return $value =~ m{[\\/]} && -d File::Basename::dirname($value);
}

# An absolute path in the form the host application expects: C:\... on
# Windows (including under Git Bash or Cygwin perl, which see /c/...), POSIX
# everywhere else.
sub native_path {
    my ($path) = @_;
    return File::Spec->rel2abs($path) unless is_windows();

    if ($path =~ m{^[A-Za-z]:[\\/]}) {
        (my $drive_path = $path) =~ s{/}{\\}g;
        return $drive_path;
    }
    my $abs = File::Spec->rel2abs($path);
    if ($^O ne 'MSWin32') {
        my $converted = cygpath($abs);
        return $converted if defined $converted;
        $abs =~ s{^/(?:cygdrive/)?([A-Za-z])(?=/|\z)}{uc($1) . ':'}e;
    }
    $abs =~ s{/}{\\}g;
    return $abs;
}

sub cygpath {
    my ($path) = @_;
    no warnings 'exec';
    open(my $fh, '-|', 'cygpath', '-w', $path) or return undef;
    my $out = <$fh>;
    close $fh or return undef;
    return undef unless defined $out && $out ne '';
    $out =~ s/\r?\n\z//;
    return $out;
}

# Command-line bytes as characters: UTF-8 when they decode as it (Git Bash,
# macOS), otherwise the Windows ANSI code page.
sub to_chars {
    my ($bytes) = @_;
    my $copy = $bytes;
    my $chars = eval { Encode::decode('UTF-8', $copy, Encode::FB_CROAK) };
    return defined $chars ? $chars : Encode::decode('cp1252', $bytes);
}

# PowerShell single-quoted string. Curly single quotes close one too, so they
# are doubled along with the straight ones.
sub ps_quote {
    my ($text) = @_;
    $text =~ s/(['\x{2018}\x{2019}\x{201A}\x{201B}])/$1$1/g;
    return "'$text'";
}

sub shell_quote {
    my ($text) = @_;
    return $text if $text =~ m{^[\w./:=-]+\z};
    $text =~ s/'/'\\''/g;
    return "'$text'";
}

sub find_powershell {
    for my $name (qw(powershell.exe powershell pwsh.exe pwsh)) {
        for my $dir (File::Spec->path()) {
            my $candidate = File::Spec->catfile($dir, $name);
            return $candidate if -f $candidate;
        }
    }
    my $root = $ENV{SystemRoot} || $ENV{SYSTEMROOT} || 'C:\\Windows';
    my $fallback = "$root\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
    return -f $fallback ? $fallback : undef;
}

sub exit_status {
    my ($status, $program) = @_;
    if ($status == -1) {
        print STDERR "runAdobeScript: could not start $program: $!\n";
        return 1;
    }
    return 1 if $status & 127;
    return $status >> 8;
}

# ── Help ─────────────────────────────────────────────────────────────────────

sub usage_error {
    my ($message) = @_;
    print STDERR "runAdobeScript: $message\n\n", usage();
    return 2;
}

sub usage {
    return <<'USAGE';
Usage: perl scripts/runAdobeScript.pl [options] <script.jsx> [arg ...]

Runs an ExtendScript file in Adobe Illustrator (COM on Windows, AppleScript on
macOS), passes the remaining arguments to it as its `arguments` array, waits
for it to finish and prints what it returns.

Options:
  -n, --dry-run   Print the command instead of running it.
  -h, --help      Show this help.

Arguments naming an existing file or folder, alone or as key=value, are made
absolute first, since Illustrator does not share this shell's working folder.

Examples:
  perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai dry=1
  perl scripts/runAdobeScript.pl scripts/mapLayers.jsx doc=support/source-player.ai save=1
USAGE
}
