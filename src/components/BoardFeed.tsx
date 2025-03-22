import { useState, useEffect } from "react";
import { Post } from "../models/Post";
import PostItem from "./PostItem";
import CreatePost from "./CreatePost";
import { usePostStore } from "../store/postStore";
import { syncRemotePosts } from "../utils/ipfs";
import {
  Tabs,
  Tab,
  Typography,
  CircularProgress,
  IconButton,
  Box,
  Grid,
  Paper,
  Button,
  Container,
  Divider,
  Stack
} from "@mui/material";
import {
  TrendingUp,
  GridView,
  AccessTime,
  People,
  Refresh
} from "@mui/icons-material";
import { keyframes } from '@mui/system';

// Define the spin animation
const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

interface BoardFeedProps {
  title?: string;
  subtitle?: string;
  showCreatePost?: boolean;
  mode?: string;
  currentUserAddress?: string;
  isFollowingHashtag?: (tag: string) => boolean;
  getUserProfile?: (address: string) => any;
  isLoading?: boolean;
  isSyncing?: boolean;
}

export default function BoardFeed({
  title = "Board",
  subtitle = "Discover all posts here",
  showCreatePost = true,
  mode = "recent",
  currentUserAddress = "",
  isFollowingHashtag = () => false,
  getUserProfile = () => null,
  isLoading = false,
  isSyncing = false
}: BoardFeedProps) {
  const { posts, loading, getPosts } = usePostStore();
  const [activeFeed, setActiveFeed] = useState("herkes");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiPosts, setApiPosts] = useState<Post[]>([]);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  useEffect(() => {
    fetchPostsFromApi();
    syncRemotePosts().catch(console.error);
    const intervalId = setInterval(fetchPostsFromApi, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchPostsFromApi = async () => {
    try {
      setIsApiLoading(true);
      const response = await fetch(`/api/posts?since=${lastFetchTime}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        if (data.posts) {
          setApiPosts(prev => [...data.posts, ...prev]);
        }
        setLastFetchTime(Date.now());
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setIsApiLoading(false);
    }
  };

  const refreshFeed = async () => {
    setIsRefreshing(true);
    await syncRemotePosts();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filterPosts = (category: string) => {
    const allPosts = getPosts();
    switch (category) {
      case "trending":
        return [...allPosts].sort((a, b) => b.likes - a.likes);
      case "new":
        return [...allPosts].sort((a, b) => b.timestamp - a.timestamp);
      case "following":
        return allPosts.slice(0, 3);
      default:
        return allPosts;
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4, px: { xs: 2, sm: 3 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight="bold">{title}</Typography>
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Box>
        <IconButton 
          onClick={refreshFeed} 
          disabled={isRefreshing}
          sx={{
            '& .MuiSvgIcon-root': {
              animation: isRefreshing ? `${spin} 1s infinite linear` : 'none'
            }
          }}
        >
          <Refresh />
        </IconButton>
      </Box>
      
      {showCreatePost && (
        <Box mb={3}>
          <CreatePost />
        </Box>
      )}
      
      
      <Box mt={2}>
        {loading || isApiLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress size={40} />
          </Box>
        ) : filterPosts(activeFeed).length > 0 ? (
          <Stack spacing={2}>
            {filterPosts(activeFeed).map(post => (
              <PostItem key={post.id} post={post} />
            ))}
          </Stack>
        ) : (
          <Paper 
            sx={{ 
              p: 3, 
              textAlign: "center",
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography color="text.secondary">
              No posts yet.
            </Typography>
          </Paper>
        )}
      </Box>
    </Container>
  );
}
