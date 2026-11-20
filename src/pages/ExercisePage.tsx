import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ExerciseSolver } from '@/components/exercise/ExerciseSolver';
import { allExercises, getExercise } from '@/lib/exercises/bank';

export function ExercisePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const exercise = id ? getExercise(id) : undefined;
  if (!exercise) {
    return (
      <div className="space-y-3">
        <p>No s'ha trobat l'exercici.</p>
        <Link to="/exercicis" className="text-primary underline">Torna al banc d'exercicis</Link>
      </div>
    );
  }
  const pool = allExercises();
  const idx = pool.findIndex((e) => e.id === exercise.id);
  const nextEx = pool[(idx + 1) % pool.length];
  return (
    <div className="space-y-4 animate-fade-in">
      <Link to="/exercicis" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Banc d'exercicis
      </Link>
      <ExerciseSolver key={exercise.id} exercise={exercise} context="free" onDone={() => navigate(`/exercicis/${nextEx.id}`)} doneLabel="Exercici següent" />
    </div>
  );
}
