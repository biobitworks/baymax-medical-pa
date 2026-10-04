#!/usr/bin/env python3
"""Build a credential-free iPhone Shortcut template; optionally sign with Apple.

Run: python3 scripts/build-apple-health-shortcut.py --sign
Signing sends this generic template (no keys or health data) to Apple validation.
The Health action fields follow exported iOS workflow syntax; HTTP/list/date
fields follow Apple ActionKit metadata. See docs/apple-health-shortcut.md.
"""
import argparse
import plistlib
import subprocess
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACTIONS = []
NAMESPACE = uuid.UUID('be2c87f9-a5e1-4396-bbb0-1685cbe50cc0')


def identifier(label):
    return str(uuid.uuid5(NAMESPACE, label)).upper()


def action(name, label, **parameters):
    uid = identifier(label)
    ACTIONS.append({'WFWorkflowActionIdentifier': 'is.workflow.actions.' + name,
                    'WFWorkflowActionParameters': {'UUID': uid, **parameters}})
    return {'Type': 'ActionOutput', 'OutputUUID': uid, 'OutputName': label}


def attachment(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def text(*parts):
    value = '', {}
    string, slots = value
    for part in parts:
        if isinstance(part, dict):
            slots['{%d, 1}' % len(string)] = part
            string += '\ufffc'
        else:
            string += part
    return {'Value': {'string': string, 'attachmentsByRange': slots}, 'WFSerializationType': 'WFTextTokenString'}


def fields(items):
    return {'Value': {'WFDictionaryFieldValueItems': [
        {'WFItemType': 0, 'WFKey': text(key), 'WFValue': text(value) if isinstance(value, str) else value}
        for key, value in items.items()
    ]}, 'WFSerializationType': 'WFDictionaryFieldValue'}


def format_date(value, label):
    return action('format.date', label, WFDate=text(value), WFDateFormatStyle='Custom',
                  WFDateFormat='Custom', WFDateFormatString="yyyy-MM-dd'T'HH:mm:ssXXXXX")


def build():
    ACTIONS.clear()
    endpoint = action('gettext', 'Sync address', WFTextActionText='http://YOUR-MAC-IP:5173/health/apple/import')
    key = action('gettext', 'Connection key', WFTextActionText='PASTE_CONNECTION_KEY')
    zone = action('gettext', 'Time zone', WFTextActionText='America/Los_Angeles')
    action('comment', 'Instructions', WFCommentActionText=
           'Paste the three setup values from Baymax into the Text actions above. '
           'This reads the last seven days of Steps, Exercise Minutes, Water, and Sleep. '
           'It sends selected samples only to your configured Baymax address, which stores daily summaries. '
           'It never writes to Apple Health. Health actions run on iPhone, not Mac.')
    current = action('date', 'Current date', WFDateActionMode='Current Date')
    exported = format_date(current, 'Export time')
    since = action('adjustdate', 'Seven days ago', WFDate=text(current), WFAdjustOperation='Subtract',
                   WFDuration={'Value': {'Magnitude': '7', 'Unit': 'days'}, 'WFSerializationType': 'WFQuantityFieldValue'})
    empty = action('list', 'Empty samples', WFItems=[])
    action('setvariable', 'Initialize samples', WFVariableName='Sample JSON', WFInput=attachment(empty))
    for kind, picker in [('steps', 'Steps'), ('activeMinutes', 'Exercise Minutes'), ('hydrationMl', 'Water'), ('sleep', 'Sleep')]:
        sample_filter = {'Value': {
            'WFActionParameterFilterPrefix': 1, 'WFContentPredicateBoundedDate': False,
            'WFActionParameterFilterTemplates': [
                {'Property': 'Type', 'Operator': 4, 'Bounded': True, 'Removable': False,
                 'Values': {'Enumeration': {'Value': picker, 'WFSerializationType': 'WFStringSubstitutableState'}}},
                {'Property': 'Start Date', 'Operator': 2, 'Removable': True,
                 'Values': {'Date': attachment(since)}},
            ],
        }, 'WFSerializationType': 'WFContentPredicateTableTemplate'}
        found = action('filter.health.quantity', f'Find {picker}', WFContentItemFilter=sample_filter,
                       WFContentItemLimitEnabled=False)
        group = identifier('Repeat ' + kind)
        action('repeat.each', 'Repeat ' + kind, WFInput=attachment(found),
               GroupingIdentifier=group, WFControlFlowMode=0)
        repeat_item = {'Type': 'Variable', 'VariableName': 'Repeat Item', 'Aggrandizements': [
            {'Type': 'WFCoercionVariableAggrandizement', 'CoercionItemClass': 'WFHealthQuantitySampleContentItem'}]}
        details = {}
        for prop in ['Value', 'Unit', 'Source', 'Start Date', 'End Date']:
            output = action('properties.health.quantity', f'{kind} {prop}',
                            WFContentItemPropertyName=prop, WFInput=attachment(repeat_item))
            if prop in ['Start Date', 'End Date']:
                output = format_date(output, f'{kind} formatted {prop}')
            if prop == 'Value' and kind != 'sleep':
                numbers = action('detect.number', f'{kind} numeric value', WFInput=attachment(output))
                output = action('getitemfromlist', f'{kind} first number', WFItemSpecifier='First Item', WFInput=attachment(numbers))
            details[prop] = text(output)
        sample = action('dictionary', f'{kind} sample', WFItems=fields({
            'type': kind, 'value': details['Value'], 'unit': details['Unit'],
            'source': details['Source'], 'startDate': details['Start Date'], 'endDate': details['End Date'],
        }))
        # Dictionary-to-text conversion JSON-escapes device names and categories.
        encoded = action('detect.text', f'{kind} sample JSON', WFInput=attachment(sample))
        action('appendvariable', f'Collect {kind}', WFVariableName='Sample JSON', WFInput=attachment(encoded))
        action('repeat.each', 'End ' + kind, GroupingIdentifier=group, WFControlFlowMode=2)
    all_samples = action('getvariable', 'All sample JSON',
                         WFVariable=attachment({'Type': 'Variable', 'VariableName': 'Sample JSON'}))
    combined = action('text.combine', 'Combined sample JSON', WFInput=attachment(all_samples), text=attachment(all_samples),
                      WFTextSeparator='Custom', WFTextCustomSeparator=',')
    payload = action('gettext', 'Health export JSON', WFTextActionText=text(
        '{"version":1,"timeZone":"', zone, '","exportedAt":"', exported,
        '","samples":[', combined, ']}'))
    result = action('downloadurl', 'Baymax sync response', WFURL=text(endpoint), WFHTTPMethod='POST',
                    WFHTTPBodyType='File', WFRequestVariable=text(payload), WFHTTPHeaders=fields({
                        'Content-Type': 'application/json', 'Authorization': text('Bearer ', key),
                    }))
    action('showresult', 'Sync result', Text=text(result))
    return {
        'WFWorkflowName': 'Sync with Baymax', 'WFWorkflowClientVersion': '2600.0',
        'WFWorkflowMinimumClientVersion': 900, 'WFWorkflowMinimumClientVersionString': '900',
        'WFWorkflowIcon': {'WFWorkflowIconStartColor': 4274264319, 'WFWorkflowIconGlyphNumber': 61440},
        'WFWorkflowActions': ACTIONS, 'WFWorkflowTypes': [],
        'WFWorkflowInputContentItemClasses': [], 'WFWorkflowOutputContentItemClasses': [],
        'WFWorkflowHasShortcutInputVariables': False,
        'WFWorkflowImportQuestions': [
            {'ActionIndex': 0, 'Category': 'Parameter', 'ParameterKey': 'WFTextActionText',
             'Text': 'Paste the sync address from Baymax (your Mac network address for local use).', 'DefaultValue': ''},
            {'ActionIndex': 1, 'Category': 'Parameter', 'ParameterKey': 'WFTextActionText',
             'Text': 'Paste your private connection key from Baymax.', 'DefaultValue': ''},
            {'ActionIndex': 2, 'Category': 'Parameter', 'ParameterKey': 'WFTextActionText',
             'Text': 'Paste the time zone shown in Baymax.', 'DefaultValue': 'America/Los_Angeles'},
        ],
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sign', action='store_true', help='Submit the generic template to Apple for signing')
    args = parser.parse_args()
    workflow = build()
    source = ROOT / 'shortcuts/Sync-with-Baymax.plist'
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_bytes(plistlib.dumps(workflow, fmt=plistlib.FMT_XML, sort_keys=False))
    print(f'Built {len(ACTIONS)} actions: {source.relative_to(ROOT)}')
    if args.sign:
        output = ROOT / 'public/shortcuts/Sync-with-Baymax.shortcut'
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='baymax-shortcut-') as directory:
            unsigned = Path(directory) / 'Sync-with-Baymax.shortcut'
            unsigned.write_bytes(plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY, sort_keys=False))
            subprocess.run(['shortcuts', 'sign', '--mode', 'anyone', '--input', str(unsigned), '--output', str(output)], check=True)
        print(f'Signed: {output.relative_to(ROOT)}')
