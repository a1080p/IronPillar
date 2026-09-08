// The firebase npm package's public types for 'firebase/auth' omit the
// React Native persistence helper, even though it's exported at runtime
// (firebase/auth re-exports '@firebase/auth', whose "react-native" build
// includes it — Metro resolves that condition correctly, TypeScript doesn't).
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
