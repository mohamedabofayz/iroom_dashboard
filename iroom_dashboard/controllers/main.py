# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
import logging

_logger = logging.getLogger(__name__)

class DashboardController(http.Controller):
    
    @http.route('/dashboard', type='http', auth='public', website=True)
    def dashboard_page(self, **kwargs):
        return request.render('iroom_dashboard.dashboard_frontend_template')
    
    @http.route('/dashboard/data', type='json', auth='public')
    def get_dashboard_data(self):
        """JSON endpoint for fetching hotel data"""
        try:
            allowed_company_ids = []
            
            # 1. الأولوية: السياق المرسل من الجافاسكريبت (Context)
            context = request.env.context
            if context.get('allowed_company_ids'):
                allowed_company_ids = context.get('allowed_company_ids')
            
            # 2. الاحتياطي: الكوكيز (Cookies)
            elif request.httprequest.cookies.get('cids'):
                cids_str = request.httprequest.cookies.get('cids')
                # الكوكيز دائماً نص مثل "1-2" أو "1,2"
                allowed_company_ids = [int(cid) for cid in cids_str.replace('-', ',').split(',') if cid.isdigit()]

            # 3. الاحتياطي الأخير: الجلسة (Session)
            elif request.session.get('cids'):
                session_cids = request.session.get('cids')
                if isinstance(session_cids, list):
                    allowed_company_ids = session_cids
                elif isinstance(session_cids, str):
                    allowed_company_ids = [int(cid) for cid in session_cids.split(',') if cid.isdigit()]
                elif isinstance(session_cids, int):
                    allowed_company_ids = [session_cids]

            # --- التحقق من تعدد الشركات ---
            # نتأكد أن لدينا قائمة صالحة ونفحص طولها
            if allowed_company_ids and isinstance(allowed_company_ids, list) and len(allowed_company_ids) > 1:
                return {
                    'error': 'Multi-company',
                    'message': 'الرجاء اختيار شركة واحدة فقط من القائمة العلوية.'
                }

            # تحديد الشركة المستهدفة (الأولى أو الافتراضية)
            if allowed_company_ids and isinstance(allowed_company_ids, list) and len(allowed_company_ids) > 0:
                target_company_id = allowed_company_ids[0]
            else:
                # في حال الفشل التام، نعود لشركة المشرف الافتراضية
                target_company_id = request.env['res.users'].sudo().browse(2).company_id.id
            
            # جلب البيانات
            data = request.env['res.company'].with_company(target_company_id).sudo().get_dashboard_data()
            return data

        except Exception as e:
            _logger.error(f"Error: {str(e)}")
            return {
                'error': 'System Error',
                'message': str(e)
            }
    
    @http.route('/dashboard/provinces', type='json', auth='public')
    def get_provinces(self):
        return [
            'الرياض', 'مكة المكرمة', 'المدينة المنورة', 'الشرقية',
            'عسير', 'جازان', 'تبوك', 'حائل',
            'الحدود الشمالية', 'الجوف', 'نجران', 'الباحة', 'القصيم'
        ]