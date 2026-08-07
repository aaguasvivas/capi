import { TestIds } from "react-native-google-mobile-ads";

// Production unit id lands when Adelson creates the banner unit in AdMob.
// Task 15's gate greps for PENDING_ before allowing an EAS build.
const PROD_BANNER_ID = "PENDING_ADMOB_BANNER_UNIT_ID";

export const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : PROD_BANNER_ID;
export const ADS_CONFIGURED = __DEV__ || !PROD_BANNER_ID.startsWith("PENDING_");
