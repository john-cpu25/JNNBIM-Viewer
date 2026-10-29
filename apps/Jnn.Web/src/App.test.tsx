import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// jsdom has no WebGL: the viewport shows its error state, while explorer and
// properties remain fully functional — exactly the degradation we want.
describe('App (jsdom)', () => {
  beforeEach(() => {
    localStorage.setItem('jnn-locale', 'en');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the shell with explorer and model summary', () => {
    render(<App />);
    expect(screen.getByRole('tree', { name: 'Model tree' })).toBeInTheDocument();
    expect(screen.getByText('Elements by category')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('could not start');
  });

  it('searches, selects from the tree and shows properties', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Search elements'), 'entrance door');
    expect(await screen.findByTestId('search-count')).toHaveTextContent('2 matches');
    const items = screen.getAllByTestId('tree-element');
    expect(items).toHaveLength(2);
    await user.click(items[0]!);
    const props = screen.getByTestId('element-properties');
    expect(within(props).getByTestId('element-name')).toHaveTextContent('Double Glazed Entrance Door');
    expect(within(props).getByText('Pset_DoorCommon')).toBeInTheDocument();
    expect(screen.getByTestId('status-selected')).toHaveTextContent('1');
  });

  it('multi-selects with ctrl-click and aggregates quantities', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Search elements'), 'entrance door');
    const items = await screen.findAllByTestId('tree-element');
    await user.click(items[0]!);
    await user.keyboard('{Control>}');
    await user.click(items[1]!);
    await user.keyboard('{/Control}');
    const multi = screen.getByTestId('multi-properties');
    expect(multi).toHaveTextContent('2 elements');
    expect(multi).toHaveTextContent('9.6'); // 2 × 4.8 m² door area
  });

  it('hides a category from the tree and updates the status bar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('radio', { name: 'Categories' }));
    await user.click(screen.getByRole('button', { name: 'Hide Beams' }));
    expect(screen.getByTestId('status-visible')).toHaveTextContent(String(278 - 93));
    await user.click(screen.getByRole('button', { name: 'Show Beams' }));
    expect(screen.getByTestId('status-visible')).toHaveTextContent('278');
  });

  it('toggles the theme', async () => {
    const user = userEvent.setup();
    render(<App />);
    const before = document.documentElement.dataset.theme;
    await user.click(screen.getByTestId('theme-toggle'));
    expect(document.documentElement.dataset.theme).not.toBe(before);
  });
});
