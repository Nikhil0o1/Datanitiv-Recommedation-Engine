import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PlanningApp from './components/PlanningApp';
import CostPage from './pages/CostPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/cost" element={<CostPage />} />
        <Route path="/*" element={<PlanningApp />} />
      </Routes>
    </BrowserRouter>
  );
}
