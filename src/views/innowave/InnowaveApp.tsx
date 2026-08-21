import type { ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader, ScreenNav, screenFromPath } from './components.js';
import type { ScreenId } from './types.js';
import { LandingScreen } from './screens/LandingScreen.js';
import { AuthScreen } from './screens/AuthScreen.js';
import { Step1Screen } from './screens/Step1Screen.js';
import { Step2Screen } from './screens/Step2Screen.js';
import { Step3Screen } from './screens/Step3Screen.js';
import { Step4Screen } from './screens/Step4Screen.js';
import { Step5Screen } from './screens/Step5Screen.js';
import { ProposalScreen } from './screens/ProposalScreen.js';
import { ProgressScreen } from './screens/ProgressScreen.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { ProjectsScreen } from './screens/ProjectsScreen.js';
import { ProjectHubScreen } from './screens/ProjectHubScreen.js';
import { AdminScreen } from './screens/AdminScreen.js';
import './innowave.css';

const SCREENS: Record<ScreenId, ComponentType> = {
  landing: LandingScreen,
  auth: AuthScreen,
  step1: Step1Screen,
  step2: Step2Screen,
  step3: Step3Screen,
  step4: Step4Screen,
  step5: Step5Screen,
  proposal: ProposalScreen,
  progress: ProgressScreen,
  dashboard: DashboardScreen,
  projects: ProjectsScreen,
  project: ProjectHubScreen,
  admin: AdminScreen,
};

function CurrentScreen() {
  const { pathname } = useLocation();
  const Screen = SCREENS[screenFromPath(pathname)];
  return <Screen />;
}

export function InnowaveApp() {
  return (
    <div className="iw-root" style={{ fontFamily: "'Pretendard Variable',Pretendard,-apple-system,sans-serif", color: '#1B2437', background: '#F6F9FF' }}>
      <AppHeader />
      <CurrentScreen />
      <ScreenNav />
    </div>
  );
}
