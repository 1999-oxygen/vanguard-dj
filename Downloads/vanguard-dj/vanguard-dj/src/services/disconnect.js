/**
 * @fileoverview Disconnect Utility
 * Provides a unified way to disconnect from all frontend API connections.
 * Call this function when you want to abort all in-flight backend requests.
 */

import { disconnectApi } from './vanguardApi';
import { disconnectUniversalApi } from './universalApi';

/**
 * Disconnect from all backend API connections.
 * This aborts all active fetch requests to both Vanguard and Universal API endpoints.
 */
export const disconnectAll = () => {
  console.log('[Disconnect] Starting disconnection from all APIs...');
  
  // Disconnect from Vanguard API
  disconnectApi();
  
  // Disconnect from Universal API
  disconnectUniversalApi();
  
  console.log('[Disconnect] All backend connections have been terminated');
};

export default disconnectAll;
