import { describe, expect, it } from 'vitest';
import { validatePreferenceForm } from '../../src/lib/server/preferences/validation';

function validForm(): FormData {
  const form = new FormData();
  form.set('weatherEnabled', 'on');
  form.set('newsEnabled', 'on');
  form.set('localityName', 'Carlton');
  form.set('localityRegion', 'Victoria');
  form.set('timezone', 'Australia/Sydney');
  form.set('deliveryLocalTime', '07:00');
  form.set('digestLength', 'concise');
  form.set('sourceMode', 'all');
  return form;
}

describe('digest preference form validation', () => {
  it('allows both sections to be disabled without location or source selections', () => {
    const form = new FormData();
    form.set('deliveryLocalTime', '07:00');
    form.set('timezone', 'Australia/Sydney');
    form.set('digestLength', 'concise');
    form.set('sourceMode', 'selected');
    const result = validatePreferenceForm(form);
    expect(result.errors).toStrictEqual([]);
    expect(result.values).toMatchObject({ weatherEnabled: false, newsEnabled: false });
  });

  it('does not require a location or selected source when the corresponding module is disabled', () => {
    const form = validForm();
    form.delete('localityName');
    form.delete('weatherEnabled');
    form.delete('newsEnabled');
    form.set('sourceMode', 'selected');

    expect(validatePreferenceForm(form).errors).not.toContain(
      'Enter a locality name or postcode between 2 and 80 characters.',
    );
    expect(validatePreferenceForm(form).errors).not.toContain(
      'Select at least one news source, or choose all available sources.',
    );
  });

  it('accepts valid preferences with no optional source/topic selections', () => {
    const result = validatePreferenceForm(validForm());
    expect(result.errors).toStrictEqual([]);
    expect(result.values).toMatchObject({
      localityName: 'Carlton',
      localityRegion: 'Victoria',
      timezone: 'Australia/Sydney',
      deliveryLocalTime: '07:00',
      digestLength: 'concise',
      sourceMode: 'all',
      selectedSourceIds: [],
      topics: [],
    });
  });

  it('accepts only registered source/topic IDs and normalizes custom phrases', () => {
    const form = validForm();
    form.set('sourceMode', 'selected');
    form.append('sourceIds', 'abc-top-stories');
    form.append('curatedTopics', 'sport');
    form.set('customTopics', '  local council,   climate policy  ');
    form.set('excludedTopics', 'celebrity gossip');

    const result = validatePreferenceForm(form);
    expect(result.errors).toStrictEqual([]);
    expect(result.values?.selectedSourceIds).toStrictEqual(['abc-top-stories']);
    expect(result.values?.topics).toStrictEqual([
      { kind: 'curated', value: 'sport' },
      { kind: 'custom', value: 'local council' },
      { kind: 'custom', value: 'climate policy' },
      { kind: 'exclude', value: 'celebrity gossip' },
    ]);
  });

  it('requires at least one source when source mode is selected', () => {
    const form = validForm();
    form.set('sourceMode', 'selected');
    expect(validatePreferenceForm(form).errors).toContain(
      'Select at least one news source, or choose all available sources.',
    );
  });

  it('rejects unknown values, invalid timezones and malformed local times', () => {
    const form = validForm();
    form.set('sourceMode', 'anything');
    form.set('timezone', 'Mars/Olympus');
    form.append('sourceIds', 'https://attacker.example/feed.xml');
    form.append('curatedTopics', 'arbitrary-topic');
    form.set('deliveryLocalTime', '25:99');
    const errors = validatePreferenceForm(form).errors;
    expect(errors).toContain('Choose a valid timezone.');
    expect(errors).toContain('Choose a valid delivery time.');
    expect(errors).toContain('Choose whether to use all sources or selected sources.');
    expect(errors).toContain('One or more selected news sources are not available.');
    expect(errors).toContain('One or more selected topics are not available.');
  });

  it('limits custom and excluded phrases and rejects duplicate normalized phrases', () => {
    const tooMany = validForm();
    tooMany.set('customTopics', Array.from({ length: 11 }, (_, i) => `topic ${i}`).join(','));
    expect(validatePreferenceForm(tooMany).errors).toContain(
      'Use no more than 10 custom or excluded phrases combined.',
    );

    const duplicates = validForm();
    duplicates.set('customTopics', 'climate, CLIMATE');
    expect(validatePreferenceForm(duplicates).errors).toContain(
      'Remove duplicate custom or excluded phrases.',
    );
  });
});
