import { useEffect, useState } from 'react';
import BoardFeed from '../../components/BoardFeed';
import CreatePost from '../../components/CreatePost';
import { usePostStore } from '../../store/postStore';
import { useUserStore } from '../../store/userStore';
import { useHashtagStore } from '../../store/hashtagStore';
import { syncFeeds } from '../../utils/syncRemotePosts';
import { initOrbitDB } from '../../utils/orbitdb';
import { AuthGuard } from '../../components/AuthGuard';
import { Button, CircularProgress, Tabs, Tab,Box } from '@mui/material';

const TabNav = ({ tabs, activeTab, onTabChange, loading }: { tabs: any[], activeTab: string, onTabChange: (tabId: string) => void, loading: boolean }) => {
  return (
    <div style={{ borderBottom: '1px solid #ddd', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '16px' }}>
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'contained' : 'outlined'}
            onClick={() => onTabChange(tab.id)}
            size="small"
            style={{ borderRadius: '16px' }}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      {loading && <CircularProgress size={20} />}
    </div>
  );
};

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState('following');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const getUserProfile = useUserStore((state) => state.getUserProfile);
  const updateTrendingHashtags = useHashtagStore((state) => state.updateTrendingHashtags);
  const isFollowingHashtag = useHashtagStore((state) => state.isFollowingHashtag);
  const currentUserAddress = typeof window !== 'undefined' ? localStorage.getItem('walletAddress') : null;
  const postsCount = usePostStore((state) => state.posts.length);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsSyncing(true);
        await initOrbitDB();
        await syncFeeds();
        updateTrendingHashtags();
        setIsInitialized(true);
      } catch (error) {
        console.error('Feed verileri yüklenirken hata:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    loadData();
    const intervalId = setInterval(async () => {
      try {
        setIsSyncing(true);
        await syncFeeds();
        updateTrendingHashtags();
      } catch (error) {
        console.error('Periyodik senkronizasyon sırasında hata:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 60000);

    return () => clearInterval(intervalId);
  }, [updateTrendingHashtags]);

  useEffect(() => {
    if (isInitialized) {
      updateTrendingHashtags();
    }
  }, [postsCount, isInitialized, updateTrendingHashtags]);

  const tabs = [
    { id: 'following', label: 'Last', hidden: !currentUserAddress },
    //{ id: 'trending', label: 'Trending' },
    //{ id: 'recent', label: 'New' },
    //{ id: 'hashtags', label: 'Following Hashtags', hidden: !currentUserAddress }
  ];

  return (
    <AuthGuard allowUnauthenticated>
      <Box sx={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }} >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {currentUserAddress && (
            <div style={{ borderRadius: '8px', padding: '16px', boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' }}>
              <CreatePost />
            </div>
          )}

          <div style={{ borderRadius: '8px', boxShadow: '0px 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <TabNav 
              tabs={tabs.filter(tab => !tab.hidden)}
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              loading={isSyncing} 
            />
            <BoardFeed 
              mode={activeTab} 
              currentUserAddress={currentUserAddress || ''}
              isFollowingHashtag={isFollowingHashtag}
              getUserProfile={getUserProfile}
              isLoading={!isInitialized}
              isSyncing={isSyncing}
              showCreatePost={false}
            />
          </div>
        </div>
      </Box>
    </AuthGuard>
  );
}
