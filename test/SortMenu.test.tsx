import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SortMenu } from '../src/sidepanel/SortMenu';

describe('SortMenu', () => {
  it('opens directly below the current choice and selects another mode', () => {
    const onChange = vi.fn();
    render(<SortMenu value="created-desc" onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: '最新收藏' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: '书签排序' })).toBeVisible();

    fireEvent.click(screen.getByRole('menuitemradio', { name: '标题' }));
    expect(onChange).toHaveBeenCalledWith('title');
    expect(screen.queryByRole('menu', { name: '书签排序' })).not.toBeInTheDocument();
  });
});
