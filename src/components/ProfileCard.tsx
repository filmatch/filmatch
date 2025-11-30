// src/components/ProfileCard.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const CARD_W = Math.min(width * 0.90, 400); 
const CARD_H = Math.min(height * 0.74, 680); 

interface ProfileCardProps {
  profile: any;
  isPreview?: boolean;
  footer?: React.ReactNode;
  onClose?: () => void;
}

// Helper to fix incomplete TMDb URLs
const getImageSource = (path?: string | null) => {
  if (!path) return null;
  // If it's a full URL (Cloudinary or full TMDB link), use it directly
  if (path.startsWith('http') || path.startsWith('file')) {
    return { uri: path };
  }
  // Otherwise assume it's a TMDb partial path
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return { uri: `https://image.tmdb.org/t/p/w342${cleanPath}` };
};

const GenreText = ({ text, isLast }: { text: string, isLast: boolean }) => (
  <Text style={s.genreTextItem}>
    {text.toLowerCase()}
    {!isLast && <Text style={s.genreSeparator}> • </Text>}
  </Text>
);

const GhostPoster = ({ title }: { title: string }) => (
  <View style={s.ghostPoster}>
    <View style={s.ghostPosterInner}>
      <Text style={s.ghostPosterText} numberOfLines={3}>{title.toLowerCase()}</Text>
    </View>
  </View>
);

const PosterTile = ({ p }: { p: any }) => {
  // Support both 'poster' and 'poster_path' keys
  const source = getImageSource(p.poster || p.poster_path);
  return (
    <View style={s.posterTile}>
      {source ? (
        <Image 
          source={source} 
          style={s.posterImg} 
          resizeMode="cover" 
        />
      ) : (
        <View style={[s.posterImg, s.posterPlaceholder]}>
          <Text style={s.posterPlaceholderText}>no{'\n'}img</Text>
        </View>
      )}
      <Text style={s.posterCaption} numberOfLines={1}>{p.title.toLowerCase()}</Text>
    </View>
  );
};

export default function ProfileCard({ profile, isPreview = false, footer, onClose }: ProfileCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!profile) return null;

  const photos = profile.photos || [];
  const currentPhoto = photos[photoIndex] || null;
  const currentPhotoSource = getImageSource(currentPhoto);

  const handlePhotoTap = () => {
    if (photos.length > 1) {
      setPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const topGenres = useMemo(() => {
    if (profile.genreRatings?.length) {
      return [...profile.genreRatings]
        .filter((g: any) => g.rating > 0)
        .sort((a: any, b: any) => b.rating - a.rating)
        .slice(0, 5)
        .map((g: any) => g.genre);
    }
    return [];
  }, [profile]);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={s.name}>
            {profile.displayName || profile.name || 'user'}
            {profile.age ? `, ${profile.age}` : ""}
            {profile.city ? ` • ${profile.city.toLowerCase()}` : ""}
          </Text>
        </View>
        <View style={s.compBadge}>
          <Text style={s.compText}>{isPreview ? 'you' : `${profile.compatibility || 0}%`}</Text>
          <Text style={s.compCaption}>{isPreview ? 'preview' : 'match'}</Text>
        </View>
      </View>

      {profile.bio ? <Text style={s.bio} numberOfLines={3}>{profile.bio.toLowerCase()}</Text> : null}

      {/* PHOTOS */}
      {photos.length > 0 && currentPhotoSource ? (
        <TouchableOpacity activeOpacity={0.95} onPress={handlePhotoTap} style={s.photoContainer}>
          <Image source={currentPhotoSource} style={s.photo} resizeMode="cover" />
          {photos.length > 1 && (
            <View style={s.photoIndicatorContainer}>
              {photos.map((_: any, i: number) => (
                <View key={i} style={[s.dot, i === photoIndex && s.dotActive]} />
              ))}
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View style={s.noPhotosPlaceholder}>
          <Text style={s.noPhotosText}>{profile.name?.[0] || '?'}</Text>
        </View>
      )}

      {/* Genres */}
      {topGenres.length > 0 && (
        <View style={s.genresWrap}>
          <Text style={s.genresLine}>
            {topGenres.map((g: string, index: number) => (
              <GenreText key={g} text={g} isLast={index === topGenres.length - 1} />
            ))}
          </Text>
        </View>
      )}

      {/* Fav Films */}
      {profile.favorites && profile.favorites.length > 0 && (
        <>
          <Text style={s.sectionTitle}>fav films</Text>
          <View style={s.posterRow}>
            {profile.favorites.slice(0, 4).map((p: any, i: number) => (
              <PosterTile key={p.id || i} p={p} />
            ))}
          </View>
        </>
      )}

      {/* Recent Watches */}
      {profile.recentWatches && profile.recentWatches.length > 0 && (
        <>
          <Text style={s.sectionTitle}>recents</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {profile.recentWatches.slice(0, 6).map((r: any, i: number) => {
              // Support both 'poster' and 'poster_path'
              const imgSource = getImageSource(r.poster || r.poster_path);
              if (imgSource) return (
                 <View key={i} style={{width: 52, height: 78, borderRadius: 6, overflow: 'hidden'}}>
                    <Image source={imgSource} style={{width: '100%', height: '100%'}} />
                 </View>
              );
              return <GhostPoster key={i} title={r.title} />;
            })}
          </ScrollView>
        </>
      )}

      {/* Footer / Buttons */}
      {footer ? (
        <View style={{ marginTop: 20 }}>{footer}</View>
      ) : isPreview && onClose ? (
        <View style={{ marginTop: 20, alignItems: 'center' }}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>close preview</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { 
    width: CARD_W, minHeight: CARD_H, backgroundColor: "rgba(240,228,193,0.07)", 
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(240,228,193,0.18)", padding: 16, 
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  name: { color: "#F0E4C1", fontSize: 20, fontWeight: "800", textTransform: "lowercase" }, 
  compBadge: { alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#511619", borderRadius: 14, minWidth: 76 },
  compText: { color: "#F0E4C1", fontSize: 24, fontWeight: "900" }, 
  compCaption: { color: "#F0E4C1", opacity: 0.85, fontSize: 10, marginTop: -2, textTransform: "lowercase" },
  bio: { color: "#F0E4C1", opacity: 0.95, marginBottom: 10, lineHeight: 18, fontSize: 14 },
  photoContainer: { marginVertical: 6, position: 'relative' },
  photo: { width: '100%', height: 250, borderRadius: 12, backgroundColor: "#0b1220" }, 
  photoIndicatorContainer: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(240,228,193,0.4)' },
  dotActive: { backgroundColor: '#F0E4C1', width: 20 },
  noPhotosPlaceholder: { width: '100%', height: 200, borderRadius: 12, backgroundColor: "rgba(240,228,193,0.08)", alignItems: "center", justifyContent: "center", marginVertical: 6 },
  noPhotosText: { color: "rgba(240,228,193,0.3)", fontSize: 40, fontWeight: 'bold' },
  sectionTitle: { color: "#F0E4C1", fontSize: 12, fontWeight: "700", marginTop: 10, marginBottom: 6, textTransform: "lowercase" },
  posterRow: { flexDirection: "row", gap: 6 },
  posterTile: { width: 52 }, 
  posterImg: { width: 52, height: 78, borderRadius: 6, backgroundColor: "rgba(240,228,193,0.1)" }, 
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  posterPlaceholderText: { color: "rgba(240,228,193,0.5)", fontSize: 9, textAlign: "center" },
  posterCaption: { color: "#F0E4C1", fontSize: 9, marginTop: 2 },
  genresWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, marginBottom: 8 },
  genresLine: { textAlign: 'center', lineHeight: 20 },
  genreTextItem: { color: '#F0E4C1', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  genreSeparator: { color: 'rgba(240,228,193,0.4)', fontSize: 10 },
  ghostPoster: { width: 52, height: 78, borderRadius: 6, backgroundColor: 'rgba(240,228,193,0.05)', borderWidth: 1, borderColor: 'rgba(240,228,193,0.15)', padding: 4, justifyContent: 'center', alignItems: 'center' },
  ghostPosterInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ghostPosterText: { color: '#F0E4C1', fontSize: 8, fontWeight: '600', textAlign: 'center', textTransform: 'lowercase', opacity: 0.9 },
  closeBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(240,228,193,0.2)' },
  closeText: { color: '#F0E4C1', fontWeight: '600' }
});