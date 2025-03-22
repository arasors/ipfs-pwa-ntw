import { Fragment } from 'react';
import { BrowserRouter } from 'react-router';

import { CssBaseline } from '@mui/material';

import { withErrorHandler } from '@/error-handling';
import AppErrorBoundaryFallback from '@/error-handling/fallbacks/App';
import { Toaster } from 'sonner';

import Pages from './routes/Pages';
import Header from './sections/Header';
import HotKeys from './sections/HotKeys';
import Sidebar from './sections/Sidebar';
import { AuthGuard } from './components/AuthGuard';

function App() {
  return (
    <Fragment>
      <CssBaseline />
      <HotKeys />
      <Toaster />
      <BrowserRouter>
        <AuthGuard>
        <Header />
        <Sidebar />
        <Pages />
        </AuthGuard>
      </BrowserRouter>
    </Fragment>
  );
}

export default App;
//const AppWithErrorHandler = withErrorHandler(App, AppErrorBoundaryFallback);
//export default AppWithErrorHandler;
