/** @odoo-module **/

/**
 * Dashboard Core Logic
 * - Fetches strategies dynamically from Google Sheets.
 * - Displays strategies in a Category Grid Layout.
 * - handles calculations and Excel export.
 */

// رابط الويب هوك الخاص بك
const GAS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzBTVYM8eOSXNsbF2HDnOkdwKKdLuF_K9Df4Egn0BvgRRcc212HlUHONg_FlIn7Mw1v/exec";

export const state = {
    hotelInfo: {},
    roomTypes: [],
    yearlyData: [],
    // تخزين البيانات الخام القادمة من الشيت
    rawStrategyData: [],
    // تخزين حالة التفعيل (اسم الاستراتيجية: true/false)
    activeStrategies: {}, 
    priceChart: null,
    chartView: 'daily'
};

export const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// --- Initialization ---

export async function initializeDashboard(dataFetcher) {
    try {
        console.log('Dashboard Core: Starting initialization...');
        
        // 1. واجهة التحميل: إخفاء النموذج وإظهار رسالة التحميل فوراً
        const inputView = document.getElementById('input-view');
        const resultsView = document.getElementById('results-view');
        let loaderDiv = null;

        if (inputView) {
            // إخفاء واجهة الإدخال تماماً
            inputView.classList.add('hidden');
            
            // إنشاء وإظهار واجهة التحميل
            loaderDiv = document.createElement('div');
            loaderDiv.id = 'initial-loader';
            loaderDiv.style.cssText = 'text-align: center; padding: 60px 20px; animation: fadeIn 0.5s;';
            loaderDiv.innerHTML = `
                <div style="font-size: 3rem; margin-bottom: 20px;">🚀</div>
                <h2 style="color: var(--dark-blue); margin-bottom: 10px;">جاري إعداد وتجهيز البيانات...</h2>
                <p style="color: var(--gray);">يرجى الانتظار، يتم الآن جلب استراتيجيات السوق وتحليل البيانات</p>
                <div style="margin-top: 20px; display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--dark-blue); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            `;
            // إدراج اللودر قبل واجهة النتائج
            if (resultsView && resultsView.parentNode) {
                resultsView.parentNode.insertBefore(loaderDiv, resultsView);
            }
        }

        // 2. جلب المحافظات
        await fetchProvincesFromGAS();

        // 3. جلب بيانات الفندق من أودو
        const data = await dataFetcher();
        
        if (data) {
            // ملء النموذج في الخلفية (وهو مخفي)
            autoFillForm(data);

            // 4. التشغيل التلقائي للتحليل والانتقال للواجهة
            // ننتظر قليلاً لضمان تحميل DOM ثم ننفذ التحليل
            setTimeout(async () => {
                console.log('Auto-starting analysis...');
                
                // تشغيل التحليل مباشرة
                await handleAnalysis();
                
                // إزالة اللودر
                if (loaderDiv) loaderDiv.remove();
                
                // إظهار النتائج (handleAnalysis تقوم بذلك، لكن للتأكيد)
                if (resultsView) resultsView.classList.remove('hidden');
                
            }, 1500); // انتظار 1.5 ثانية لضمان تجربة سلسة

        } else {
            // في حال عدم وجود بيانات، نُظهر النموذج الافتراضي ونخفي اللودر
            if (loaderDiv) loaderDiv.remove();
            if (inputView) inputView.classList.remove('hidden');
            
            // بيانات افتراضية
            addRoomTypeRow('غرفة مزدوجة', 100);
            addRoomTypeRow('جناح ملكي', 50);
        }

        // 5. تعريض الدوال للنطاق العام
        exposeGlobalFunctions();

        console.log('Dashboard Core: Initialization complete');
    } catch (error) {
        console.error('Dashboard Core: Failed to initialize:', error);
        // في حال الخطأ، نحاول إعادة إظهار النموذج
        const inputView = document.getElementById('input-view');
        if (inputView) inputView.classList.remove('hidden');
        const loader = document.getElementById('initial-loader');
        if (loader) loader.remove();
    }
}

// --- Webhook Integration ---

// جلب المحافظات
async function fetchProvincesFromGAS() {
    const provinceSelect = document.getElementById('provinceSelect');
    if (!provinceSelect) return;

    try {
        const response = await fetch(`${GAS_WEBHOOK_URL}?action=getProvinces`);
        if (!response.ok) throw new Error("Webhook Error");
        const provinces = await response.json();

        if (Array.isArray(provinces) && provinces.length > 0) {
            provinceSelect.innerHTML = ''; 
            provinces.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                provinceSelect.appendChild(opt);
            });
            if (provinceSelect.options.length > 0) provinceSelect.selectedIndex = 0;
        }
    } catch (e) {
        console.warn("Could not fetch provinces, using defaults.", e);
        if (provinceSelect.options.length <= 1) {
            provinceSelect.innerHTML = `
                <option value="الرياض">الرياض</option>
                <option value="مكة المكرمة">مكة المكرمة</option>
                <option value="المدينة المنورة">المدينة المنورة</option>
            `;
        }
    }
}

// جلب الاستراتيجيات والأحداث (الهيكل الجديد)
async function fetchStrategiesFromGAS(province) {
    try {
        // نطلب البيانات الخاصة بالمحافظة المحددة
        const url = `${GAS_WEBHOOK_URL}?action=getEvents&province=${encodeURIComponent(province)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        
        // البيانات المتوقعة: [{date, province, category, name, desc, eventName, impact}, ...]
        const data = await response.json();
        state.rawStrategyData = data;
        
        // تفعيل الاستراتيجيات الجديدة افتراضياً إذا لم تكن موجودة مسبقاً
        state.rawStrategyData.forEach(item => {
            if (item.name && state.activeStrategies[item.name] === undefined) {
                state.activeStrategies[item.name] = true;
            }
        });

    } catch (error) {
        console.error("Failed to fetch strategies:", error);
        state.rawStrategyData = [];
        // لا نظهر تنبيه مزعج في التشغيل التلقائي، فقط نسجل الخطأ
        console.warn("تعذر جلب الاستراتيجيات من الخادم. سيتم استخدام الحسابات الأساسية فقط.");
    }
}

// --- Data Population ---

export function autoFillForm(data) {
    if (!data) return;
    setVal('hotelName', data.hotelName);
    setVal('totalRooms', data.totalRooms);
    setVal('viewRooms', data.viewRooms);
    setVal('basePrice', data.basePrice);
    setVal('annualRent', data.annualRent);
    setVal('currentProfitMargin', data.currentProfitMargin);

    if (data.selectedProvince) {
        // محاولة تعيين القيمة فوراً
        const select = document.getElementById('provinceSelect');
        if(select) {
            select.value = data.selectedProvince;
            // محاولة أخرى بعد قليل للتأكد في حال تأخر تحميل القائمة
            setTimeout(() => { select.value = data.selectedProvince; }, 500);
        }
    }

    const container = document.getElementById('roomTypesContainer');
    if(container) container.innerHTML = '';
    
    if (data.roomTypes && data.roomTypes.length > 0) {
        data.roomTypes.forEach(rt => addRoomTypeRow(rt.name, rt.count));
    } else {
        addRoomTypeRow('غرفة مزدوجة', 100);
        addRoomTypeRow('جناح ملكي', 50);
    }
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined ? val : '';
}

// --- UI Functions ---

export function addRoomTypeRow(name = '', count = '') {
    const container = document.getElementById('roomTypesContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'room-type-row';
    div.innerHTML = `
        <input type="text" class="rt-name" value="${name}" placeholder="النوع">
        <input type="number" class="rt-count" value="${count}" placeholder="العدد">
        <button type="button" class="btn btn-danger remove-rt">×</button>
    `;
    container.appendChild(div);
}

export function setupEventListeners() {
    const addBtn = document.getElementById('addRoomBtn');
    if (addBtn) addBtn.onclick = () => addRoomTypeRow();

    const rtContainer = document.getElementById('roomTypesContainer');
    if (rtContainer) {
        rtContainer.onclick = (e) => {
            if (e.target.classList.contains('remove-rt')) e.target.parentElement.remove();
        };
    }

    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.onclick = async (e) => {
            e.preventDefault();
            await handleAnalysis();
        };
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.onclick = exportExcel;
}

// --- Analysis Logic ---

export async function handleAnalysis() {
    const btn = document.getElementById('analyzeBtn');
    const originalText = btn ? btn.textContent : '';
    
    // إذا كان الزر ظاهراً (في حال التعديل اللاحق)، نظهر حالة التحميل عليه
    if(btn && !btn.closest('.hidden')) {
        btn.textContent = 'جاري مزامنة الاستراتيجيات...';
        btn.classList.add('btn-loading');
    }

    const provinceSelect = document.getElementById('provinceSelect');
    const province = provinceSelect ? provinceSelect.value : 'الرياض';

    try {
        // 1. جلب البيانات الحديثة من الشيت
        await fetchStrategiesFromGAS(province);
    } catch (err) {
        console.error("Webhook Error or Offline:", err);
    } finally {
        // 2. قراءة بيانات النموذج
        state.hotelInfo = {
            name: document.getElementById('hotelName').value,
            province: province,
            totalRooms: Number(document.getElementById('totalRooms').value),
            viewRooms: Number(document.getElementById('viewRooms').value),
            basePrice: Number(document.getElementById('basePrice').value),
            rent: Number(document.getElementById('annualRent').value),
            currentMargin: Number(document.getElementById('currentProfitMargin').value)
        };

        state.roomTypes = [];
        document.querySelectorAll('.room-type-row').forEach(row => {
            const name = row.querySelector('.rt-name').value;
            const count = Number(row.querySelector('.rt-count').value);
            if (name && count) state.roomTypes.push({ name, count });
        });

        if (state.roomTypes.length === 0) {
            console.warn('يرجى إضافة نوع غرفة واحد على الأقل');
            if(btn) { btn.textContent = originalText; btn.classList.remove('btn-loading'); }
            return;
        }

        // 3. تشغيل الحسابات
        runAnalysis();

        // 4. تحديث الواجهة والانتقال للنتائج
        const inputView = document.getElementById('input-view');
        if (inputView) inputView.classList.add('hidden');
        
        const resultsView = document.getElementById('results-view');
        if (resultsView) resultsView.classList.remove('hidden');
        
        const resultsArea = document.getElementById('resultsArea');
        if (resultsArea) resultsArea.classList.remove('hidden');
        
        const roomSummaryPanel = document.getElementById('roomSummaryPanel');
        if (roomSummaryPanel) roomSummaryPanel.classList.remove('hidden');

        // بناء مكتبة الاستراتيجيات (الواجهة الجديدة - Grid)
        renderStrategyLibrary();

        switchTab('stats');
        renderRoomSummary();
        renderDashboard();

        // Scroll to top
        const container = document.querySelector('.o_dashboard_container') || window;
        if(container && container.scrollTo) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        if(btn) {
            btn.textContent = originalText;
            btn.classList.remove('btn-loading');
        }
    }
}

export function runAnalysis() {
    state.yearlyData = generateData();
}

// دالة تعيد الحساب عند تغيير التبديلات في تبويب الاستراتيجيات
export function reCalculateStrategies() {
    runAnalysis();
    renderDashboard();
    // إشعار بسيط للمستخدم
    const btn = document.querySelector('#tab-strategies .btn-primary');
    if (btn) {
        const oldText = btn.textContent;
        btn.textContent = 'تم التحديث ✓';
        setTimeout(() => { btn.textContent = oldText; }, 2000);
    }
    
    switchTab('stats');
}

export function generateData() {
    const data = [];
    const totalRooms = state.hotelInfo.totalRooms || 1; 
    const viewRatio = state.hotelInfo.viewRooms / totalRooms;

    for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(2026, m + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(2026, m, d);
            // تحويل التاريخ لنص مطابق لما يأتي من Google Sheet (YYYY-MM-DD)
            const dateStr = `${2026}-${String(m+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            const dayOfWeek = dateObj.getDay();
            const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6);
            
            let seasonName = "عادي";
            let baseMult = 1.0;
            let dailyStrategies = [];

            // --- تطبيق المنطق الديناميكي من البيانات المجلوبة ---
            state.rawStrategyData.forEach(strategy => {
                // هل التاريخ يطابق؟
                if (strategy.date === dateStr) {
                    // هل الاستراتيجية مفعلة من قبل المستخدم؟
                    if (state.activeStrategies[strategy.name]) {
                        
                        // تطبيق عامل التأثير
                        const impact = strategy.impact ? parseFloat(strategy.impact) : 1.0;
                        if (impact > baseMult) {
                            baseMult = impact;
                        }

                        // تسجيل اسم الاستراتيجية للعرض
                        if (!dailyStrategies.includes(strategy.name)) {
                            dailyStrategies.push(strategy.name);
                        }
                        
                        // تحديث اسم الحدث
                        if (strategy.eventName) {
                            seasonName = strategy.eventName;
                        }
                    }
                }
            });

            // --- منطق احتياطي (Fallback) لنهاية الأسبوع ---
            if (isWeekend && baseMult < 1.3) {
                baseMult = 1.3;
                if (seasonName === "عادي") seasonName = "نهاية الأسبوع";
            }

            // --- حسابات الإشغال بناءً على السعر ---
            let occ = 55;
            if (baseMult > 2.5) occ = 95;      // مواسم ذروة عالية
            else if (baseMult > 1.8) occ = 85; // مواسم قوية
            else if (baseMult > 1.2) occ = 70; // نهاية أسبوع

            // --- حساب الإيرادات ---
            let dailyTotalRev = 0;
            const roomDetails = state.roomTypes.map((rt, idx) => {
                // تنويع بسيط في السعر حسب نوع الغرفة
                const typeBase = state.hotelInfo.basePrice * (1 + (idx * 0.4));
                const finalRate = Math.round(typeBase * baseMult);
                
                const viewCount = Math.round(rt.count * viewRatio);
                const stdCount = rt.count - viewCount;
                
                const viewRate = Math.round(finalRate * 1.3); // زيادة 30% للمطلة
                const rev = (stdCount * finalRate * (occ / 100)) + (viewCount * viewRate * (occ / 100));
                
                dailyTotalRev += rev;
                return { name: rt.name, count: rt.count, rate: finalRate, viewRate: viewRate, rev: rev };
            });

            data.push({
                date: dateObj,
                monthIdx: m,
                day: d,
                season: seasonName,
                mult: baseMult,
                occ: occ,
                strategies: dailyStrategies,
                rooms: roomDetails,
                totalRev: Math.round(dailyTotalRev)
            });
        }
    }
    return data;
}

// --- Rendering ---

// 1. بناء مكتبة الاستراتيجيات (بنظام الشبكة للفئات - Categories Grid)
export function renderStrategyLibrary() {
    const container = document.getElementById('strategiesLibraryContainer');
    if (!container) return;
    container.innerHTML = '';

    // تجميع الاستراتيجيات حسب الفئة (Category)
    const grouped = {};
    
    state.rawStrategyData.forEach(item => {
        if (!item.category) return;
        if (!grouped[item.category]) {
            grouped[item.category] = new Map(); 
        }
        
        if (!grouped[item.category].has(item.name)) {
            grouped[item.category].set(item.name, {
                name: item.name,
                desc: item.desc || 'وصف الاستراتيجية غير متوفر',
                active: state.activeStrategies[item.name] !== false 
            });
        }
    });

    if (Object.keys(grouped).length === 0) {
        container.innerHTML = '<div class="text-center p-4">لا توجد استراتيجيات متاحة لهذه المنطقة حالياً.</div>';
        return;
    }

    // إنشاء حاوية الشبكة الرئيسية (Grid Wrapper)
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'strategies-grid-wrapper';

    // بناء البطاقات لكل فئة
    Object.keys(grouped).forEach(category => {
        // بطاقة الفئة
        const categoryCard = document.createElement('div');
        categoryCard.className = 'strategy-category-card fade-in';
        
        // رأس البطاقة (اسم الفئة والعدد)
        const header = document.createElement('div');
        header.className = 'card-header-grid';
        header.innerHTML = `
            <div class="cat-icon-wrapper">⚡</div>
            <div class="cat-info">
                <div class="cat-name">${category}</div>
                <div class="cat-count">${grouped[category].size} استراتيجيات</div>
            </div>
            <div class="toggle-icon">▼</div>
        `;
        
        // محتوى البطاقة (قائمة الاستراتيجيات)
        const content = document.createElement('div');
        content.className = 'card-content-grid collapsed';
        
        grouped[category].forEach((strategy) => {
            const item = document.createElement('div');
            item.className = 'strategy-row-item';
            
            const isChecked = strategy.active ? 'checked' : '';
            
            item.innerHTML = `
                <div class="st-text">
                    <div class="st-row-name">${strategy.name}</div>
                    <div class="st-row-desc">${strategy.desc}</div>
                </div>
                <label class="switch small-switch">
                    <input type="checkbox" data-name="${strategy.name}" ${isChecked} onchange="window.toggleStrategy(this)">
                    <span class="slider round"></span>
                </label>
            `;
            
            content.appendChild(item);
        });

        // حدث النقر لتوسيع/طي البطاقة
        header.onclick = () => {
            content.classList.toggle('collapsed');
            categoryCard.classList.toggle('expanded');
        };

        categoryCard.appendChild(header);
        categoryCard.appendChild(content);
        gridWrapper.appendChild(categoryCard);
    });

    container.appendChild(gridWrapper);
}

export function renderRoomSummary() {
    const container = document.getElementById('roomTypesSummary');
    if(!container) return;
    container.innerHTML = '';
    const totalRooms = state.hotelInfo.totalRooms;
    state.roomTypes.forEach(room => {
        const percentage = totalRooms > 0 ? Math.round((room.count / totalRooms) * 100) : 0;
        const div = document.createElement('div');
        div.className = 'room-type-card';
        div.innerHTML = `
            <div class="room-type-name">${room.name}</div>
            <div class="room-type-count">${room.count}</div>
            <div class="room-type-percent">${percentage}% من إجمالي الغرف</div>
        `;
        container.appendChild(div);
    });
}

export function renderDashboard() {
    const totalRev = state.yearlyData.reduce((a, b) => a + b.totalRev, 0);
    const rent = state.hotelInfo.rent;
    const opsCost = totalRev * 0.22;
    const net = totalRev - rent - opsCost;
    const margin = totalRev > 0 ? (net / totalRev) * 100 : 0;

    setText('totalRevenueDisplay', (totalRev / 1000000).toFixed(2) + " مليون ريال");
    setText('netProfitDisplay', (net / 1000000).toFixed(2) + " مليون ريال");
    setText('newMarginDisplay', margin.toFixed(1) + "%");

    const diff = margin - state.hotelInfo.currentMargin;
    const badge = document.getElementById('marginImprovement');
    if (badge) {
        badge.textContent = diff > 0 ? `تحسن +${diff.toFixed(1)}%` : `تغير ${diff.toFixed(1)}%`;
        badge.style.color = diff > 0 ? 'var(--green)' : 'var(--red)';
    }

    // عدد الاستراتيجيات المفعلة
    const activeCount = Object.values(state.activeStrategies).filter(Boolean).length;
    setText('revBoostBadge', `تم تفعيل ${activeCount} استراتيجيات ذكية`);

    const avgOcc = state.yearlyData.reduce((a, b) => a + b.occ, 0) / 365;
    setText('occupancyDisplay', Math.round(avgOcc) + "%");

    renderCalendar();
    renderPriceMovementChart();
}

function setText(id, txt) {
    const el = document.getElementById(id);
    if(el) el.textContent = txt;
}

export function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if(!grid) return;
    grid.innerHTML = '';

    monthsAr.forEach((mName, mIdx) => {
        const card = document.createElement('div');
        card.className = 'month-card';
        
        const header = document.createElement('div');
        header.className = 'month-header';
        header.innerHTML = `<span>${mName}</span><span>📅</span>`;
        header.onclick = () => showMonthDetails(mIdx);

        const daysDiv = document.createElement('div');
        daysDiv.className = 'days-container';

        const days = state.yearlyData.filter(d => d.monthIdx === mIdx);
        const firstDay = days.length > 0 ? days[0].date.getDay() : 0;

        for(let i=0; i<firstDay; i++) {
            daysDiv.appendChild(document.createElement('div'));
        }

        days.forEach(d => {
            let heatClass = 'heat-neutral';
            // ألوان الهيت ماب بناءً على المضاعف الجديد
            if (d.mult > 2.5) heatClass = 'heat-very-high';
            else if (d.mult > 1.8) heatClass = 'heat-high';
            else if (d.mult > 1.2) heatClass = 'heat-medium';

            const cell = document.createElement('div');
            cell.className = `day-cell ${heatClass}`;
            cell.textContent = d.day;
            
            if (d.strategies.length > 0) {
                 const dot = document.createElement('div');
                 dot.style.cssText = 'width:6px;height:6px;background:var(--dark-blue);border-radius:50%;position:absolute;bottom:2px;right:2px;border:1px solid white;';
                 cell.appendChild(dot);
            }

            cell.onclick = (e) => { e.stopPropagation(); showDayDetails(d); };
            daysDiv.appendChild(cell);
        });

        card.appendChild(daysDiv);
        grid.appendChild(card);
    });
}

export function renderPriceMovementChart() {
    const ctx = document.getElementById('priceMovementChart');
    if (!ctx) return;
    
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library is not loaded');
        return;
    }

    if (state.priceChart) state.priceChart.destroy();

    const getHeatColor = (mult) => {
        if (mult > 2.5) return '#e74c3c';
        if (mult > 1.8) return '#f39c12';
        if (mult > 1.2) return '#f1c40f';
        return '#aaa';
    };

    let labels, dataPoints, rawMults;
    
    if (state.chartView === 'monthly') {
         labels = monthsAr;
         dataPoints = [];
         rawMults = [];
         for(let m=0; m<12; m++) {
             const mDays = state.yearlyData.filter(d => d.monthIdx === m);
             if (mDays.length > 0) {
                 const avg = mDays.reduce((s, d) => s + d.mult, 0) / mDays.length;
                 dataPoints.push((avg * 100).toFixed(0));
                 rawMults.push(avg);
             } else {
                 dataPoints.push(0);
                 rawMults.push(1);
             }
         }
    } else {
        labels = state.yearlyData.map(d => `${d.day}/${d.monthIdx + 1}`);
        dataPoints = state.yearlyData.map(d => (d.mult * 100).toFixed(0));
        rawMults = state.yearlyData.map(d => d.mult);
    }

    state.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'مؤشر السعر %',
                data: dataPoints,
                borderColor: '#aaa',
                borderWidth: 2,
                pointRadius: state.chartView === 'monthly' ? 5 : 0,
                pointBackgroundColor: (c) => getHeatColor(rawMults[c.dataIndex]),
                tension: 0,
                segment: {
                    borderColor: ctx => getHeatColor(rawMults[ctx.p0DataIndex])
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: {display: false} },
            scales: {
                y: { beginAtZero: false, min: 100 }
            }
        }
    });
}

// --- Modals & Details ---
export function showMonthDetails(mIdx) {
    const days = state.yearlyData.filter(d => d.monthIdx === mIdx);
    const modal = document.getElementById('detailsModal');
    if (modal) {
        document.getElementById('detailsTitle').textContent = `تفاصيل شهر ${monthsAr[mIdx]}`;
        document.getElementById('detailsHead').innerHTML = `<tr><th>اليوم</th><th>المناسبة</th><th>الإشغال</th><th>الإيراد</th></tr>`;
        
        let html = '';
        days.forEach(d => {
            html += `<tr><td>${d.day}</td><td>${d.season}</td><td>${d.occ}%</td><td style="color:var(--green)">${d.totalRev.toLocaleString()}</td></tr>`;
        });
        document.getElementById('detailsBody').innerHTML = html;
        modal.classList.add('active');
    }
}

export function showDayDetails(d) {
    const modal = document.getElementById('detailsModal');
    if (modal) {
        document.getElementById('detailsTitle').textContent = `تفاصيل يوم ${d.day} ${monthsAr[d.monthIdx]}`;
        document.getElementById('detailsHead').innerHTML = `<tr><th>النوع</th><th>العدد</th><th>السعر</th><th>مطلة</th><th>الإيراد</th></tr>`;
        
        let html = '';
        d.rooms.forEach(r => {
            html += `<tr><td>${r.name}</td><td>${r.count}</td><td>${r.rate}</td><td>${r.viewRate}</td><td style="color:var(--green)">${r.rev.toLocaleString()}</td></tr>`;
        });
        document.getElementById('detailsBody').innerHTML = html;
        modal.classList.add('active');
    }
}

// --- Export Logic ---
export function exportExcel() {
    if (typeof XLSX === 'undefined') {
        alert('مكتبة Excel غير جاهزة');
        return;
    }
    
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summary = [
        ["تقرير استراتيجيات SmartHotel 2026"],
        ["اسم الفندق", state.hotelInfo.name],
        ["المنطقة", state.hotelInfo.province],
        ["إجمالي الغرف", state.hotelInfo.totalRooms],
        ["غرف مطلة", state.hotelInfo.viewRooms],
        ["إجمالي الإيراد", document.getElementById('totalRevenueDisplay').textContent],
        ["صافي الربح", document.getElementById('netProfitDisplay').textContent]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "الملخص");

    // Room Types Sheet
    const roomRows = state.roomTypes.map(rt => [rt.name, rt.count]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["نوع الغرفة", "العدد"], ...roomRows]), "توزيع الغرف");

    // Daily Data Sheet
    const dailyHeaders = ["التاريخ", "المناسبة", "الاستراتيجيات", "نسبة السعر %", "الإشغال %", "الإيراد اليومي"];
    const dailyRows = state.yearlyData.map(d => [
        `${d.day}/${d.monthIdx + 1}/2026`,
        d.season,
        d.strategies.join(", "),
        (d.mult * 100).toFixed(0) + "%",
        d.occ + "%",
        d.totalRev
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]), "البيانات اليومية");

    // Details Sheet
    const detailHeaders = ["التاريخ", "نوع الغرفة", "العدد", "السعر", "الإيراد"];
    const detailRows = [];
    state.yearlyData.forEach(d => {
        d.rooms.forEach(r => {
            detailRows.push([
                `${d.day}/${d.monthIdx + 1}/2026`,
                r.name,
                r.count,
                r.rate,
                r.rev
            ]);
        });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]), "تفاصيل الغرف");

    XLSX.writeFile(wb, "SmartHotel_2026_Report.xlsx");
}

// --- Global Exposure & Toggles ---

// دالة التبديل للـ Checkbox
export function toggleStrategy(checkbox) {
    const name = checkbox.getAttribute('data-name');
    state.activeStrategies[name] = checkbox.checked;
}

export function switchTab(tabId) {
    const tabStats = document.getElementById('tab-stats');
    const tabStrategies = document.getElementById('tab-strategies');
    
    if (tabStats && tabStrategies) {
        tabStats.classList.add('hidden');
        tabStrategies.classList.add('hidden');
        document.getElementById('btn-stats').classList.remove('active');
        document.getElementById('btn-strategies').classList.remove('active');

        if (tabId === 'stats') {
            tabStats.classList.remove('hidden');
            document.getElementById('btn-stats').classList.add('active');
        } else {
            tabStrategies.classList.remove('hidden');
            document.getElementById('btn-strategies').classList.add('active');
        }
    }
}

export function updateChartView(view) {
    state.chartView = view;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderPriceMovementChart();
}

export function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove('active'); 
}

// تعريض الدوال لـ HTML
function exposeGlobalFunctions() {
    window.switchTab = switchTab;
    window.updateChartView = updateChartView;
    window.closeModal = closeModal;
    window.exportExcel = exportExcel;
    window.toggleStrategy = toggleStrategy;
    window.reCalculateStrategies = reCalculateStrategies;
}