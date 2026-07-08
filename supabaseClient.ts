// Supabase client for Gutly.
// This is the single connection to the backend that stores user accounts.
//
// The values below are PUBLIC by design:
//  - the URL is your project address
//  - the anon key is the public client key (safe to ship in an app; it only
//    grants what your Row-Level Security policies allow)
// Never put the `service_role` key in here — that one bypasses all security.
//
// url-polyfill/auto must be imported before the client is created, because
// supabase-js uses the URL/URLSearchParams APIs which React Native lacks.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fgpwifrdyhdigrqagnks.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncHdpZnJkeWhkaWdycWFnbmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTYwNDMsImV4cCI6MjA5OTA3MjA0M30.Fz8A0W2CqOFfqHcGAvMVTYwXZ8nwlpskzlgcHpqzGmQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist the login session on the device so users stay signed in across
    // app restarts, using the same AsyncStorage the rest of the app uses.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection in a native app (that's a web-only concept).
    detectSessionInUrl: false,
  },
});
