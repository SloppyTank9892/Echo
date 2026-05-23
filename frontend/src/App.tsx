import { Route, Routes } from "react-router-dom";
import { AlertToast } from "@/components/AlertToast";
import { useEchoData } from "@/hooks/useEchoData";
import { AppLayout } from "@/layouts/AppLayout";
import { Chat } from "@/pages/Chat";
import { Dashboard } from "@/pages/Dashboard";
import { IncidentDetail } from "@/pages/IncidentDetail";
import { Incidents } from "@/pages/Incidents";
import { Settings } from "@/pages/Settings";

export default function App() {
  const { overview, metrics, logs, incidents, alerts } = useEchoData();
  const activeCount = incidents.filter((i) => i.status === "active").length;

  return (
    <>
      <AlertToast alerts={alerts} />
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <Dashboard
                overview={overview}
                metrics={metrics}
                logs={logs}
                incidentCount={activeCount}
              />
            }
          />
          <Route path="incidents" element={<Incidents incidents={incidents} />} />
          <Route path="incidents/:id" element={<IncidentDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </>
  );
}
