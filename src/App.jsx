import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import MainLayout from './components/MainLayout';
import HomePage from './pages/HomePage';
import DevicesPage from './pages/DevicesPage';
import AutomationPage from './pages/AutomationPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Auth />} />
        
        {/* Protected Dashboard Layout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="automation" element={<AutomationPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
