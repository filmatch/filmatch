// src/navigation/RootNavigation.ts
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  }
}
export function navigateNested(rootName: string, childName: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(rootName as never, { screen: childName, params } as never);
  }
}
export function logTree() {
  if (navigationRef.isReady()) {
    console.log('[nav tree]', JSON.stringify(navigationRef.getRootState(), null, 2));
  }
}
