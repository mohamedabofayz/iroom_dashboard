/** @odoo-module **/

import { Component, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import * as DashboardCore from "./dashboard_core";

class DashboardBackend extends Component {
    static template = "iroom_dashboard.dashboard_backend_template";

    setup() {
        this.rpc = useService("rpc");
        this.user = useService("user");
        this.companyService = useService("company");
        this.notification = useService("notification");

        onMounted(async () => {
            await this.initializeDashboard();
        });
    }

    async initializeDashboard() {
        try {
            const dataFetcher = async (endpoint = '/dashboard/data') => {
                if (endpoint === '/dashboard/provinces') {
                    return await this.fetchProvinces();
                }
                return await this.loadDashboardData();
            };

            // تهيئة الكور فقط إذا لم يكن هناك خطأ مسبق
            const initResult = await DashboardCore.initializeDashboard(dataFetcher);
            DashboardCore.setupEventListeners();

        } catch (error) {
            console.error("Failed to initialize dashboard:", error);
        }
    }

    async loadDashboardData() {
        try {
            // 1. جلب الشركات النشطة حالياً
            const allowedCompanyIds = this.companyService.activeCompanyIds || [];
            
            // 2. إرسال الطلب مع السياق الصريح
            const data = await this.rpc("/dashboard/data", {}, {
                context: { 
                    allowed_company_ids: allowedCompanyIds 
                }
            });

            // 3. التحقق من وجود خطأ في الاستجابة (مثل تعدد الشركات)
            if (data && data.error) {
                // إظهار إشعار أحمر
                this.notification.add(data.message, {
                    title: "تنبيه هام",
                    type: "danger",
                    sticky: true,
                });

                // إخفاء المحتوى وعرض الرسالة
                this.showBlockMessage(data.message);
                
                // إعادة null لمنع الكور من رسم البيانات
                return null;
            }

            return data;
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
            return null;
        }
    }

    showBlockMessage(msg) {
        const container = document.querySelector('.iroom-dashboard .container');
        if (container) {
            container.innerHTML = `
                <div style="height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #dc3545;">
                    <div style="font-size: 5rem; margin-bottom: 20px;">⚠️</div>
                    <h1 style="font-family: 'Cairo'; margin-bottom: 15px;">إجراء مطلوب</h1>
                    <h3 style="font-family: 'Cairo';">${msg}</h3>
                    <p style="color: #666; margin-top: 10px;">النظام لا يدعم دمج بيانات شركتين في هذا العرض.</p>
                </div>
            `;
        }
    }

    async fetchProvinces() {
        try {
            return await this.rpc('/dashboard/provinces', {});
        } catch (error) {
            return ['مكة المكرمة', 'المدينة المنورة', 'الرياض'];
        }
    }
}

registry.category("actions").add("iroom_dashboard.backend", DashboardBackend);