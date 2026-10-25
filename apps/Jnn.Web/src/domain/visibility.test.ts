import { EMPTY_VISIBILITY, groupVisibility, hide, isolate, isVisible, show, toggleGroup, visibleIds } from './visibility';

describe('visibility rules', () => {
  const all = ['a', 'b', 'c', 'd'];
  it('hides and shows', () => {
    const v = hide(EMPTY_VISIBILITY, ['a']);
    expect(isVisible('a', v)).toBe(false);
    expect(visibleIds(all, v).size).toBe(3);
    expect(isVisible('a', show(v, ['a']))).toBe(true);
  });
  it('isolates', () => {
    const v = isolate(['b', 'c']);
    expect([...visibleIds(all, v)]).toEqual(['b', 'c']);
  });
  it('hidden wins over isolation', () => {
    const v = hide(isolate(['b', 'c']), ['c']);
    expect([...visibleIds(all, v)]).toEqual(['b']);
  });
  it('showing an element outside an isolation adds it', () => {
    const v = show(isolate(['b']), ['d']);
    expect([...visibleIds(all, v)]).toEqual(['b', 'd']);
  });
  it('reports group state and toggles', () => {
    const v = hide(EMPTY_VISIBILITY, ['a']);
    expect(groupVisibility(['a', 'b'], v)).toBe('partial');
    expect(groupVisibility(['b'], v)).toBe('visible');
    expect(groupVisibility(['a'], v)).toBe('hidden');
    expect(groupVisibility(['a', 'b'], toggleGroup(v, ['a', 'b']))).toBe('visible');
    expect(groupVisibility(['b', 'c'], toggleGroup(v, ['b', 'c']))).toBe('hidden');
  });
});
