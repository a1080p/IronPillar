import Constants from 'expo-constants';
import { addDoc, collection } from 'firebase/firestore';
import { Platform } from 'react-native';
import type { BugReportCategory } from '../types/models';
import { db } from './firebase/config';

export async function submitBugReport(params: {
  uid: string;
  screen: string;
  category: BugReportCategory;
  description: string;
}): Promise<void> {
  await addDoc(collection(db, 'bugReports'), {
    ...params,
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    status: 'new',
    createdAt: new Date().toISOString(),
  });
}
