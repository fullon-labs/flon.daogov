#!/usr/bin/env python3
"""Render operator-local deployment settings without sourcing shell code."""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile

ROOT = Path(__file__).resolve().parent
VARIABLE = re.compile(r'\$\{(DEPLOY_[A-Z0-9_]+)\}')


def read_settings(filename):
    values = {}
    for number, line in enumerate(filename.read_text().splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, raw = line.partition('=')
        key, raw = key.strip(), raw.strip()
        if not separator or not re.fullmatch(r'DEPLOY_[A-Z0-9_]+', key):
            raise ValueError(f'Invalid setting at line {number}')
        if key in values:
            raise ValueError(f'Duplicate setting: {key}')
        try:
            value = json.loads(raw) if raw.startswith('"') else raw[1:-1] if raw.startswith("'") and raw.endswith("'") else raw
        except ValueError:
            raise ValueError(f'Invalid quoted setting at line {number}') from None
        if not isinstance(value, str) or not value or '\n' in value or '\r' in value:
            raise ValueError(f'Invalid value for {key}')
        values[key] = value
    return values


def render(settings):
    rendered = {}
    for group in ['app', 'gateway']:
        for template in sorted((ROOT / group).glob('*.template')):
            text = template.read_text()
            missing = sorted(set(VARIABLE.findall(text)) - settings.keys())
            if missing:
                raise ValueError('Missing deployment settings: ' + ', '.join(missing))
            rendered[Path(group) / template.name.removesuffix('.template')] = VARIABLE.sub(lambda m: settings[m[1]], text)
    return rendered


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, default=ROOT / '.env')
    parser.add_argument('--check', action='store_true', help='Validate without writing rendered files')
    args = parser.parse_args()
    try:
        rendered = render(read_settings(args.env_file))
    except (ValueError, OSError) as error:
        # Do not echo environment contents or resolved infrastructure values.
        parser.exit(1, f'Deployment configuration failed: {error.__class__.__name__}' +
                    (f': {error}' if isinstance(error, ValueError) else '') + '\n')
    if args.check:
        print(f'Validated {len(rendered)} deployment templates; no files written.')
        return
    output = ROOT / '.local' / 'rendered'
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    for relative, text in rendered.items():
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with tempfile.NamedTemporaryFile('w', dir=target.parent, delete=False) as temp:
            os.fchmod(temp.fileno(), 0o600)
            temp.write(text)
            temporary = Path(temp.name)
        temporary.replace(target)
    print(f'Rendered {len(rendered)} templates into ignored deploy/.local/rendered/.')


if __name__ == '__main__':
    main()
