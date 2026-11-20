import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExerciseSolver } from './ExerciseSolver';
import { DataProvider, useData } from '@/state/DataProvider';
import { getExercise } from '@/lib/exercises/bank';
import type { Repository } from '@/lib/storage/repository';
import { EMPTY_DATA, type AppData } from '@/lib/storage/types';

class MemoryRepo implements Repository {
  readonly kind = 'local' as const;
  data: AppData = structuredClone(EMPTY_DATA);
  async load() { return this.data; }
  async save(d: AppData) { this.data = d; }
  async clear() { this.data = structuredClone(EMPTY_DATA); }
}


function AttemptsCount() {
  const { data } = useData();
  return <span data-testid="attempts">{data.attempts.length}</span>;
}

function setup(id: string) {
  const repo = new MemoryRepo();
  const ex = getExercise(id)!;
  render(
    <MemoryRouter>
      <DataProvider repository={repo}>
        <ExerciseSolver exercise={ex} context="free" />
        <AttemptsCount />
      </DataProvider>
    </MemoryRouter>,
  );
  return { repo, ex };
}

const square = (sq: string) => document.querySelector(`[data-square="${sq}"]`) as HTMLElement;

describe('ExerciseSolver', () => {
  it('shows the objective and keeps the solution locked before any attempt', async () => {
    setup('tac-mate-001');
    expect(await screen.findByText(/Fes mat en 1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mostra la solució/ })).toBeDisabled();
  });

  it('reveals progressive hints one at a time', async () => {
    const { ex } = setup('tac-mate-001');
    const btn = await screen.findByRole('button', { name: /Vull una pista/ });
    fireEvent.click(btn);
    expect(screen.getByText(ex.hints[0])).toBeInTheDocument();
    expect(screen.queryByText(ex.hints[1])).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /més concreta/ }));
    expect(screen.getByText(ex.hints[1])).toBeInTheDocument();
  });

  it('solves by clicking squares, asks for reasoning, then records the attempt', async () => {
    setup('tac-mate-001');
    await screen.findByText(/Fes mat en 1/);
    await act(async () => fireEvent.click(square('e1')));
    await act(async () => fireEvent.click(square('e8')));
    expect(await screen.findByText(/escac i mat/)).toBeInTheDocument();
    // reasoning is requested BEFORE the explanation
    expect(screen.getByLabelText('El teu raonament')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('El teu raonament'), { target: { value: 'El rei no té caselles' } });
    fireEvent.click(screen.getByRole('button', { name: /Mostra l'explicació/ }));
    expect(screen.getByText(/Explicació/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Següent' }));
    await waitFor(() => expect(screen.getByTestId('attempts')).toHaveTextContent('1'));
  });

  it('a wrong move unlocks the solution button and is counted', async () => {
    setup('tac-mate-001');
    await screen.findByText(/Fes mat en 1/);
    await act(async () => fireEvent.click(square('e1')));
    await act(async () => fireEvent.click(square('e7')));
    expect(await screen.findByText(/no és la millor jugada/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Mostra la solució/ })).toBeEnabled());
  });
});
