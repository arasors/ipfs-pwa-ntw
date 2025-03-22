import { 
  initOrbitDB, 
  getPostsFromOrbit, 
  syncOrbitDBWithStore 
} from './orbitdb';
import { syncRemotePosts } from './ipfs';

/**
 * Feeds verilerini dağıtık olarak senkronize eder
 * Önce OrbitDB ile senkronizasyon yapar, sonra IPFS ağından gelen paylaşımları ekler
 */
export const syncFeeds = async (): Promise<void> => {
  console.log('Başlatılıyor: Feed senkronizasyonu...');
  
  try {
    // 1. OrbitDB'yi başlat
    const dbInitialized = await initOrbitDB();
    
    if (dbInitialized) {
      console.log('OrbitDB başarıyla başlatıldı, paylaşımlar senkronize ediliyor...');
      
      // 2. OrbitDB ile yerel mağaza (store) arasında senkronizasyon yap
      await syncOrbitDBWithStore();
      
      console.log('OrbitDB ve yerel mağaza senkronizasyonu tamamlandı');
    }
    
    // 3. Eski IPFS senkronizasyon metodunu da çalıştır (geçiş dönemi için)
    await syncRemotePosts();
    
    console.log('Feed senkronizasyonu tamamlandı');
  } catch (error) {
    console.error('Feed senkronizasyonu sırasında hata:', error);
  }
};

/**
 * Belirli bir kullanıcının paylaşımlarını OrbitDB'den getirir
 */
export const getUserPostsFromOrbit = async (userAddress: string): Promise<any[]> => {
  try {
    // OrbitDB'yi başlat
    await initOrbitDB();
    
    // Tüm paylaşımları getir
    const allPosts = await getPostsFromOrbit();
    
    // Sadece istenen kullanıcının paylaşımlarını filtrele
    return allPosts.filter(post => post.authorAddress === userAddress);
  } catch (error) {
    console.error('Kullanıcı paylaşımları getirilirken hata:', error);
    return [];
  }
};

/**
 * Etiket (hashtag) temelli paylaşım arama
 */
export const getPostsByHashtag = async (hashtag: string): Promise<any[]> => {
  try {
    // OrbitDB'yi başlat
    await initOrbitDB();
    
    // Tüm paylaşımları getir
    const allPosts = await getPostsFromOrbit();
    
    // Etiket içeren paylaşımları filtrele
    const hashtagLower = hashtag.toLowerCase().replace('#', '');
    
    return allPosts.filter(post => {
      const content = post.content.toLowerCase();
      return content.includes(`#${hashtagLower}`) || 
             content.includes(` ${hashtagLower} `) ||
             content.includes(` ${hashtagLower},`);
    });
  } catch (error) {
    console.error('Etiket araması sırasında hata:', error);
    return [];
  }
};

export default syncFeeds; 