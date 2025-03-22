import EmailIcon from '@mui/icons-material/Email';
import RestartIcon from '@mui/icons-material/RestartAlt';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { FullSizeCentered } from '@/components/styled';
import { email } from '@/config';
import resetApp from '@/utils/reset-app';

function AppErrorBoundaryFallback() {
  return (
    <Paper sx={{ p: 5, flex: 1, height: '87vh', margin: 'auto' }}>
        <FullSizeCentered>
          <Typography variant="h6" sx={{fontWeight: 'normal', fontSize: '1rem'}}>Some Error Occured</Typography>
        </FullSizeCentered>
      </Paper>
  );
}

export default AppErrorBoundaryFallback;
