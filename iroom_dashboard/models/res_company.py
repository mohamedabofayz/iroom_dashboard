# -*- coding: utf-8 -*-
from odoo import models, api, fields
import logging

_logger = logging.getLogger(__name__)

class ResCompany(models.Model):
    _inherit = 'res.company'

    @api.model
    def get_dashboard_data(self):
        """
        جلب البيانات مع تحديد المدينة تلقائياً
        """
        company = self.env.company
        
        try:
            room_types = []
            if company.room_type_ids:
                for rt in company.room_type_ids:
                    room_types.append({
                        'name': rt.name,
                        'count': rt.room_count
                    })
            
            # --- منطق تحديد المدينة ---
            # القيمة الافتراضية
            selected_province = 'الرياض'
            
            # 1. محاولة جلب المدينة من حقل hotel_city الجديد (الأولوية له)
            if hasattr(company, 'hotel_city') and company.hotel_city:
                # نحصل على الاسم الظاهر (Label) بدلاً من القيمة المخزنة (Key)
                # مثال: يحول 'makkah' إلى 'مكة المكرمة'
                selection = company._fields['hotel_city'].selection
                if selection:
                    # تحويل القائمة إلى قاموس للبحث
                    selection_dict = dict(selection)
                    selected_province = selection_dict.get(company.hotel_city, selected_province)
            
            # 2. إذا لم يوجد، نستخدم حقل المدينة العادي
            elif company.city:
                selected_province = company.city

            return {
                'hotelName': company.name,
                'totalRooms': company.total_rooms or 150,
                'viewRooms': company.view_rooms or 45,
                'basePrice': company.basic_price or 450.0,
                'annualRent': company.annual_rent or 6000000.0,
                'currentProfitMargin': company.profit_margin or 12.0,
                'roomTypes': room_types,
                # إرسال المدينة المحددة تلقائياً
                'selectedProvince': selected_province
            }
            
        except Exception as e:
            _logger.error(f"Error getting dashboard data: {str(e)}")
            return {}