import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRatingInput } from '../src/components/StarRatingInput';

describe('StarRatingInput', () => {
  it('5つの星ボタンが描画される', () => {
    render(<StarRatingInput value={0} onChange={() => {}} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(5);
  });

  it('星をクリックすると onChange が値で呼ばれる', () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={0} onChange={onChange} />);
    const buttons = screen.getAllByRole('radio');
    fireEvent.click(buttons[2]); // 3つ目
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('disabled 時は onChange が呼ばれない', () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={3} onChange={onChange} disabled />);
    const buttons = screen.getAllByRole('radio');
    fireEvent.click(buttons[4]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
