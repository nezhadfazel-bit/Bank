// لاجیک اصلی سامانه شبیه‌ساز مالی، ارتباط با API، به‌روزرسانی کارت‌ها و جداول

let currentData = null;
let debounceTimer = null;

// تنظیمات پیش‌فرض
const currentModel = {
    totalPolicyValue: 100000000,
    customerInitialCash: 40000000,
    bankLoanAmount: 60000000,
    bankFeeRate: 0.065,
    bankBlockedDepositRate: 0.04,
    bankBlockedDepositDurationMonths: 12,
    bankLoanAnnualInterestRate: 0.23,
    bankLoanTenureMonths: 24,
    deductBankChargesFromLoanProceeds: true,
    insuranceUnderwritingFeeRate: 0.05,
    lifeCoverageFeeRate: 0.05,
    lifeCoverageCapital: 100000000,
    agentCommissionRate: 0.02,
    agentCommissionFromCustomer: true,
    fundAnnualReturnRate: 0.30,
    annualInflationRate: 0.40,
    simulationYears: 10,
    insuredAge: 35
};

// توابع فرمت‌بندی سراسری اعداد به ریال/تومان و درصد
function formatCurrency(val) {
    if (val === undefined || val === null) return '۰';
    return Number(Math.round(val)).toLocaleString('fa-IR') + ' تومان';
}

function formatNumber(val) {
    if (val === undefined || val === null) return '۰';
    return Number(Math.round(val)).toLocaleString('fa-IR');
}

function formatPercent(val) {
    if (val === undefined || val === null) return '۰٪';
    return Number(val.toFixed(1)).toLocaleString('fa-IR') + '٪';
}

if (typeof window !== 'undefined') {
    window.formatCurrency = formatCurrency;
    window.formatNumber = formatNumber;
    window.formatPercent = formatPercent;
}

// راه‌اندازی مطمئن اپلیکیشن در صورت آماده بودن قبلی DOM
function startApp() {
    initEventListeners();
    // اجرای آنی و بلادرنگ محاسبات کلاینت جهت نمایش لحظه‌ای تمام اعداد و نمودارها (۰ میلی‌ثانیه)
    try {
        const initialData = runLocalSimulationEngine(currentModel);
        currentData = initialData;
        renderDashboard(initialData);
    } catch (e) {
        console.error('Initial local render error:', e);
    }
    // تلاش برای دریافت از وب‌سرویس در صورت فعال بودن سرور .NET Core
    fetchSimulation();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    // سند قبلاً لود شده است
    startApp();
}

function initEventListeners() {
    // اتصال اسلایدرها و فیلدهای عددی
    bindInputPair('totalPolicyValue', 'totalPolicyValueSlider', val => Number(val));
    bindInputPair('customerInitialCash', 'customerInitialCashSlider', val => Number(val));
    bindInputPair('bankLoanAmount', 'bankLoanAmountSlider', val => Number(val));
    bindInputPair('bankFeeRate', 'bankFeeRateSlider', val => Number(val) / 100);
    bindInputPair('bankBlockedDepositRate', 'bankBlockedDepositRateSlider', val => Number(val) / 100);
    bindInputPair('bankLoanAnnualInterestRate', 'bankLoanAnnualInterestRateSlider', val => Number(val) / 100);
    bindInputPair('bankLoanTenureMonths', 'bankLoanTenureMonthsSlider', val => parseInt(val));
    bindInputPair('insuranceUnderwritingFeeRate', 'insuranceUnderwritingFeeRateSlider', val => Number(val) / 100);
    bindInputPair('lifeCoverageFeeRate', 'lifeCoverageFeeRateSlider', val => Number(val) / 100);
    bindInputPair('lifeCoverageCapital', 'lifeCoverageCapitalSlider', val => Number(val));
    bindInputPair('agentCommissionRate', 'agentCommissionRateSlider', val => Number(val) / 100);
    bindInputPair('fundAnnualReturnRate', 'fundAnnualReturnRateSlider', val => Number(val) / 100);
    bindInputPair('annualInflationRate', 'annualInflationRateSlider', val => Number(val) / 100);
    bindInputPair('simulationYears', 'simulationYearsSlider', val => parseInt(val));
    bindInputPair('insuredAge', 'insuredAgeSlider', val => parseInt(val));

    // چک‌باکس‌ها
    const deductCb = document.getElementById('deductBankChargesFromLoanProceeds');
    if (deductCb) {
        deductCb.addEventListener('change', (e) => {
            currentModel.deductBankChargesFromLoanProceeds = e.target.checked;
            triggerRecalculate();
        });
    }

    const agentCb = document.getElementById('agentCommissionFromCustomer');
    if (agentCb) {
        agentCb.addEventListener('change', (e) => {
            currentModel.agentCommissionFromCustomer = e.target.checked;
            triggerRecalculate();
        });
    }

    // تب‌ها
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');
        });
    });

    // آکاردئون‌های سایدبار
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.acc-icon');
            if (content.style.display === 'none') {
                content.style.display = 'flex';
                icon.textContent = '▼';
            } else {
                content.style.display = 'none';
                icon.textContent = '◀';
            }
        });
    });
}

function bindInputPair(propName, sliderId, parser) {
    const numInput = document.getElementById(propName);
    const slider = document.getElementById(sliderId);

    if (numInput && slider) {
        numInput.addEventListener('input', (e) => {
            slider.value = numInput.value;
            currentModel[propName] = parser(numInput.value);
            updateDisplayLabel(propName, numInput.value);
            triggerRecalculate();
        });

        slider.addEventListener('input', (e) => {
            numInput.value = slider.value;
            currentModel[propName] = parser(slider.value);
            updateDisplayLabel(propName, slider.value);
            triggerRecalculate();
        });
    }
}

function updateDisplayLabel(propName, value) {
    const displayEl = document.getElementById(`${propName}Val`);
    if (!displayEl) return;

    if (propName.includes('Rate')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + '٪';
    } else if (propName.includes('Amount') || propName.includes('Cash') || propName.includes('Value') || propName.includes('Capital')) {
        displayEl.textContent = (Number(value) / 1000000).toLocaleString('fa-IR') + ' م تومان';
    } else if (propName.includes('Months')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + ' ماه';
    } else if (propName.includes('Years')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + ' سال';
    } else if (propName.includes('Age')) {
        displayEl.textContent = Number(value).toLocaleString('fa-IR') + ' سال';
    }
}

function triggerRecalculate() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchSimulation();
    }, 250);
}

async function fetchSimulation() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const response = await fetch('/api/simulation/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentModel),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            currentData = data;
            renderDashboard(data);
            return;
        }
    } catch (err) {
        // در محیط‌های استاتیک نظیر Cloudflare Pages یا هنگام قطع سرور C#
    }

    // اجرای فوری موتور محاسبات درون‌برنامه‌ای (مخصوص Cloudflare Pages و حالت آفلاین)
    const clientData = runLocalSimulationEngine(currentModel);
    currentData = clientData;
    renderDashboard(clientData);
}

function renderDashboard(data) {
    if (!data) return;
    try { renderKPIs(data); } catch (e) { console.error('Error rendering KPIs:', e); }
    try { renderWaterfall(data); } catch (e) { console.error('Error rendering Waterfall:', e); }
    try { 
        if (typeof initOrUpdateCharts === 'function') {
            initOrUpdateCharts(data); 
            if (typeof Chart === 'undefined') {
                setTimeout(() => {
                    if (typeof initOrUpdateCharts === 'function' && typeof Chart !== 'undefined') {
                        initOrUpdateCharts(data);
                    }
                }, 400);
            }
        }
    } catch (e) { console.error('Error rendering Charts:', e); }
    try { renderCustomerStrategicAnalysis(data.customerAnalysis); } catch (e) { console.error('Error rendering Customer Analysis:', e); }
    try { renderBankStrategicAnalysis(data.bankAnalysis); } catch (e) { console.error('Error rendering Bank Analysis:', e); }
    try { renderInsuranceStrategicAnalysis(data.insuranceAnalysis); } catch (e) { console.error('Error rendering Insurance Analysis:', e); }
    try { renderComparisonMatrix(data); } catch (e) { console.error('Error rendering Comparison Matrix:', e); }
    try { renderMortalityTable(data); } catch (e) { console.error('Error rendering Mortality Table:', e); }
    try { renderYearlyTable(data); } catch (e) { console.error('Error rendering Yearly Table:', e); }
    try { renderSensitivityTable(data); } catch (e) { console.error('Error rendering Sensitivity Table:', e); }
    try { renderMonthlyTable(data); } catch (e) { console.error('Error rendering Monthly Table:', e); }
}

function renderKPIs(data) {
    // کارت نقطه سربه‌سر
    const beEl = document.getElementById('kpiBreakevenVal');
    const beSub = document.getElementById('kpiBreakevenSub');
    if (data.nominalBreakevenMonth) {
        const yr = Math.floor((data.nominalBreakevenMonth - 1) / 12) + 1;
        const mo = ((data.nominalBreakevenMonth - 1) % 12) + 1;
        beEl.innerHTML = `<span style="color: #059669;">ماه ${formatNumber(data.nominalBreakevenMonth)}</span>`;
        beSub.innerHTML = `معادل <strong>سال ${formatNumber(yr)} و ماه ${formatNumber(mo)}</strong> | سربه‌سر با تورم: <strong>${data.realBreakevenMonth ? 'ماه ' + formatNumber(data.realBreakevenMonth) : 'نامشخص'}</strong>`;
    } else {
        beEl.innerHTML = `<span style="color: #dc2626;">بیش از ۱۰ سال</span>`;
        beSub.innerHTML = `در این بازه هزینه اقساط و کارمزدها جبران نمی‌شود.`;
    }

    // کارت بازده مشتری
    const irrEl = document.getElementById('kpiIrrVal');
    const irrSub = document.getElementById('kpiIrrSub');
    irrEl.textContent = formatPercent(data.customerAnnualIRR * 100);
    irrSub.innerHTML = `بازده واقعی پس از کسر تورم: <strong>${formatPercent(data.customerRealIRR * 100)}</strong>`;

    // کارت دارایی نهایی
    const fundEl = document.getElementById('kpiFundVal');
    const fundSub = document.getElementById('kpiFundSub');
    fundEl.textContent = formatCurrency(data.customerFinalNominalFund);
    fundSub.innerHTML = `کل پرداختی: <strong>${formatCurrency(data.customerTotalPayments)}</strong> (سود: ${formatCurrency(data.customerNominalGain)})`;

    // کارت بانک
    const bankEl = document.getElementById('kpiBankVal');
    const bankSub = document.getElementById('kpiBankSub');
    bankEl.textContent = formatPercent(data.bankEffectiveAPR * 100);
    bankSub.innerHTML = `کل عایدی ناخالص: <strong>${formatCurrency(data.stakeholders.bankTotalGrossRevenue)}</strong> | ریسک نکول: <strong>صفر</strong>`;

    // کارت بیمه
    const insEl = document.getElementById('kpiInsVal');
    const insSub = document.getElementById('kpiInsSub');
    insEl.textContent = formatCurrency(data.stakeholders.insuranceNetMargin);
    insSub.innerHTML = `درآمد بیمه‌گری: <strong>${formatCurrency(data.stakeholders.insuranceUnderwritingIncome)}</strong> | خسارت انتظاری: <strong>${formatCurrency(data.stakeholders.insuranceExpectedClaimExpense)}</strong>`;
}

function renderWaterfall(data) {
    document.getElementById('wfCustomerCash').textContent = formatCurrency(data.customerInitialCash);
    document.getElementById('wfBankLoan').textContent = formatCurrency(data.bankLoanAmount);
    document.getElementById('wfBankFee').textContent = '-' + formatCurrency(data.bankFeeAmount);
    document.getElementById('wfBankBlocked').textContent = '-' + formatCurrency(data.bankBlockedDepositAmount);
    document.getElementById('wfUnderwriting').textContent = '-' + formatCurrency(data.insuranceUnderwritingFeeAmount);
    document.getElementById('wfLifeCover').textContent = '-' + formatCurrency(data.lifeCoverageFeeAmount);
    document.getElementById('wfAgentFee').textContent = '-' + formatCurrency(data.agentCommissionAmount);
    document.getElementById('wfNetFund').textContent = formatCurrency(data.netInitialFundDeposit);

    // اقساط ماهانه
    document.getElementById('wfMonthlyInstallment').textContent = formatCurrency(data.monthlyInstallment);
    document.getElementById('wfTotalInstallments').textContent = formatCurrency(data.totalInstallmentsAmount);
    document.getElementById('wfTotalInterest').textContent = formatCurrency(data.totalLoanInterestAmount);
}

function renderMortalityTable(data) {
    const tbody = document.getElementById('mortalityTableBody');
    tbody.innerHTML = '';
    data.mortalityScenarios.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>سال ${formatNumber(s.year)}</strong></td>
            <td>${formatCurrency(s.lifeInsuranceBenefit)}</td>
            <td>${formatCurrency(s.accumulatedFundValue)}</td>
            <td style="color: #dc2626;">${formatCurrency(s.remainingLoanToSettle)}</td>
            <td style="color: #059669; font-weight: 700;">${formatCurrency(s.netPayoutToFamily)}</td>
            <td>${formatCurrency(s.totalPremiumsAndInstallmentsPaid)}</td>
            <td><span class="tag-badge tag-primary">${formatNumber(s.netBenefitToFamilyRatio.toFixed(2))} برابر</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderYearlyTable(data) {
    const tbody = document.getElementById('yearlyTableBody');
    tbody.innerHTML = '';
    data.yearlySummaries.forEach(y => {
        const tr = document.createElement('tr');
        if (y.isBreakevenNominal) tr.classList.add('breakeven-row');
        tr.innerHTML = `
            <td><strong>سال ${formatNumber(y.year)}</strong></td>
            <td>${formatCurrency(y.cumulativePaid)}</td>
            <td>${formatCurrency(y.fundValueNominal)}</td>
            <td>${formatCurrency(y.remainingLoan)}</td>
            <td style="font-weight: 700;">${formatCurrency(y.netEquityNominal)}</td>
            <td style="color: #b45309;">${formatCurrency(y.netEquityReal)}</td>
            <td style="color: ${y.customerProfitNominal >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(y.customerProfitNominal)}</td>
            <td>${formatPercent(y.returnOnInvestmentNominalPct)}</td>
            <td>${y.isBreakevenNominal ? '<span class="tag-badge tag-success">سربه‌سر</span>' : '<span class="tag-badge tag-danger">دوره بازگشت</span>'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderSensitivityTable(data) {
    const tbody = document.getElementById('sensitivityTableBody');
    tbody.innerHTML = '';
    data.sensitivityAnalysis.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${formatPercent(p.fundReturnRate * 100)}</strong></td>
            <td>${formatPercent(p.loanInterestRate * 100)}</td>
            <td>${formatPercent(p.inflationRate * 100)}</td>
            <td>${p.breakevenMonthNominal ? 'ماه ' + formatNumber(p.breakevenMonthNominal) : '<span style="color: #dc2626;">نامشخص</span>'}</td>
            <td>${formatCurrency(p.customer5YearProfitNominal)}</td>
            <td style="font-weight: 700;">${formatCurrency(p.customer10YearProfitNominal)}</td>
            <td style="color: #b45309;">${formatCurrency(p.customer10YearRealAsset)}</td>
            <td style="color: #059669;">${formatPercent(p.customerIRR * 100)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderMonthlyTable(data) {
    const tbody = document.getElementById('monthlyTableBody');
    tbody.innerHTML = '';
    // نمایش ۳۶ ماه اول یا گزینش ماه‌ها
    const displayList = data.monthlySchedule.slice(0, 36);
    displayList.forEach(m => {
        const tr = document.createElement('tr');
        if (data.nominalBreakevenMonth === m.month) tr.classList.add('breakeven-row');
        tr.innerHTML = `
            <td>${formatNumber(m.month)}</td>
            <td>${formatCurrency(m.monthlyInstallment)}</td>
            <td>${formatCurrency(m.monthlyPrincipalPaid)}</td>
            <td>${formatCurrency(m.monthlyInterestPaid)}</td>
            <td>${formatCurrency(m.remainingLoanBalance)}</td>
            <td>${formatCurrency(m.fundValueEnding)}</td>
            <td style="font-weight: 700;">${formatCurrency(m.netSurrenderValue)}</td>
            <td>${formatCurrency(m.cumulativeCustomerOutflow)}</td>
            <td style="color: ${m.customerNominalProfitOrLoss >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(m.customerNominalProfitOrLoss)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// بارگذاری سناریوهای پیش‌فرض
function loadPreset(presetType, evt) {
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    const target = evt ? evt.target : (window.event && window.event.target ? window.event.target : null);
    if (target) target.classList.add('active');

    if (presetType === 'standard') {
        currentModel.bankLoanAnnualInterestRate = 0.23;
        currentModel.bankLoanTenureMonths = 24;
        currentModel.fundAnnualReturnRate = 0.30;
        currentModel.annualInflationRate = 0.40;
        currentModel.agentCommissionRate = 0.02;
    } else if (presetType === 'qard') {
        currentModel.bankLoanAnnualInterestRate = 0.04;
        currentModel.bankLoanTenureMonths = 36;
        currentModel.fundAnnualReturnRate = 0.28;
        currentModel.annualInflationRate = 0.40;
        currentModel.bankFeeRate = 0.04;
        currentModel.bankBlockedDepositRate = 0.0;
    } else if (presetType === 'hyper') {
        currentModel.bankLoanAnnualInterestRate = 0.23;
        currentModel.bankLoanTenureMonths = 24;
        currentModel.fundAnnualReturnRate = 0.45;
        currentModel.annualInflationRate = 0.55;
    } else if (presetType === 'direct') {
        currentModel.agentCommissionRate = 0.0;
        currentModel.bankLoanAnnualInterestRate = 0.23;
        currentModel.fundAnnualReturnRate = 0.32;
    }

    // به‌روزرسانی کنترل‌های ورودی در فرم
    syncFormInputs();
    fetchSimulation();
}

function syncFormInputs() {
    for (const [key, val] of Object.entries(currentModel)) {
        const input = document.getElementById(key);
        const slider = document.getElementById(key + 'Slider');
        let displayVal = val;

        if (key.includes('Rate')) {
            displayVal = val * 100;
        }

        if (input) input.value = displayVal;
        if (slider) slider.value = displayVal;
        updateDisplayLabel(key, displayVal);
    }
}

// خروجی اکسل / CSV
function exportToCsv() {
    if (!currentData || !currentData.monthlySchedule) return;
    let csvContent = "\uFEFFماه,قسط ماهانه,اصل قسط,سود قسط,مانده وام,ارزش صندوق,ارزش خالص بازخرید,کل پرداختی مشتری,سود اسمی\n";
    currentData.monthlySchedule.forEach(m => {
        csvContent += `${m.month},${m.monthlyInstallment},${m.monthlyPrincipalPaid},${m.monthlyInterestPaid},${m.remainingLoanBalance},${m.fundValueEnding},${m.netSurrenderValue},${m.cumulativeCustomerOutflow},${m.customerNominalProfitOrLoss}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bancassurance_simulation.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// رندر بخش تحلیل استراتژیک بیمه‌گذار (مشتری)
function renderCustomerStrategicAnalysis(cust) {
    if (!cust) return;
    const el = id => document.getElementById(id);

    if (el('custStatInitialCash')) el('custStatInitialCash').textContent = formatCurrency(cust.initialCashOutlay);
    if (el('custStatLeverage')) el('custStatLeverage').textContent = formatNumber(cust.initialLeverageRatio.toFixed(1)) + ' برابر';
    if (el('custStatNominalIrr')) el('custStatNominalIrr').textContent = formatPercent(cust.nominalIRR * 100);
    if (el('custStatRealIrr')) el('custStatRealIrr').textContent = formatPercent(cust.realIRR * 100);
    if (el('custStatBreakeven')) el('custStatBreakeven').textContent = cust.nominalBreakevenMonth ? `ماه ${formatNumber(cust.nominalBreakevenMonth)}` : 'بیش از ۱۰ سال';
    if (el('custStatFinalWealth')) el('custStatFinalWealth').textContent = formatCurrency(cust.finalNominalWealth);

    // هشدارهای فعال
    const warnBox = el('custActiveWarningsBox');
    const warnList = el('custWarningsList');
    if (warnBox && warnList) {
        warnList.innerHTML = '';
        if (cust.criticalWarnings && cust.criticalWarnings.length > 0) {
            warnBox.style.display = 'block';
            cust.criticalWarnings.forEach(w => {
                const li = document.createElement('li');
                li.textContent = w;
                warnList.appendChild(li);
            });
        } else {
            warnBox.style.display = 'none';
        }
    }

    // مزایا
    const prosContainer = el('custProsContainer');
    if (prosContainer) {
        prosContainer.innerHTML = '';
        cust.advantages.forEach(a => {
            const card = document.createElement('div');
            card.className = 'strategic-card pros-card';
            card.innerHTML = `
                <div class="card-top-meta">
                    <span class="card-category">${a.category}</span>
                    <span class="impact-badge ${getImpactClass(a.impactLevel)}">${a.impactLevel}</span>
                </div>
                <div class="strategic-title">✨ ${a.title}</div>
                <div class="strategic-desc">${a.description}</div>
                ${a.monetaryValue ? `<div class="strategic-monetary">ارزش اهرمی / مالی: ${formatCurrency(a.monetaryValue)}</div>` : ''}
            `;
            prosContainer.appendChild(card);
        });
    }

    // معایب و ریسک‌ها
    const consContainer = el('custConsContainer');
    if (consContainer) {
        consContainer.innerHTML = '';
        cust.disadvantagesAndRisks.forEach(r => {
            const card = document.createElement('div');
            card.className = 'strategic-card cons-card';
            card.innerHTML = `
                <div class="card-top-meta">
                    <span class="card-category">${r.category}</span>
                    <span class="impact-badge ${getImpactClass(r.impactLevel)}">${r.impactLevel}</span>
                </div>
                <div class="strategic-title">⚠️ ${r.title}</div>
                <div class="strategic-desc">${r.description}</div>
                ${r.monetaryValue ? `<div class="strategic-monetary" style="color: #991b1b; background: #fee2e2;">مبلغ در معرض تعهد: ${formatCurrency(r.monetaryValue)}</div>` : ''}
            `;
            consContainer.appendChild(card);
        });
    }

    // توصیه‌ها
    const recsList = el('custRecommendationsList');
    if (recsList) {
        recsList.innerHTML = '';
        cust.strategicRecommendations.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recsList.appendChild(li);
        });
    }
}

// رندر بخش تحلیل استراتژیک بانک
function renderBankStrategicAnalysis(bank) {
    if (!bank) return;
    const el = id => document.getElementById(id);

    if (el('bankStatPrincipal')) el('bankStatPrincipal').textContent = formatCurrency(bank.loanPrincipalGranted);
    if (el('bankStatUpfrontFee')) el('bankStatUpfrontFee').textContent = formatCurrency(bank.upfrontFeeCollected);
    if (el('bankStatBlockedBenefit')) el('bankStatBlockedBenefit').textContent = formatCurrency(bank.blockedDepositBenefit);
    if (el('bankStatTotalInterest')) el('bankStatTotalInterest').textContent = formatCurrency(bank.totalInterestRevenue);
    if (el('bankStatTotalRevenue')) el('bankStatTotalRevenue').textContent = formatCurrency(bank.totalGrossRevenue);
    if (el('bankStatApr')) el('bankStatApr').textContent = formatPercent(bank.effectiveAnnualYieldAPR * 100);

    // هشدارهای فعال
    const warnBox = el('bankActiveWarningsBox');
    const warnList = el('bankWarningsList');
    if (warnBox && warnList) {
        warnList.innerHTML = '';
        if (bank.criticalWarnings && bank.criticalWarnings.length > 0) {
            warnBox.style.display = 'block';
            bank.criticalWarnings.forEach(w => {
                const li = document.createElement('li');
                li.textContent = w;
                warnList.appendChild(li);
            });
        } else {
            warnBox.style.display = 'none';
        }
    }

    // مزایا
    const prosContainer = el('bankProsContainer');
    if (prosContainer) {
        prosContainer.innerHTML = '';
        bank.advantages.forEach(a => {
            const card = document.createElement('div');
            card.className = 'strategic-card pros-card';
            card.innerHTML = `
                <div class="card-top-meta">
                    <span class="card-category">${a.category}</span>
                    <span class="impact-badge ${getImpactClass(a.impactLevel)}">${a.impactLevel}</span>
                </div>
                <div class="strategic-title">✨ ${a.title}</div>
                <div class="strategic-desc">${a.description}</div>
                ${a.monetaryValue ? `<div class="strategic-monetary">عایدی / منفعت بانک: ${formatCurrency(a.monetaryValue)}</div>` : ''}
            `;
            prosContainer.appendChild(card);
        });
    }

    // معایب و ریسک‌ها
    const consContainer = el('bankConsContainer');
    if (consContainer) {
        consContainer.innerHTML = '';
        bank.disadvantagesAndRisks.forEach(r => {
            const card = document.createElement('div');
            card.className = 'strategic-card cons-card';
            card.innerHTML = `
                <div class="card-top-meta">
                    <span class="card-category">${r.category}</span>
                    <span class="impact-badge ${getImpactClass(r.impactLevel)}">${r.impactLevel}</span>
                </div>
                <div class="strategic-title">⚠️ ${r.title}</div>
                <div class="strategic-desc">${r.description}</div>
                ${r.monetaryValue ? `<div class="strategic-monetary" style="color: #991b1b; background: #fee2e2;">منابع درگیر: ${formatCurrency(r.monetaryValue)}</div>` : ''}
            `;
            consContainer.appendChild(card);
        });
    }

    // توصیه‌ها
    const recsList = el('bankRecommendationsList');
    if (recsList) {
        recsList.innerHTML = '';
        bank.strategicRecommendations.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recsList.appendChild(li);
        });
    }
}

// رندر ماتریس مقایسه سه‌جانبه (P&L)
function renderComparisonMatrix(data) {
    if (!data) return;
    const el = id => document.getElementById(id);
    if (el('compCustCash')) el('compCustCash').textContent = formatCurrency(data.customerInitialCash) + ' آورده نقد';
    if (el('compBankLoan')) el('compBankLoan').textContent = formatCurrency(data.bankLoanAmount) + ' تسهیلات';
    if (el('compBankUpfront')) el('compBankUpfront').textContent = formatCurrency(data.bankFeeAmount) + ' کارمزد نقد پرونده';
    if (el('compInsUpfront')) el('compInsUpfront').textContent = formatCurrency(data.insuranceUnderwritingFeeAmount) + ' کارمزد بیمه‌گری ۵٪';
    if (el('compCustProfit')) el('compCustProfit').textContent = formatCurrency(data.customerNominalGain);
    if (el('compBankRevenue')) el('compBankRevenue').textContent = formatCurrency(data.stakeholders.bankTotalGrossRevenue);
    if (el('compInsProfit')) el('compInsProfit').textContent = formatCurrency(data.stakeholders.insuranceNetMargin);
    if (el('compCustIrr')) el('compCustIrr').textContent = formatPercent(data.customerAnnualIRR * 100) + ' اسمی (' + formatPercent(data.customerRealIRR * 100) + ' واقعی)';
    if (el('compBankApr')) el('compBankApr').textContent = formatPercent(data.bankEffectiveAPR * 100) + ' سالانه (ریسک صفر)';
    if (el('compInsMargin')) el('compInsMargin').textContent = (data.insuranceAnalysis && data.insuranceAnalysis.profitMarginPercentage ? formatPercent(data.insuranceAnalysis.profitMarginPercentage) : '۲۶٪') + ' حاشیه سود پورتفو';
}

// رندر بخش تحلیل استراتژیک شرکت بیمه
function renderInsuranceStrategicAnalysis(ins) {
    if (!ins) return;

    // آمار بالای تب
    document.getElementById('insStatInflow').textContent = formatCurrency(ins.upfrontCashInflow);
    document.getElementById('insStatUnderwriting').textContent = formatCurrency(ins.immediateRiskFreeProfit);
    document.getElementById('insStatAum').textContent = formatCurrency(ins.longTermManagementFees);
    document.getElementById('insStatNetProfit').textContent = formatCurrency(ins.netProfitAfterClaimsAndExpenses);
    document.getElementById('insStatCoverageY1').textContent = formatPercent(ins.year1CoverageRatio);
    document.getElementById('insStatSafeMonth').textContent = ins.monthsToFullCollateralCoverage > 0 
        ? `ماه ${formatNumber(ins.monthsToFullCollateralCoverage)}` 
        : 'از بدو شروع';

    // هشدارهای بحرانی
    const warnBox = document.getElementById('insActiveWarningsBox');
    const warnList = document.getElementById('insWarningsList');
    warnList.innerHTML = '';
    if (ins.criticalWarnings && ins.criticalWarnings.length > 0) {
        warnBox.style.display = 'block';
        ins.criticalWarnings.forEach(w => {
            const li = document.createElement('li');
            li.textContent = w;
            warnList.appendChild(li);
        });
    } else {
        warnBox.style.display = 'none';
    }

    // مزایا
    const prosContainer = document.getElementById('insProsContainer');
    prosContainer.innerHTML = '';
    ins.advantages.forEach(a => {
        const card = document.createElement('div');
        card.className = 'strategic-card pros-card';
        card.innerHTML = `
            <div class="card-top-meta">
                <span class="card-category">${a.category}</span>
                <span class="impact-badge ${getImpactClass(a.impactLevel)}">${a.impactLevel}</span>
            </div>
            <div class="strategic-title">✨ ${a.title}</div>
            <div class="strategic-desc">${a.description}</div>
            ${a.monetaryValue ? `<div class="strategic-monetary">عایدی مالی: ${formatCurrency(a.monetaryValue)}</div>` : ''}
        `;
        prosContainer.appendChild(card);
    });

    // معایب و ریسک‌ها
    const consContainer = document.getElementById('insConsContainer');
    consContainer.innerHTML = '';
    ins.disadvantagesAndRisks.forEach(r => {
        const card = document.createElement('div');
        card.className = 'strategic-card cons-card';
        card.innerHTML = `
            <div class="card-top-meta">
                <span class="card-category">${r.category}</span>
                <span class="impact-badge ${getImpactClass(r.impactLevel)}">${r.impactLevel}</span>
            </div>
            <div class="strategic-title">⚠️ ${r.title}</div>
            <div class="strategic-desc">${r.description}</div>
            ${r.monetaryValue ? `<div class="strategic-monetary" style="color: #991b1b; background: #fee2e2;">ریسک مالی در معرض: ${formatCurrency(r.monetaryValue)}</div>` : ''}
        `;
        consContainer.appendChild(card);
    });

    // توصیه‌ها
    const recsList = document.getElementById('insRecommendationsList');
    recsList.innerHTML = '';
    ins.strategicRecommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recsList.appendChild(li);
    });
}

function getImpactClass(level) {
    if (level === 'بحرانی' || level === 'Critical') return 'critical';
    if (level === 'بالا' || level === 'بسیار بالا' || level === 'High') return 'high';
    if (level === 'متوسط' || level === 'Medium') return 'medium';
    return 'low';
}

// ==========================================
// موتور محاسبات مالی و اکچوئری کلاینت‌ساید (Cloudflare Pages Engine)
// ==========================================
function runLocalSimulationEngine(input) {
    const result = {
        totalPolicyNominalValue: input.totalPolicyValue,
        customerInitialCash: input.customerInitialCash,
        bankLoanAmount: input.bankLoanAmount,
        bankFeeAmount: input.bankLoanAmount * input.bankFeeRate,
        bankBlockedDepositAmount: input.bankLoanAmount * input.bankBlockedDepositRate,
        insuranceUnderwritingFeeAmount: input.totalPolicyValue * input.insuranceUnderwritingFeeRate,
        lifeCoverageFeeAmount: input.totalPolicyValue * input.lifeCoverageFeeRate,
        agentCommissionAmount: input.totalPolicyValue * input.agentCommissionRate,
    };

    let netLoan = input.bankLoanAmount;
    let customerInitialOutflow = input.customerInitialCash;

    if (input.deductBankChargesFromLoanProceeds) {
        netLoan -= (result.bankFeeAmount + result.bankBlockedDepositAmount);
    } else {
        customerInitialOutflow += (result.bankFeeAmount + result.bankBlockedDepositAmount);
    }

    let upfrontDeductions = result.insuranceUnderwritingFeeAmount + result.lifeCoverageFeeAmount;
    if (input.agentCommissionFromCustomer) {
        upfrontDeductions += result.agentCommissionAmount;
    }

    result.netInitialFundDeposit = Math.max(0, (input.customerInitialCash + netLoan) - upfrontDeductions);
    result.effectiveCustomerInitialPayment = customerInitialOutflow;

    const n = Math.max(1, input.bankLoanTenureMonths);
    const monthlyLoanRate = input.bankLoanAnnualInterestRate / 12.0;
    let monthlyInstallment = 0;

    if (monthlyLoanRate <= 0.000001) {
        monthlyInstallment = input.bankLoanAmount / n;
    } else {
        const r = monthlyLoanRate;
        monthlyInstallment = input.bankLoanAmount * (r * Math.pow(1.0 + r, n)) / (Math.pow(1.0 + r, n) - 1.0);
    }

    result.monthlyInstallment = monthlyInstallment;
    result.totalInstallmentsAmount = monthlyInstallment * n;
    result.totalLoanInterestAmount = Math.max(0, result.totalInstallmentsAmount - input.bankLoanAmount);

    const totalMonths = Math.max(1, input.simulationYears * 12);
    const monthlyFundReturnRate = Math.pow(1.0 + input.fundAnnualReturnRate, 1.0 / 12.0) - 1.0;
    const monthlyInflationRate = Math.pow(1.0 + input.annualInflationRate, 1.0 / 12.0) - 1.0;

    let currentFundValue = result.netInitialFundDeposit;
    let currentLoanBalance = input.bankLoanAmount;
    let cumulativePaid = customerInitialOutflow;
    let cumulativeDiscountedPaid = customerInitialOutflow;

    let nominalBreakevenMonth = null;
    let realBreakevenMonth = null;

    const monthlySchedule = [];
    const customerCashFlows = [-customerInitialOutflow];

    for (let m = 1; m <= totalMonths; m++) {
        let installmentThisMonth = 0;
        let principalThisMonth = 0;
        let interestThisMonth = 0;

        if (m <= n && currentLoanBalance > 0) {
            interestThisMonth = currentLoanBalance * monthlyLoanRate;
            if (m === n) {
                principalThisMonth = currentLoanBalance;
                installmentThisMonth = principalThisMonth + interestThisMonth;
                currentLoanBalance = 0;
            } else {
                principalThisMonth = Math.min(currentLoanBalance, monthlyInstallment - interestThisMonth);
                installmentThisMonth = principalThisMonth + interestThisMonth;
                currentLoanBalance = Math.max(0, currentLoanBalance - principalThisMonth);
                if (currentLoanBalance < 0.01) currentLoanBalance = 0;
            }
        }

        cumulativePaid += installmentThisMonth;
        customerCashFlows.push(-installmentThisMonth);

        const fundBeginning = currentFundValue;
        const fundReturn = currentFundValue * monthlyFundReturnRate;
        currentFundValue += fundReturn;

        if (m === input.bankBlockedDepositDurationMonths && input.deductBankChargesFromLoanProceeds) {
            currentFundValue += result.bankBlockedDepositAmount;
        }

        const netSurrender = Math.max(0, currentFundValue - currentLoanBalance);
        const profitNominal = netSurrender - cumulativePaid;
        const profitPct = cumulativePaid > 0 ? (profitNominal / cumulativePaid) * 100 : 0;

        const inflationFactor = Math.pow(1.0 + monthlyInflationRate, -m);
        const netSurrenderReal = netSurrender * inflationFactor;

        if (installmentThisMonth > 0) {
            cumulativeDiscountedPaid += installmentThisMonth * inflationFactor;
        }
        const profitReal = netSurrenderReal - cumulativeDiscountedPaid;

        if (nominalBreakevenMonth === null && netSurrender >= cumulativePaid) {
            nominalBreakevenMonth = m;
        }
        if (realBreakevenMonth === null && netSurrenderReal >= cumulativeDiscountedPaid) {
            realBreakevenMonth = m;
        }

        monthlySchedule.push({
            month: m,
            year: Math.floor((m - 1) / 12) + 1,
            monthlyInstallment: installmentThisMonth,
            monthlyPrincipalPaid: principalThisMonth,
            monthlyInterestPaid: interestThisMonth,
            remainingLoanBalance: currentLoanBalance,
            cumulativeLoanPaid: cumulativePaid - customerInitialOutflow,
            cumulativeCustomerOutflow: cumulativePaid,
            fundValueBeginning: fundBeginning,
            monthlyFundReturn: fundReturn,
            fundValueEnding: currentFundValue,
            netSurrenderValue: netSurrender,
            customerNominalProfitOrLoss: profitNominal,
            customerProfitPercentage: profitPct,
            inflationDiscountFactor: inflationFactor,
            cumulativeCustomerOutflowReal: cumulativeDiscountedPaid,
            netSurrenderValueReal: netSurrenderReal,
            customerRealProfitOrLoss: profitReal,
            totalDeathPayoutToBeneficiaries: Math.max(0, input.lifeCoverageCapital + currentFundValue - currentLoanBalance)
        });
    }

    result.monthlySchedule = monthlySchedule;
    result.nominalBreakevenMonth = nominalBreakevenMonth;
    result.realBreakevenMonth = realBreakevenMonth;

    if (nominalBreakevenMonth) {
        const yr = Math.floor((nominalBreakevenMonth - 1) / 12) + 1;
        const mo = ((nominalBreakevenMonth - 1) % 12) + 1;
        result.breakevenStatusMessage = `سرمایه‌گذاری در ماه ${nominalBreakevenMonth} (سال ${yr}، ماه ${mo}) به نقطه سربه‌سر اسمی می‌رسد.`;
    } else {
        result.breakevenStatusMessage = "در بازه زمانی انتخابی، نقطه سربه‌سر اسمی محقق نمی‌شود.";
    }

    // خلاصه‌های سالانه
    const yearlySummaries = [];
    for (let y = 1; y <= input.simulationYears; y++) {
        const tIdx = (y * 12) - 1;
        if (tIdx < monthlySchedule.length) {
            const mItem = monthlySchedule[tIdx];
            yearlySummaries.push({
                year: y,
                cumulativePaid: mItem.cumulativeCustomerOutflow,
                fundValueNominal: mItem.fundValueEnding,
                remainingLoan: mItem.remainingLoanBalance,
                netEquityNominal: mItem.netSurrenderValue,
                netEquityReal: mItem.netSurrenderValueReal,
                customerProfitNominal: mItem.customerNominalProfitOrLoss,
                customerProfitReal: mItem.customerRealProfitOrLoss,
                returnOnInvestmentNominalPct: mItem.customerProfitPercentage,
                returnOnInvestmentRealPct: mItem.cumulativeCustomerOutflowReal > 0 ? (mItem.customerRealProfitOrLoss / mItem.cumulativeCustomerOutflowReal) * 100 : 0,
                isBreakevenNominal: nominalBreakevenMonth !== null && (y * 12) >= nominalBreakevenMonth,
                isBreakevenReal: realBreakevenMonth !== null && (y * 12) >= realBreakevenMonth,
                deathBenefitNet: mItem.totalDeathPayoutToBeneficiaries
            });
        }
    }
    result.yearlySummaries = yearlySummaries;

    const finalItem = monthlySchedule[monthlySchedule.length - 1];
    result.customerFinalNominalFund = finalItem.netSurrenderValue;
    result.customerTotalPayments = finalItem.cumulativeCustomerOutflow;
    result.customerNominalGain = finalItem.customerNominalProfitOrLoss;
    result.customerRealGain = finalItem.customerRealProfitOrLoss;
    result.customerNominalROI = finalItem.customerProfitPercentage;

    customerCashFlows[customerCashFlows.length - 1] += finalItem.netSurrenderValue;
    result.customerAnnualIRR = calcIrrBisection(customerCashFlows);
    result.customerRealIRR = ((1.0 + result.customerAnnualIRR) / (1.0 + input.annualInflationRate)) - 1.0;

    // سود و زیان ذی‌نفعان
    const pnl = {
        customerTotalOutflows: finalItem.cumulativeCustomerOutflow,
        customerFinalNominalAsset: finalItem.netSurrenderValue,
        customerFinalRealAsset: finalItem.netSurrenderValueReal,
        customerNominalNetGain: finalItem.customerNominalProfitOrLoss,
        customerRealNetGain: finalItem.customerRealProfitOrLoss,
        customerAnnualizedIRR: result.customerAnnualIRR,

        bankUpfrontFeeIncome: result.bankFeeAmount,
        bankInterestIncome: result.totalLoanInterestAmount,
        bankBlockedDepositBenefit: result.bankBlockedDepositAmount * input.bankLoanAnnualInterestRate,
        bankTotalGrossRevenue: result.bankFeeAmount + result.totalLoanInterestAmount + (result.bankBlockedDepositAmount * input.bankLoanAnnualInterestRate),
        bankDefaultRiskLevel: 0
    };

    const bankFlows = [-(input.bankLoanAmount - result.bankFeeAmount)];
    for (let bm = 1; bm <= n; bm++) {
        let flow = monthlyInstallment;
        if (bm === input.bankBlockedDepositDurationMonths) {
            flow -= result.bankBlockedDepositAmount;
        }
        bankFlows.push(flow);
    }
    pnl.bankEffectiveAnnualYield = calcIrrBisection(bankFlows);
    result.bankEffectiveAPR = pnl.bankEffectiveAnnualYield;

    pnl.insuranceUnderwritingIncome = result.insuranceUnderwritingFeeAmount;
    pnl.insuranceMortalityCoverageIncome = result.lifeCoverageFeeAmount;
    const avgFund = monthlySchedule.reduce((s, x) => s + x.fundValueEnding, 0) / monthlySchedule.length;
    pnl.insuranceFundManagementIncome = avgFund * 0.005 * input.simulationYears;
    pnl.insuranceAgentCommissionExpense = result.agentCommissionAmount;

    const annualMort = estimateMortalityRate(input.insuredAge);
    const cumMort = 1.0 - Math.pow(1.0 - annualMort, input.simulationYears);
    pnl.insuranceExpectedClaimExpense = input.lifeCoverageCapital * cumMort;
    pnl.insuranceNetMargin = (pnl.insuranceUnderwritingIncome + pnl.insuranceMortalityCoverageIncome + pnl.insuranceFundManagementIncome)
                            - (pnl.insuranceAgentCommissionExpense + pnl.insuranceExpectedClaimExpense);

    result.stakeholders = pnl;

    // سناریوهای فوت
    result.mortalityScenarios = [1, 2, 3, 5, 10].filter(y => y <= input.simulationYears).map(yr => {
        const mIdx = (yr * 12) - 1;
        const mItem = monthlySchedule[mIdx];
        const netPayout = input.lifeCoverageCapital + mItem.fundValueEnding - mItem.remainingLoanBalance;
        return {
            year: yr,
            lifeInsuranceBenefit: input.lifeCoverageCapital,
            accumulatedFundValue: mItem.fundValueEnding,
            remainingLoanToSettle: mItem.remainingLoanBalance,
            netPayoutToFamily: netPayout,
            totalPremiumsAndInstallmentsPaid: mItem.cumulativeCustomerOutflow,
            netBenefitToFamilyRatio: mItem.cumulativeCustomerOutflow > 0 ? (netPayout / mItem.cumulativeCustomerOutflow) : 0
        };
    });

    // ماتریس تحلیل حساسیت
    result.sensitivityAnalysis = generateLocalSensitivity(input);

    // تحلیل‌های استراتژیک، مزایا، معایب و ریسک‌ها از ۳ زاویه (بیمه‌گذار، بانک، شرکت بیمه)
    result.customerAnalysis = generateLocalCustomerStrategic(input, result, monthlySchedule, yearlySummaries, pnl);
    result.bankAnalysis = generateLocalBankStrategic(input, result, monthlySchedule, yearlySummaries, pnl);
    result.insuranceAnalysis = generateLocalInsuranceStrategic(input, result, monthlySchedule, pnl);

    return result;
}

function calcIrrBisection(cashFlows) {
    if (cashFlows.length < 2) return 0;
    const hasPos = cashFlows.some(c => c > 0);
    const hasNeg = cashFlows.some(c => c < 0);
    if (!hasPos || !hasNeg) return 0;

    let low = -0.5;
    let high = 1.0;
    const tolerance = 1e-6;

    const npv = (rate) => {
        let sum = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            sum += cashFlows[t] / Math.pow(1.0 + rate, t);
        }
        return sum;
    };

    let npvLow = npv(low);
    let npvHigh = npv(high);
    if (npvLow * npvHigh > 0) return 0.25;

    for (let iter = 0; iter < 80; iter++) {
        const mid = (low + high) / 2.0;
        const npvMid = npv(mid);
        if (Math.abs(npvMid) < tolerance || (high - low) / 2.0 < tolerance) {
            return Math.pow(1.0 + mid, 12.0) - 1.0;
        }
        if (npvLow * npvMid <= 0) {
            high = mid;
            npvHigh = npvMid;
        } else {
            low = mid;
            npvLow = npvMid;
        }
    }
    return Math.pow(1.0 + ((low + high) / 2.0), 12.0) - 1.0;
}

function estimateMortalityRate(age) {
    if (age < 30) return 0.0012;
    if (age < 40) return 0.0020;
    if (age < 50) return 0.0045;
    if (age < 60) return 0.0095;
    return 0.0180;
}

function generateLocalSensitivity(baseInput) {
    const list = [];
    const returns = [0.22, 0.28, 0.35, 0.42];
    const inflations = [0.30, 0.40, 0.50];

    returns.forEach(fr => {
        inflations.forEach(inf => {
            const clone = Object.assign({}, baseInput, { fundAnnualReturnRate: fr, annualInflationRate: inf, simulationYears: 10 });
            const sim = runQuickSim(clone);
            list.push({
                fundReturnRate: fr,
                loanInterestRate: clone.bankLoanAnnualInterestRate,
                inflationRate: inf,
                breakevenMonthNominal: sim.be,
                customer5YearProfitNominal: sim.p5,
                customer10YearProfitNominal: sim.p10,
                customer10YearRealAsset: sim.r10,
                customerIRR: sim.irr
            });
        });
    });
    return list;
}

function runQuickSim(input) {
    const bankFee = input.bankLoanAmount * input.bankFeeRate;
    const bankBlocked = input.bankLoanAmount * input.bankBlockedDepositRate;
    const netLoan = input.deductBankChargesFromLoanProceeds ? input.bankLoanAmount - bankFee - bankBlocked : input.bankLoanAmount;
    const deductions = (input.totalPolicyValue * input.insuranceUnderwritingFeeRate) +
                       (input.totalPolicyValue * input.lifeCoverageFeeRate) +
                       (input.agentCommissionFromCustomer ? input.totalPolicyValue * input.agentCommissionRate : 0);

    const initialFund = Math.max(0, (input.customerInitialCash + netLoan) - deductions);
    const initialPaid = input.deductBankChargesFromLoanProceeds ? input.customerInitialCash : input.customerInitialCash + bankFee + bankBlocked;

    const n = Math.max(1, input.bankLoanTenureMonths);
    const monthlyRate = input.bankLoanAnnualInterestRate / 12.0;
    const pmt = monthlyRate <= 0 ? input.bankLoanAmount / n : (input.bankLoanAmount * (monthlyRate * Math.pow(1.0 + monthlyRate, n)) / (Math.pow(1.0 + monthlyRate, n) - 1.0));

    const monthlyFundReturn = Math.pow(1.0 + input.fundAnnualReturnRate, 1.0 / 12.0) - 1.0;
    const monthlyInf = Math.pow(1.0 + input.annualInflationRate, 1.0 / 12.0) - 1.0;

    let fund = initialFund;
    let loan = input.bankLoanAmount;
    let paid = initialPaid;

    let be = null;
    let p5 = 0;
    let p10 = 0;
    let r10 = 0;
    const cfs = [-initialPaid];

    for (let m = 1; m <= 120; m++) {
        let inst = 0;
        if (m <= n && loan > 0) {
            const interest = loan * monthlyRate;
            const principal = Math.min(loan, pmt - interest);
            inst = principal + interest;
            loan -= principal;
        }

        paid += inst;
        cfs.push(-inst);

        fund += fund * monthlyFundReturn;
        if (m === input.bankBlockedDepositDurationMonths && input.deductBankChargesFromLoanProceeds) {
            fund += bankBlocked;
        }

        const netSurrender = Math.max(0, fund - loan);
        if (be === null && netSurrender >= paid) be = m;

        if (m === 60) p5 = netSurrender - paid;
        if (m === 120) {
            p10 = netSurrender - paid;
            const df = Math.pow(1.0 + monthlyInf, -120);
            r10 = netSurrender * df;
            cfs[cfs.length - 1] += netSurrender;
        }
    }

    const irr = calcIrrBisection(cfs);
    return { be, p5, p10, r10, irr };
}

function generateLocalCustomerStrategic(input, result, monthlySchedule, yearlySummaries, pnl) {
    const lastItem = monthlySchedule[monthlySchedule.length - 1];
    const analysis = {
        initialCashOutlay: result.effectiveCustomerInitialPayment,
        totalPayments: result.customerTotalPayments,
        finalNominalWealth: result.customerFinalNominalFund,
        finalRealPurchasingPower: lastItem ? lastItem.netSurrenderValueReal : 0,
        nominalIRR: result.customerAnnualIRR,
        realIRR: result.customerRealIRR,
        nominalBreakevenMonth: result.nominalBreakevenMonth,
        realBreakevenMonth: result.realBreakevenMonth,
        initialLeverageRatio: input.customerInitialCash > 0 ? (input.totalPolicyValue / input.customerInitialCash) : 0,
        advantages: [],
        disadvantagesAndRisks: [],
        criticalWarnings: [],
        strategicRecommendations: []
    };

    // ۱. مزایا و فرصت‌های بیمه‌گذار
    analysis.advantages.push({
        title: "اهرم مالی ۲.۵ برابری در نقطه شروع (Financial Leverage)",
        category: "تأمین مالی و سرمایه‌گذاری",
        impactLevel: "بسیار بالا",
        monetaryValue: input.bankLoanAmount,
        description: `مشتری با پرداخت تنها ${formatCurrency(input.customerInitialCash)} آورده نقدی، از طریق وام ${formatCurrency(input.bankLoanAmount)} بانک، صاحب یک سرمایه‌گذاری ${formatCurrency(input.totalPolicyValue)} می‌شود که بازدهی مرکب آن از روز اول روی کل سرمایه محاسبه می‌گردد.`
    });

    analysis.advantages.push({
        title: "دریافت تسهیلات بانکی بدون نیاز به ضامن و چک تضمین",
        category: "سهولت اعتباری",
        impactLevel: "بالا",
        description: "تسهیلات بانکی با وثیقه‌گذاری خود بیمه‌نامه و تعهد رسمی شرکت بیمه پرداخت می‌شود و بیمه‌گذار نیازی به معرفی ضامن کارمند، چک صیادی تضمین یا وثیقه‌گذاری ملکی ندارد."
    });

    analysis.advantages.push({
        title: "پوشش حمایتی بیمه عمر و تسویه خودکار وام در صورت فوت",
        category: "امنیت خانواده و پوشش بیمه‌ای",
        impactLevel: "بسیار بالا",
        monetaryValue: input.lifeCoverageCapital,
        description: `در صورت فوت ناگهانی، خانواده علاوه بر دریافت سرمایه فوت ${formatCurrency(input.lifeCoverageCapital)} و اندوخته خالص، از بازپرداخت اقساط وام معاف بوده و مانده بدهی مستقیماً توسط بیمه با بانک تسویه می‌شود.`
    });

    analysis.advantages.push({
        title: "سود مرکب بلندمدت و انباشت ثروت بازنشستگی",
        category: "رشد دارایی",
        impactLevel: "بالا",
        monetaryValue: result.customerNominalGain,
        description: `با تسویه اقساط در ماه ${input.bankLoanTenureMonths}، کل اندوخته صندوق به صورت تصاعدی رشد کرده و ثروت اسمی نهایی به ${formatCurrency(result.customerFinalNominalFund)} می‌رسد که سودی معادل ${formatCurrency(result.customerNominalGain)} را رقم می‌زند.`
    });

    // ۲. معایب، ریسک‌ها و چالش‌های بیمه‌گذار
    analysis.disadvantagesAndRisks.push({
        title: "فشار نقدینگی اقساط ماهانه در ۲ سال اول",
        category: "جریان نقدی و تعهد ماهانه",
        impactLevel: "بالا",
        monetaryValue: result.monthlyInstallment,
        description: `بیمه‌گذار موظف به پرداخت ماهانه ${formatCurrency(result.monthlyInstallment)} قسط وام به مدت ${input.bankLoanTenureMonths} ماه است که عدم پرداخت به‌موقع، مشمول جریمه دیرکرد بانکی خواهد شد.`
    });

    analysis.disadvantagesAndRisks.push({
        title: "زیان مالی در صورت انصراف و بازخرید پیش از موعد در ۲۴ ماه نخست",
        category: "نقدشوندگی و دوره بازگشت",
        impactLevel: "بحرانی",
        description: `در ماه‌های ابتدایی به دلیل کسر کارمزدهای اولیه بیمه و بانک، ارزش بازخرید کمتر از مجموع پرداختی‌هاست. نقطه سربه‌سر اسمی در ماه ${result.nominalBreakevenMonth ? formatNumber(result.nominalBreakevenMonth) : 'نامشخص'} رخ می‌دهد.`
    });

    if (input.annualInflationRate > input.fundAnnualReturnRate) {
        analysis.disadvantagesAndRisks.push({
            title: "افت قدرت خرید واقعی ناشی از تورم فراتر از بازده صندوق",
            category: "ریسک اقتصاد کلان و تورم",
            impactLevel: "بسیار بالا",
            description: `نرخ تورم سالانه (${formatPercent(input.annualInflationRate * 100)}) از نرخ بازده پیش‌بینی‌شده صندوق (${formatPercent(input.fundAnnualReturnRate * 100)}) بیشتر است. این شکاف تورمی باعث می‌شود بازده واقعی تعدیل‌شده با تورم کاهش یابد.`
        });
    }

    // ۳. هشدارهای فعال بیمه‌گذار
    if (result.nominalBreakevenMonth > 24) {
        analysis.criticalWarnings.push(`دوره سربه‌سر اسمی (${formatNumber(result.nominalBreakevenMonth)} ماه) طولانی‌تر از دوره بازپرداخت وام است؛ بنابراین سودآوری خالص بیمه‌گذار پس از تسویه کامل اقساط آغاز می‌گردد.`);
    }
    if (result.customerRealIRR < 0) {
        analysis.criticalWarnings.push(`بازده داخلی واقعی پس از تورم (${formatPercent(result.customerRealIRR * 100)}) منفی است؛ این طرح در شرایط تورم افسارگسیخته فعلی بیشتر نقش پوشش خطر فوت و پس‌انداز انضباطی را دارد تا سوداگری تورمی.`);
    }
    if (result.monthlyInstallment > (input.customerInitialCash * 0.15)) {
        analysis.criticalWarnings.push(`قسط ماهانه (${formatCurrency(result.monthlyInstallment)}) بیش از ۱۵٪ نقدینگی اولیه است؛ بیمه‌گذار باید از استطاعت مالی خود برای پرداخت منظم ماهانه اطمینان یابد.`);
    }

    // ۴. توصیه‌های استراتژیک
    analysis.strategicRecommendations.push("پرهیز از بازخرید زودهنگام بیمه‌نامه حداقل تا قبل از سال ۳ جهت عبور ایمن از دوره بازگشت سرمایه.");
    analysis.strategicRecommendations.push("اتصال حساب واریز حقوق یا حساب فعال نزد بانک برای پرداخت خودکار اقساط بدون دیرکرد.");
    analysis.strategicRecommendations.push("استفاده از سبدهای دارایی پربازده‌تر (مانند صندوق‌های سهامی یا طلا) در شرایط تورم بالای ۴۰ درصد.");

    return analysis;
}

function generateLocalBankStrategic(input, result, monthlySchedule, yearlySummaries, pnl) {
    const analysis = {
        loanPrincipalGranted: input.bankLoanAmount,
        upfrontFeeCollected: result.bankFeeAmount,
        blockedDepositBenefit: pnl.bankBlockedDepositBenefit,
        totalInterestRevenue: result.totalLoanInterestAmount,
        totalGrossRevenue: pnl.bankTotalGrossRevenue,
        effectiveAnnualYieldAPR: result.bankEffectiveAPR,
        defaultRiskRate: 0,
        collateralCoverageRatioAtStart: input.bankLoanAmount > 0 ? (result.netInitialFundDeposit / input.bankLoanAmount) * 100 : 100,
        advantages: [],
        disadvantagesAndRisks: [],
        criticalWarnings: [],
        strategicRecommendations: []
    };

    // ۱. مزایا و فرصت‌های بانک
    analysis.advantages.push({
        title: "ریسک اعتباری و سوخت تسهیلات صفر درصد (Zero NPL Risk)",
        category: "مدیریت ریسک اعتباری",
        impactLevel: "بسیار بالا",
        monetaryValue: input.bankLoanAmount,
        description: `به دلیل توثیق رسمی اندوخته صندوق سرمایه‌گذاری و تعهد پرداخت قطعی شرکت بیمه در صورت فوت یا انصراف، وام ${formatCurrency(input.bankLoanAmount)} بانک هرگز در معرض سوخت یا مطالبات مشکوک‌الوصول قرار ندارد.`
    });

    analysis.advantages.push({
        title: "کارمزد نقدی قطعی در بدو اعطا (Upfront Cash Fee)",
        category: "درآمد غیرمشاع نقدی",
        impactLevel: "بالا",
        monetaryValue: result.bankFeeAmount,
        description: `بانک در همان لحظه صدور تسهیلات مبلغ ${formatCurrency(result.bankFeeAmount)} (معادل ${formatPercent(input.bankFeeRate * 100)} اصل وام) را به عنوان کارمزد پرونده به صورت نقدی دریافت و به عنوان سود قطعی شناسایی می‌کند.`
    });

    analysis.advantages.push({
        title: "رسوب رایگان سپرده مسدود نقدی برای مدت ۱۲ ماه",
        category: "تجهیز منابع ارزان‌قیمت",
        impactLevel: "بالا",
        monetaryValue: result.bankBlockedDepositAmount,
        description: `مبلغ ${formatCurrency(result.bankBlockedDepositAmount)} (۴٪ وام) به مدت یک سال در حساب بانک بلوکه مانده و ارزش هزینه‌فرصت آن معادل ${formatCurrency(analysis.blockedDepositBenefit)} منفعت ترازنامه‌ای برای بانک ایجاد می‌نماید.`
    });

    analysis.advantages.push({
        title: "بازده مؤثر سالانه بالا (Effective APR)",
        category: "سودآوری تسهیلات",
        impactLevel: "بسیار بالا",
        description: `با احتساب کارمزد اولیه، سود تسهیلات ${formatPercent(input.bankLoanAnnualInterestRate * 100)} و رسوب سپرده مسدود، نرخ بازده مؤثر تسهیلات برای بانک به ${formatPercent(analysis.effectiveAnnualYieldAPR * 100)} سالانه می‌رسد که فراتر از نرخ مصوب اسمی است.`
    });

    analysis.advantages.push({
        title: "جذب مشتریان وفادار جدید و رسوب اقساط در شبکه بانکی (Cross-selling)",
        category: "توسعه کسب‌وکار بانکی",
        impactLevel: "متوسط",
        description: "هر فقره بیمه‌نامه منجر به افتتاح حساب جدید، الزام به واریز ۲۴ مرحله قسط و فرصت فروش سایر خدمات بانک نظیر کارت اعتباری، اینترنت بانک و سپرده‌گذاری می‌گردد."
    });

    // ۲. معایب، ریسک‌ها و چالش‌های بانک
    analysis.disadvantagesAndRisks.push({
        title: "ریسک عملیاتی و حقوقی در فرآیند استرداد و تسویه با شرکت بیمه",
        category: "ریسک عملیاتی و حقوقی",
        impactLevel: "متوسط",
        description: "در صورت نکول اقساط، تسویه بدهی با بیمه‌گر نیازمند اعلام رسمی، فسخ بیمه‌نامه و انتقال وجه از صندوق به بانک است که در صورت عدم اتصال خودکار سامانه‌ها می‌تواند با تأخیر همراه شود."
    });

    analysis.disadvantagesAndRisks.push({
        title: "قفل خط اعتباری و سهمیه تسهیلات خرد بانک با نرخ مصوب ۲۳٪",
        category: "مدیریت نقدینگی و منابع",
        impactLevel: "متوسط",
        monetaryValue: input.bankLoanAmount,
        description: "تخصیص خط اعتباری به این طرح بخشی از سهمیه تسهیلات خرد شعبه را اشغال می‌کند که در دوران انقباض پولی بانک مرکزی ممکن است با محدودیت سقف تسهیلات‌دهی روبرو شود."
    });

    // ۳. هشدارهای فعال بانک
    if (input.bankFeeRate < 0.05) {
        analysis.criticalWarnings.push(`کارمزد بانکی (${formatPercent(input.bankFeeRate * 100)}) کمتر از نرخ بهینه عرف ۵ الی ۶.۵ درصد تنظیم شده است که بازده مؤثر بانک را کاهش می‌دهد.`);
    }
    if (input.bankLoanTenureMonths > 36) {
        analysis.criticalWarnings.push(`دوره بازپرداخت (${formatNumber(input.bankLoanTenureMonths)} ماه) طولانی‌تر از استاندارد ۳۶ ماه است که هزینه فرصت منابع بانک را در شرایط تورمی افزایش می‌دهد.`);
    }

    // ۴. توصیه‌های استراتژیک بانک
    analysis.strategicRecommendations.push("برقراری وب‌سرویس API برخط بین سامانه اعتبارات بانک و سامانه صدور شرکت بیمه جهت وثیقه‌گذاری آنی.");
    analysis.strategicRecommendations.push("اخذ وکالت بلاعزل برداشت مستقیم اقساط (Direct Debit) از حساب جاری/حقوق مشتری.");
    analysis.strategicRecommendations.push("ارائه بسته‌های تشویقی کارمزد برای مشتریانی که اقساط را زودتر از موعد یا بدون تاخیر تسویه می‌کنند.");

    return analysis;
}

function generateLocalInsuranceStrategic(input, result, monthlySchedule, pnl) {
    const analysis = {
        upfrontCashInflow: input.totalPolicyValue,
        immediateRiskFreeProfit: result.insuranceUnderwritingFeeAmount,
        longTermManagementFees: pnl.insuranceFundManagementIncome,
        totalExpectedRevenue: pnl.insuranceUnderwritingIncome + pnl.insuranceMortalityCoverageIncome + pnl.insuranceFundManagementIncome,
        netProfitAfterClaimsAndExpenses: pnl.insuranceNetMargin,
        profitMarginPercentage: 0,
        advantages: [],
        disadvantagesAndRisks: [],
        criticalWarnings: [],
        strategicRecommendations: []
    };

    if (analysis.totalExpectedRevenue > 0) {
        analysis.profitMarginPercentage = (analysis.netProfitAfterClaimsAndExpenses / analysis.totalExpectedRevenue) * 100;
    }

    let coverageMonth = 0;
    let maxExposure = 0;
    let maxExposureMonth = 0;

    monthlySchedule.forEach(item => {
        const netGap = item.remainingLoanBalance - item.fundValueEnding;
        if (netGap > maxExposure) {
            maxExposure = netGap;
            maxExposureMonth = item.month;
        }
        if (coverageMonth === 0 && item.fundValueEnding >= item.remainingLoanBalance) {
            coverageMonth = item.month;
        }
    });

    analysis.monthsToFullCollateralCoverage = coverageMonth;
    analysis.maximumDefaultExposure = Math.max(0, maxExposure);
    analysis.monthOfMaxExposure = maxExposureMonth;

    const y1Item = monthlySchedule.find(m => m.month === 12);
    analysis.year1CoverageRatio = (y1Item && y1Item.remainingLoanBalance > 0)
        ? (y1Item.fundValueEnding / y1Item.remainingLoanBalance) * 100
        : 100;

    analysis.annualMortalityRate = estimateMortalityRate(input.insuredAge);
    analysis.cumulativeMortalityProbability = 1.0 - Math.pow(1.0 - analysis.annualMortalityRate, input.simulationYears);
    analysis.totalMortalityPremiumCollected = result.lifeCoverageFeeAmount;
    analysis.expectedMortalityClaimCost = pnl.insuranceExpectedClaimExpense;
    analysis.mortalityUnderwritingResult = analysis.totalMortalityPremiumCollected - analysis.expectedMortalityClaimCost;

    // مزایا
    analysis.advantages.push({
        title: "جذب نقدینگی و حق بیمه کلان در بدو قرارداد (Upfront Cash Inflow)",
        category: "توسعه بازار و پورتفو",
        impactLevel: "بسیار بالا",
        monetaryValue: input.totalPolicyValue,
        description: `شرکت بیمه در همان ابتدای قرارداد مبلغ ${formatCurrency(input.totalPolicyValue)} حق بیمه را از ترکیب نقد و وام بانکی تجهیز و وصول می‌کند که برای افزایش سهم بازار بیمه‌های زندگی و ارتقای رتبه توانگری مالی شرکت در صنعت بیمه بسیار اثرگذار است.`
    });

    analysis.advantages.push({
        title: "کارمزد بیمه‌گری قطعی و بدون ریسک در نقطه صفر",
        category: "سودآوری مالی",
        impactLevel: "بالا",
        monetaryValue: result.insuranceUnderwritingFeeAmount,
        description: `مبلغ ${formatCurrency(result.insuranceUnderwritingFeeAmount)} (۵٪ کل حق بیمه) بلافاصله پس از صدور به عنوان درآمد قطعی و کارمزد بیمه‌گری برداشت می‌شود که مستقیماً به سود عملیاتی شرکت افزوده می‌گردد.`
    });

    analysis.advantages.push({
        title: "کاهش چشمگیر هزینه جذب مشتری (Low CAC) از طریق کانال بانک",
        category: "بازاریابی و توزیع",
        impactLevel: "بالا",
        description: "استفاده از شبکه گسترده شعب بانک و بستر Bancassurance هزینه‌های سرسام‌آور بازاریابی، تبلیغات محیطی و پورسانت‌های سنگین شبکه سنتی نمایندگان را به حداقل ممکن می‌رساند."
    });

    analysis.advantages.push({
        title: "درآمد مستمر از محل کارمزد مدیریت سبد سرمایه‌گذاری (AUM Fees)",
        category: "جریان درآمدی پایدار",
        impactLevel: "متوسط",
        monetaryValue: analysis.longTermManagementFees,
        description: `با رشد مرکب صندوق سرمایه‌گذاری در طول ${input.simulationYears} سال، کارمزد مدیریت سبد دارایی درآمدی مستمر معادل حدود ${formatCurrency(analysis.longTermManagementFees)} برای شرکت ایجاد می‌کند.`
    });

    if (analysis.mortalityUnderwritingResult >= 0) {
        analysis.advantages.push({
            title: "مازاد فنی مثبت در بخش پوشش فوت (Underwriting Profit)",
            category: "اکچوئری",
            impactLevel: "متوسط",
            monetaryValue: analysis.mortalityUnderwritingResult,
            description: `حق بیمه پوشش فوت دریافتی (${formatCurrency(analysis.totalMortalityPremiumCollected)}) از ارزش انتظاری ریاضی خسارت فوت (${formatCurrency(analysis.expectedMortalityClaimCost)}) بیشتر است و مازاد سود فنی ${formatCurrency(analysis.mortalityUnderwritingResult)} برای بیمه‌گر باقی می‌گذارد.`
        });
    }

    // معایب و ریسک‌ها
    if (analysis.maximumDefaultExposure > 0) {
        analysis.disadvantagesAndRisks.push({
            title: "ریسک کسری وثیقه در صورت نکول بیمه‌گذار در ماه‌های ابتدایی",
            category: "ریسک اعتباری و تعهدات",
            impactLevel: "بحرانی",
            monetaryValue: analysis.maximumDefaultExposure,
            description: `در ماه ${analysis.monthOfMaxExposure}، مانده بدهی به بانک بیشتر از ارزش روز صندوق است و حداکثر شکاف کسری معادل ${formatCurrency(analysis.maximumDefaultExposure)} خواهد بود. اگر بیمه‌گذار اقساط را متوقف کند، بیمه‌گر متعهد به تأمین این کسری خواهد بود.`
        });
    } else {
        analysis.disadvantagesAndRisks.push({
            title: "تعهد حقوقی به بانک جهت تسویه مانده تسهیلات (Guarantor Role)",
            category: "ریسک حقوقی و اعتباری",
            impactLevel: "متوسط",
            description: "شرکت بیمه در برابر بانک متعهد است که در صورت هرگونه عدم وصول اقساط، مانده تسهیلات را از محل اندوخته تسویه کند. هرچند ارزش صندوق وام را پوشش می‌دهد، اما فرآیند اداری و بلوکه شدن نقدینگی بر عهده بیمه است."
        });
    }

    analysis.disadvantagesAndRisks.push({
        title: "ریسک فسخ زودهنگام و بازخرید (Early Surrender / Lapse Risk)",
        category: "ریسک پایداری بیمه‌نامه",
        impactLevel: "بالا",
        description: `به دلیل کسر کارمزد ۶.۵٪ بانک، ۵٪ بیمه‌گری و ۵٪ پوشش فوت، ارزش بازخرید خالص تا ماه ${result.nominalBreakevenMonth || 24} به نقطه سربه‌سر نمی‌رسد. انصراف زودهنگام بیمه‌گذار موجب نارضایتی مشتری و چالش تسویه تسهیلات با بانک خواهد شد.`
    });

    if (input.annualInflationRate >= 0.35) {
        analysis.disadvantagesAndRisks.push({
            title: "ریسک فرسایش ارزش واقعی اندوخته ناشی از تورم بالا و آسیب به برند",
            category: "ریسک اعتبار برند و ALM",
            impactLevel: "بالا",
            description: `با تورم سالانه ${formatPercent(input.annualInflationRate * 100)}، اگر بازدهی صندوق نتواند تورم را پوشش دهد، قدرت خرید اندوخته افت شدیدی پیدا می‌کند و بیمه‌گذاران در سال‌های میانی احساس زیان کرده و اقدام به بازخرید یا پیگیری قضایی می‌کنند.`
        });
    }

    if (analysis.mortalityUnderwritingResult < 0) {
        analysis.disadvantagesAndRisks.push({
            title: "کسری حق بیمه پوشش فوت نسبت به ریسک اکچوئری (سن بالا)",
            category: "ریسک اکچوئری",
            impactLevel: "بحرانی",
            monetaryValue: Math.abs(analysis.mortalityUnderwritingResult),
            description: `در سن ${input.insuredAge} سالگی و افق ${input.simulationYears} ساله، ارزش ریاضی خسارت انتظاری فوت (${formatCurrency(analysis.expectedMortalityClaimCost)}) از حق بیمه ۵٪ دریافتی پیشی گرفته و موجب زیان فنی ${formatCurrency(Math.abs(analysis.mortalityUnderwritingResult))} می‌شود.`
        });
    }

    analysis.disadvantagesAndRisks.push({
        title: "تعهدات ذخیره‌گیری فنی و اکچوئری نزد بیمه مرکزی",
        category: "الزامات رگولاتوری",
        impactLevel: "متوسط",
        description: "شرکت بیمه موظف است طبق آیین‌نامه‌های مصوب بیمه مرکزی ج.ا.ا، ذخایر ریاضی، بازخرید و خسارت معوق معتنابهی را در صورت‌های مالی قفل و نگهداری کند که بر نقدینگی کوتاه‌مدت شرکت اثر می‌گذارد."
    });

    // هشدارهای هوشمند
    if (input.insuredAge >= 50) {
        analysis.criticalWarnings.push(`هشدار اکچوئری: سن بیمه‌گذار (${input.insuredAge} سال) بالاست؛ در این سنین، احتمال فوت افزایش یافته و تعهد پرداخت ${formatCurrency(input.lifeCoverageCapital)} با حق بیمه ۵٪ توجیه فنی ندارد. اخذ پرسشنامه پزشکی و اضافه نرخ سنی الزامی است.`);
    }

    if (input.fundAnnualReturnRate < input.bankLoanAnnualInterestRate) {
        analysis.criticalWarnings.push(`هشدار خطر منفی شدن بازده: بازده پیش‌بینی صندوق (${formatPercent(input.fundAnnualReturnRate * 100)}) کمتر از سود تسهیلات بانکی (${formatPercent(input.bankLoanAnnualInterestRate * 100)}) است. این موضوع موجب ذوب شدن سریع اندوخته و افزایش شدید ریسک نکول مشتری می‌شود.`);
    }

    if (input.agentCommissionRate > 0.03) {
        analysis.criticalWarnings.push(`هشدار کارمزد شبکه فروش: کارمزد نماینده (${formatPercent(input.agentCommissionRate * 100)}) بسیار بالاست. در مدل‌های بانکی (Bancassurance) به دلیل استفاده از شعب بانک، کارمزد فروشنده معمولاً زیر ۱.۵٪ تنظیم می‌شود تا از جذابیت صندوق برای مشتری کاسته نشود.`);
    }

    if (analysis.year1CoverageRatio < 100) {
        analysis.criticalWarnings.push(`هشدار عدم کفایت وثیقه در سال اول: نسبت پوشش اندوخته به مانده بدهی وام در پایان سال اول ${formatPercent(analysis.year1CoverageRatio)} است (کمتر از ۱۰۰٪)؛ یعنی در صورت نکول مشتری در سال اول، شرکت بیمه باید کسری را پرداخت کند.`);
    }

    // توصیه‌های استراتژیک
    analysis.strategicRecommendations = [
        "تنظیم شرط حداقل ماندگاری ۲ ساله: تعیین جریمه بازخرید در صورت انصراف در ۲ سال اول تا هزینه‌های بانکی و بیمه‌گری مستهلک شود.",
        "الزام سقف سنی ۵۰ سال برای پوشش فوت بدون معاینه پزشکی جهت مهار ریسک گزینش نامساعد.",
        "تضمین حداقل بازده تضمینی صندوق یا استفاده از صندوق‌های با درآمد ثابت و اهرمی معتبر برای پیشگیری از نوسانات منفی شدید.",
        "مذاکره با بانک برای تسهیم بخشی از کارمزد ۶.۵٪ بانک با شرکت بیمه به پاس ضمانت بازپرداخت اقساط توسط بیمه‌گر."
    ];

    return analysis;
}


