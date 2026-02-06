/**
 * Network Monitor - Captures recent network requests for analysis
 */
interface NetworkRequest {
    url: string;
    method: string;
    type: string;
    timestamp: number;
}
export declare function startNetworkMonitoring(): void;
export declare function stopNetworkMonitoring(): void;
export declare function getRecentRequests(seconds?: number): NetworkRequest[];
export {};
//# sourceMappingURL=networkMonitor.d.ts.map