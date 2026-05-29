import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import RequireAdminAuth from "./components/RequireAdminAuth.jsx";
import Home from "./pages/Home";
import AdminLogin from "./pages/AdminLogin";
import ShipperLogin from "./pages/ShipperLogin";
import ShipperRegister from "./pages/ShipperRegister";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminRoutePlanner from "./pages/admin/RoutePlanner";
import Planification from "./pages/admin/Planification";
import Expediteurs from "./pages/admin/Expediteurs";
import ExpediteursApproved from "./pages/admin/ExpediteursApproved";

import Livreurs from "./pages/admin/Livreurs";
import LivreursApproved from "./pages/admin/LivreursApproved";
import LivreursConges from "./pages/admin/LivreursConges";

import Colis from "./pages/admin/Colis";
import ColisConfirmes from "./pages/admin/ColisConfirmes";
import ColisRefuses from "./pages/admin/ColisRefuses";
import Vehicules from "./pages/admin/Vehicules";

import ShipperDashboard from "./pages/shipper/Dashboard";
import ColisForm from "./pages/shipper/ColisForm";
import HistoriqueColis from "./pages/shipper/HistoriqueColis";
import TousColis from "./pages/shipper/TousColis";

import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyOTP from "./pages/VerifyOTP";


// Tournées
import TourneesAccepted from "./pages/admin/TourneesAccepted.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route element={<RequireAdminAuth />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />

            <Route path="dashboard" element={<AdminDashboard />} />

            {/* Planification Google Maps */}
            <Route path="planification" element={<Planification />} />



            {/* Partie Tournées ajoutée */}
            <Route path="route-planner" element={<AdminRoutePlanner />} />
            <Route path="tournees-accepted" element={<TourneesAccepted />} />

            <Route path="expediteurs" element={<Expediteurs />} />
            <Route
              path="expediteurs/approuves"
              element={<ExpediteursApproved />}
            />

            <Route path="livreurs" element={<Livreurs />} />
            <Route path="livreurs/approuves" element={<LivreursApproved />} />
            <Route path="livreurs/conges" element={<LivreursConges />} />

            <Route path="colis" element={<Colis />} />
            <Route path="colis/confirmes" element={<ColisConfirmes />} />
            <Route path="colis/refuses" element={<ColisRefuses />} />

            <Route path="vehicules" element={<Vehicules />} />
          </Route>
        </Route>

        {/* Expéditeur */}
        <Route
          path="/expediteur"
          element={<Navigate to="/expediteur/login" replace />}
        />
        <Route path="/expediteur/register" element={<ShipperRegister />} />
        <Route path="/expediteur/login" element={<ShipperLogin />} />
        <Route path="/expediteur/dashboard" element={<ShipperDashboard />} />

        <Route path="/expediteur/colis/tous" element={<TousColis />} />
        <Route
          path="/expediteur/colis/historique"
          element={<HistoriqueColis />}
        />
        <Route path="/expediteur/colis/nouveau" element={<ColisForm />} />
        <Route path="/expediteur/colis/:id/modifier" element={<ColisForm />} />

        {/* Forgot password */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
