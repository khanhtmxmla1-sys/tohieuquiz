import { describe, expect, it } from 'vitest';
import { SUBJECT_CONFIG, SUBJECT_ORDER } from '../src/features/student-dashboard/model/dashboardConstants';
import {
  buildPracticeCatalog,
  getTopicsForSubject,
  isPracticeSubjectId,
  matchesPracticeSubject,
  normalizePracticeTopic,
} from '../src/features/student-dashboard/model/practiceCatalogModel';

describe('practice subject metadata', () => {
  it('uses canonical subject ids and non-ligature icon keys', () => {
    expect(SUBJECT_ORDER).toEqual([
      'toan',
      'tieng-viet',
      'tu-nhien-xa-hoi',
      'tieng-anh',
      'tin-hoc',
    ]);
    expect(SUBJECT_CONFIG['tu-nhien-xa-hoi'].aliases).toContain('#tn_xh');
    expect(Object.values(SUBJECT_CONFIG).map(subject => subject.icon)).toEqual([
      'calculator',
      'book-open',
      'earth',
      'languages',
      'monitor',
    ]);
    expect(Object.values(SUBJECT_CONFIG).map(subject => subject.icon)).not.toContain('calculate');
  });
});

describe('practice catalog model', () => {
  it('normalizes accents, spaces, hyphens, and repeated underscores', () => {
    expect(normalizePracticeTopic('  #Tự-Nhiên  Xã_Hội  ')).toBe('#tu_nhien_xa_hoi');
  });

  it('maps tn-xh aliases to the canonical tu-nhien-xa-hoi id', () => {
    expect(matchesPracticeSubject('#tn_xh_lop_4', 'tu-nhien-xa-hoi')).toBe(true);
    expect(matchesPracticeSubject('#tn_xh_lop_4', 'tieng-anh')).toBe(false);
  });

  it('sorts matching subject topics by question count then Vietnamese name', () => {
    expect(getTopicsForSubject([
      { name: '#phan_so', count: 10 },
      { name: '#phep_nhan', count: 30 },
      { name: '#english', count: 100 },
    ], 'toan')).toEqual([
      { name: '#phep_nhan', count: 30 },
      { name: '#phan_so', count: 10 },
    ]);
  });

  it('builds available and coming-soon groups from topic data', () => {
    const catalog = buildPracticeCatalog([
      { name: '#phep_nhan', count: 40 },
      { name: '#phan_so', count: 25 },
      { name: '#tieng_viet', count: 12 },
      { name: '#coding', count: 8 },
    ]);

    expect(catalog.availableSubjects.map(subject => subject.id)).toEqual([
      'toan',
      'tieng-viet',
      'tin-hoc',
    ]);
    expect(catalog.comingSoonSubjects.map(subject => subject.id)).toEqual([
      'tu-nhien-xa-hoi',
      'tieng-anh',
    ]);
    expect(catalog.subjects[0]).toMatchObject({
      id: 'toan',
      topicCount: 2,
      questionCount: 65,
      status: 'available',
    });
  });

  it('validates only canonical route ids', () => {
    expect(isPracticeSubjectId('tu-nhien-xa-hoi')).toBe(true);
    expect(isPracticeSubjectId('tn-xh')).toBe(false);
    expect(isPracticeSubjectId('unknown')).toBe(false);
  });
});
