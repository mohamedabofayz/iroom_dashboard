/** @odoo-module **/

import * as DashboardCore from "./dashboard_core";

/**
 * Frontend Dashboard Initialization
 * For website pages
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Frontend Dashboard: Initializing...');

    // Data fetcher for frontend using JSON-RPC
    const dataFetcher = async (endpoint = '/dashboard/data') => {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'call',
                    params: {},
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error('Frontend Dashboard: Error fetching data from', endpoint, error);
            // Return defaults on error
            if (endpoint === '/dashboard/provinces') {
                return ['مكة المكرمة', 'المدينة المنورة', 'الرياض'];
            }
            return null;
        }
    };

    try {
        // Initialize dashboard
        await DashboardCore.initializeDashboard(dataFetcher);

        // Setup event listeners
        DashboardCore.setupEventListeners();

        console.log('Frontend Dashboard: Initialized successfully');
    } catch (error) {
        console.error('Frontend Dashboard: Initialization failed', error);
    }
});
