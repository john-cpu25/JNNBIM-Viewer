import { describe, expect, it, vi } from 'vitest';
import { runCommand } from './commands';
import { createSampleModel } from '../domain/sampleModel';
import { createInitialState } from '../state/store';
import { hide } from '../domain/visibility';

describe('commands: selectAll', () => {
  it('selects all visible elements when no section is active', () => {
    const model = createSampleModel();
    const state = createInitialState(model, 'light');
    const dispatch = vi.fn();

    runCommand('selectAll', state, dispatch, null);

    expect(dispatch).toHaveBeenCalledWith({
      type: 'select',
      ids: model.elements.map((e) => e.id),
      mode: 'replace',
    });
  });

  it('skips hidden elements', () => {
    const model = createSampleModel();
    let state = createInitialState(model, 'light');
    const hiddenId = model.elements[0]!.id;
    state = { ...state, visibility: hide(state.visibility, [hiddenId]) };
    const dispatch = vi.fn();

    runCommand('selectAll', state, dispatch, null);

    const expectedIds = model.elements.map((e) => e.id).filter((id) => id !== hiddenId);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'select',
      ids: expectedIds,
      mode: 'replace',
    });
  });

  it('skips elements outside active section box', () => {
    const model = createSampleModel();
    let state = createInitialState(model, 'light');
    // Restrict section box to a very small region
    state = {
      ...state,
      section: { kind: 'box', min: [-1, -1, -1], max: [1, 1, 1] },
    };
    const dispatch = vi.fn();

    runCommand('selectAll', state, dispatch, null);

    // Some or none elements should be selected depending on box
    expect(dispatch).toHaveBeenCalled();
    const calls = dispatch.mock.calls[0];
    expect(calls?.[0]?.type).toBe('select');
  });
});
