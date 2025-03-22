import React from 'react';
import { formatDistanceToNow } from 'date-fns';

// Material UI imports
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';

// Material UI Icons
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CheckIcon from '@mui/icons-material/Check';

type ContactCardProps = {
  user: {
    name?: string;
    address: string;
    avatar?: string;
    status?: 'online' | 'offline' | 'away';
    lastSeen?: number;
  };
  onMessageClick?: () => void;
  onProfileClick?: () => void;
  compact?: boolean;
  showStatus?: boolean;
  actions?: React.ReactNode;
  selected?: boolean;
};

export function ContactCard({
  user,
  onMessageClick,
  onProfileClick,
  compact = false,
  showStatus = false,
  actions,
  selected = false,
}: ContactCardProps) {
  // Format user display name
  const displayName = user.name || (user.address ? `${user.address.slice(0, 6)}...${user.address.slice(-4)}` : 'Unknown');
  
  // Get avatar fallback (first letter of name or address)
  const avatarFallback = (user.name?.charAt(0) || user.address?.charAt(0) || '?').toUpperCase();
  
  // Format last seen time if available
  const lastSeenText = user.lastSeen 
    ? formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })
    : '';
  
  // Determine status color
  const statusColor = {
    online: '#4caf50', // green
    offline: '#9e9e9e', // gray
    away: '#ff9800', // yellow
  }[user.status || 'offline'];

  // Menu state
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMessageClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onMessageClick) onMessageClick();
    handleMenuClose();
  };

  const handleProfileClick = () => {
    if (onProfileClick) onProfileClick();
    handleMenuClose();
  };
  
  return (
    <Box 
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        p: compact ? 1 : 1.5,
        borderRadius: 2,
        bgcolor: selected ? 'action.selected' : 'transparent',
        '&:hover': {
          bgcolor: !selected ? 'action.hover' : 'action.selected',
          cursor: 'pointer'
        },
        transition: 'background-color 0.2s'
      }}
      onClick={onProfileClick}
    >
      {/* Avatar with status indicator */}
      <Box sx={{ position: 'relative' }}>
        {showStatus ? (
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: statusColor,
                  border: 2,
                  borderColor: 'background.paper'
                }}
              />
            }
          >
            <Avatar 
              src={user.avatar} 
              sx={{ 
                width: compact ? 40 : 48, 
                height: compact ? 40 : 48 
              }}
            >
              {avatarFallback}
            </Avatar>
          </Badge>
        ) : (
          <Avatar 
            src={user.avatar} 
            sx={{ 
              width: compact ? 40 : 48, 
              height: compact ? 40 : 48 
            }}
          >
            {avatarFallback}
          </Avatar>
        )}
      </Box>
      
      {/* User info */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography 
            variant={compact ? "body2" : "body1"} 
            fontWeight="medium" 
            sx={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {displayName}
          </Typography>
          
          {selected && (
            <CheckIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          )}
        </Box>
        
        {showStatus && (
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {user.status === 'online' ? 'Online' : lastSeenText || 'Offline'}
          </Typography>
        )}
        
        {user.address && !compact && (
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {user.address}
          </Typography>
        )}
      </Box>
      
      {/* Action buttons */}
      {actions && (
        <Box onClick={(e) => e.stopPropagation()}>
          {actions}
        </Box>
      )}
      
      {/* Default actions dropdown if no custom actions provided */}
      {!actions && onMessageClick && (
        <Box onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Options">
            <IconButton
              size="small"
              aria-controls={open ? "contact-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={open ? "true" : undefined}
              onClick={handleMenuClick}
            >
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            id="contact-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleMenuClose}
            MenuListProps={{
              'aria-labelledby': 'contact-options-button',
            }}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleMessageClick}>Message</MenuItem>
            <MenuItem onClick={handleProfileClick}>View Profile</MenuItem>
          </Menu>
        </Box>
      )}
    </Box>
  );
} 