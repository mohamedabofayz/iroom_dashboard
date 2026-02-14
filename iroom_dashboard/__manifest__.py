# -*- coding: utf-8 -*-
{
    'name': 'iRoom Dashboard',
    'version': '17.0.1.0.0',
    'category': 'Hotel Management',
    'summary': 'SmartHotel AI Dashboard',
    'author': 'Your Company',
    'depends': ['base', 'web', 'website', 'pi_main_company'],
    'data': [
        'security/ir.model.access.csv',
        'views/dashboard_backend.xml',
        'views/dashboard_frontend.xml',
        'views/clean_market.xml', 
    ],
    'assets': {
        'web.assets_backend': [
            ('include', 'https://cdn.jsdelivr.net/npm/chart.js'),
            ('include', 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'),
            ('include', 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap'),
            'iroom_dashboard/static/src/css/dashboard.css',
            'iroom_dashboard/static/src/js/dashboard_core.js',
            'iroom_dashboard/static/src/js/dashboard_backend.js',
            'iroom_dashboard/static/src/xml/dashboard_templates.xml',
            # --- الإضافة الضرورية هنا ---
            'iroom_dashboard/static/src/xml/live_market.xml', 
            'iroom_dashboard/static/src/js/live_market.js',
        ],
        'web.assets_frontend': [
            ('include', 'https://cdn.jsdelivr.net/npm/chart.js'),
            ('include', 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'),
            ('include', 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap'),
            'iroom_dashboard/static/src/css/dashboard.css',
            'iroom_dashboard/static/src/js/dashboard_core.js',
            'iroom_dashboard/static/src/js/dashboard_frontend.js',
        ],
    },
    'installable': True,
    'application': True,
}