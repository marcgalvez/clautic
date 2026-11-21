import { useNavigate, useParams } from 'react-router-dom';
import { StudentReport } from '@/components/StudentReport';

export default function StudentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  return (
    <div>
      <button className="btn-ghost mb-4 print:hidden" onClick={() => nav(-1)}>← Torna</button>
      <StudentReport studentId={id!} houseLink={`/profe/casa/${id}`} />
    </div>
  );
}
