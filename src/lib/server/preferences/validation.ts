import {
  isCuratedTopicId,
  isNewsSourceId,
  isValidTimeZone,
  MAX_CUSTOM_PHRASES,
  MAX_PHRASE_LENGTH,
  normalizePhrase,
} from './catalogue';
import type { DigestLength, SourceMode, TopicKind } from '../repository/preferences';

export interface PreferenceFormValues {
  weatherEnabled: boolean;
  newsEnabled: boolean;
  localityName: string;
  localityRegion: string;
  timezone: string;
  deliveryLocalTime: string;
  digestLength: DigestLength;
  sourceMode: SourceMode;
  selectedSourceIds: string[];
  topics: Array<{ kind: TopicKind; value: string }>;
}

export interface ValidationResult {
  values: PreferenceFormValues | null;
  errors: string[];
  input: PreferenceFormInput;
}

export interface PreferenceFormInput {
  weatherEnabled: boolean;
  newsEnabled: boolean;
  localityName: string;
  localityRegion: string;
  timezone: string;
  deliveryLocalTime: string;
  digestLength: string;
  sourceMode: string;
  selectedSourceIds: string[];
  curatedTopicIds: string[];
  customTopics: string;
  excludedTopics: string;
}

/** Read only scalar text fields; ignore non-string form entries such as uploaded files. */
function readString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** Accept comma- or line-separated user phrases and normalise them before validating. */
function readPhrases(form: FormData, name: string): string[] {
  return readString(form, name).split(/[\n,]/u).map(normalizePhrase).filter(Boolean);
}

/** Validate submitted preferences and retain safe display values when returning form errors. */
export function validatePreferenceForm(form: FormData): ValidationResult {
  const errors: string[] = [];
  const weatherEnabled = form.get('weatherEnabled') === 'on';
  const newsEnabled = form.get('newsEnabled') === 'on';
  const localityName = readString(form, 'localityName');
  const localityRegion = readString(form, 'localityRegion');
  const timezone = readString(form, 'timezone') || 'Australia/Sydney';
  const deliveryLocalTime = readString(form, 'deliveryLocalTime');
  const digestLengthValue = readString(form, 'digestLength');
  const sourceModeValue = newsEnabled ? readString(form, 'sourceMode') : 'all';

  if (weatherEnabled && (localityName.length < 2 || localityName.length > 80)) {
    errors.push('Enter a locality name or postcode between 2 and 80 characters.');
  }
  if (localityRegion.length > 80) errors.push('Region must be 80 characters or fewer.');
  if (!isValidTimeZone(timezone)) errors.push('Choose a valid timezone.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(deliveryLocalTime)) {
    errors.push('Choose a valid delivery time.');
  }

  const digestLength: DigestLength = digestLengthValue === 'standard' ? 'standard' : 'concise';
  if (!['concise', 'standard'].includes(digestLengthValue)) {
    errors.push('Choose concise or standard digest length.');
  }

  const sourceMode: SourceMode = sourceModeValue === 'selected' ? 'selected' : 'all';
  if (newsEnabled && !['all', 'selected'].includes(sourceModeValue)) {
    errors.push('Choose whether to use all sources or selected sources.');
  }
  const selectedSourceIds = form
    .getAll('sourceIds')
    .filter((value): value is string => typeof value === 'string');
  if (newsEnabled && selectedSourceIds.some((sourceId) => !isNewsSourceId(sourceId))) {
    errors.push('One or more selected news sources are not available.');
  }
  if (newsEnabled && sourceMode === 'selected' && selectedSourceIds.length === 0) {
    errors.push('Select at least one news source, or choose all available sources.');
  }
  if (newsEnabled && new Set(selectedSourceIds).size !== selectedSourceIds.length) {
    errors.push('A news source was selected more than once.');
  }

  const curatedTopicIds = form
    .getAll('curatedTopics')
    .filter((value): value is string => typeof value === 'string');
  if (curatedTopicIds.some((topicId) => !isCuratedTopicId(topicId))) {
    errors.push('One or more selected topics are not available.');
  }
  if (new Set(curatedTopicIds).size !== curatedTopicIds.length) {
    errors.push('A topic was selected more than once.');
  }

  const includes = readPhrases(form, 'customTopics');
  const excludes = readPhrases(form, 'excludedTopics');
  const phrases = [
    ...includes.map((value) => ({ kind: 'custom' as const, value })),
    ...excludes.map((value) => ({ kind: 'exclude' as const, value })),
  ];
  if (phrases.length > MAX_CUSTOM_PHRASES) {
    errors.push(`Use no more than ${MAX_CUSTOM_PHRASES} custom or excluded phrases combined.`);
  }
  if (phrases.some(({ value }) => value.length > MAX_PHRASE_LENGTH)) {
    errors.push(`Each custom or excluded phrase must be ${MAX_PHRASE_LENGTH} characters or fewer.`);
  }
  if (new Set(phrases.map(({ kind, value }) => `${kind}:${value}`)).size !== phrases.length) {
    errors.push('Remove duplicate custom or excluded phrases.');
  }

  // Keep submitted module settings available for redisplay after a validation failure.
  const input = {
    weatherEnabled,
    newsEnabled,
    localityName: weatherEnabled ? localityName : readString(form, 'localityName'),
    localityRegion: weatherEnabled ? localityRegion : readString(form, 'localityRegion'),
    timezone,
    deliveryLocalTime,
    digestLength: digestLengthValue,
    sourceMode: sourceModeValue,
    selectedSourceIds,
    curatedTopicIds,
    customTopics: readString(form, 'customTopics'),
    excludedTopics: readString(form, 'excludedTopics'),
  };

  if (errors.length > 0) return { values: null, errors, input };

  const topics = [
    ...curatedTopicIds.map((value) => ({ kind: 'curated' as const, value })),
    ...phrases,
  ];

  return {
    values: {
      weatherEnabled,
      newsEnabled,
      localityName: input.localityName,
      localityRegion: input.localityRegion,
      timezone,
      deliveryLocalTime,
      digestLength,
      sourceMode,
      selectedSourceIds: [...new Set(selectedSourceIds)],
      topics,
    },
    errors: [],
    input,
  };
}
