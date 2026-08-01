import { useNavigate } from 'react-router-dom';
import ScheduleFormModal from '../components/ScheduleFormModal';

export default function NewSchedulePage() {
  const navigate = useNavigate();

  const handleClose = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate('/maintenance/schedules');
    }
  };

  return <ScheduleFormModal onClose={handleClose} />;
}
