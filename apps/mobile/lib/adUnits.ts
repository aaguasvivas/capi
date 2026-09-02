import { TestIds } from "react-native-google-mobile-ads";

// Real AdMob banner unit (created 2026-08-14). The app id lives in app.json.
const PROD_BANNER_ID = "ca-app-pub-4879291425090726/4870102119";

export const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : PROD_BANNER_ID;
export const ADS_CONFIGURED = __DEV__ || !PROD_BANNER_ID.startsWith("PENDING_");
